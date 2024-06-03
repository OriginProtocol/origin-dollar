const fetch = require("node-fetch");
const { defaultAbiCoder, formatUnits, hexDataSlice, parseEther, keccak256 } =
  require("ethers").utils;
const { v4: uuidv4 } = require("uuid");
const {
  KeyValueStoreClient,
} = require("@openzeppelin/defender-kvstore-client");

const { getClusterInfo } = require("../utils/ssv");
const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolvers");
const { getSigner } = require("../utils/signers");
const { sleep } = require("../utils/time");
const { logTxDetails } = require("../utils/txLogger");
const { networkMap } = require("../utils/hardhat-helpers");

const log = require("../utils/logger")("task:p2p");

const validatorStateEnum = {
  0: "NOT_REGISTERED",
  1: "REGISTERED",
  2: "STAKED",
  3: "EXITED",
  4: "EXIT_COMPLETE",
};

const validatorOperationsConfig = async (taskArgs) => {
  const { chainId } = await ethers.provider.getNetwork();
  const network = networkMap[chainId];

  if (!network) {
    throw new Error(
      `registerValidators does not support chain with id ${chainId}`
    );
  }
  const addressesSet = addresses[network];
  const isMainnet = network === "mainnet";

  const signer = await getSigner();

  const storeFilePath = require("path").join(
    __dirname,
    "..",
    `.localKeyValueStorage.${network}`
  );

  const WETH = await ethers.getContractAt("IWETH9", addressesSet.WETH);

  const nativeStakingStrategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );
  const feeAccumulatorAddress =
    await nativeStakingStrategy.FEE_ACCUMULATOR_ADDRESS();

  const p2p_api_key = isMainnet
    ? process.env.P2P_MAINNET_API_KEY
    : process.env.P2P_HOLESKY_API_KEY;
  if (!p2p_api_key) {
    throw new Error(
      "P2P API key environment variable is not set. P2P_MAINNET_API_KEY or P2P_HOLESKY_API_KEY"
    );
  }
  const p2p_base_url = isMainnet ? "api.p2p.org" : "api-test-holesky.p2p.org";

  return {
    store: new KeyValueStoreClient({ path: storeFilePath }),
    signer,
    p2p_api_key,
    p2p_base_url,
    nativeStakingStrategy,
    feeAccumulatorAddress,
    WETH,
    // how much SSV (expressed in days of runway) gets deposited into the
    // SSV Network contract on validator registration. This is calculated
    // at a Cluster level rather than a single validator.
    validatorSpawnOperationalPeriodInDays: taskArgs.days,
    stake: taskArgs.stake,
    clear: taskArgs.clear,
    uuid: taskArgs.uuid,
  };
};

/* When same UUID experiences and error threshold amount of times it is
 * discarded.
 */
const ERROR_THRESHOLD = 5;
/*
 * Spawns and maintains the required amount of validators throughout
 * their setup cycle which consists of:
 *   - check balance of (W)ETH and crate P2P SSV cluster creation request
 *   - wait for the cluster to become operational
 *   - batch register the cluster on the SSV network
 *   - verify the complete cluster has been registered
 *   - batch stake the ETH to each of the validators
 *
 * Needs to also handle:
 *   - if anytime in the spawn cycle the number of (W)ETH falls below the
 *     required stake amount (withdrawal from Node Operator), mark the spawn
 *     process as failed
 *   - if spawn process gets stuck at any of the above steps and is not able to
 *     recover in X amount of times (e.g. 5 times). Mark the process as failed
 *     and start over.
 *   - TODO: (implement this) if fuse of the native staking strategy is blown
 *     stop with all the operations
 */
const registerValidators = async ({
  store,
  signer,
  p2p_api_key,
  p2p_base_url,
  nativeStakingStrategy,
  feeAccumulatorAddress,
  WETH,
  validatorSpawnOperationalPeriodInDays,
  clear,
}) => {
  let currentState = await getState(store);
  log("currentState", currentState);

  if (clear && currentState?.uuid) {
    await clearState(currentState.uuid, store);
    currentState = undefined;
  }

  if (!(await stakingContractHas32ETH(nativeStakingStrategy, WETH))) {
    console.log(
      `Native staking contract doesn't have enough WETH available to stake. Does depositToStrategy or resetStakeETHTally need to be called?`
    );
    return;
  }

  if (await stakingContractPaused(nativeStakingStrategy)) {
    console.log(`Native staking contract is paused... exiting`);
    return;
  }

  const executeOperateLoop = async () => {
    while (true) {
      if (!currentState) {
        await createValidatorRequest(
          store,
          "validator_creation_issued", // next state
          p2p_api_key,
          p2p_base_url,
          nativeStakingStrategy.address, // SSV owner address & withdrawal address
          feeAccumulatorAddress, // execution layer fee recipient
          validatorSpawnOperationalPeriodInDays
        );
        currentState = await getState(store);
      }

      if (currentState.state === "validator_creation_issued") {
        await confirmValidatorRegistered(
          store,
          currentState.uuid,
          "validator_creation_confirmed", // next state
          p2p_api_key,
          p2p_base_url
        );
        currentState = await getState(store);
      }

      if (currentState.state === "validator_creation_confirmed") {
        await broadcastRegisterValidator(
          store,
          currentState.uuid,
          "register_transaction_broadcast", // next state
          signer,
          currentState.metadata,
          nativeStakingStrategy
        );
        currentState = await getState(store);
      }

      if (currentState.state === "register_transaction_broadcast") {
        await waitForTransactionAndUpdateStateOnSuccess(
          store,
          currentState.uuid,
          "validator_registered", // next state
          nativeStakingStrategy.provider,
          currentState.metadata.validatorRegistrationTx,
          "registerSsvValidator" // name of transaction we are waiting for
        );
        currentState = await getState(store);
        break;
      }

      await sleep(1000);
    }
  };

  try {
    if ((await getErrorCount(store)) >= ERROR_THRESHOLD) {
      await clearState(
        currentState.uuid,
        store,
        `Errors have reached the threshold(${ERROR_THRESHOLD}) discarding attempt`
      );
      return;
    }
    await executeOperateLoop();
  } catch (e) {
    await increaseErrorCount(currentState ? currentState.uuid : "", store, e);
    throw e;
  }
};

const stakeValidators = async ({
  store,
  signer,
  nativeStakingStrategy,
  WETH,
  p2p_api_key,
  p2p_base_url,
  uuid,
}) => {
  let currentState;
  if (!uuid) {
    let currentState = await getState(store);
    log("currentState", currentState);

    if (!currentState) {
      console.log(`Failed to get state from local storage`);
      return;
    }
  }

  if (!(await stakingContractHas32ETH(nativeStakingStrategy, WETH))) {
    console.log(`Native staking contract doesn't have enough ETH, exiting`);
    return;
  }

  if (await stakingContractPaused(nativeStakingStrategy)) {
    console.log(`Native staking contract is paused... exiting`);
    return;
  }

  const executeOperateLoop = async () => {
    while (true) {
      if (!currentState) {
        await confirmValidatorRegistered(
          store,
          uuid,
          "validator_registered", // next state
          p2p_api_key,
          p2p_base_url
        );
        currentState = await getState(store);

        // Check the validator has not already been staked
        const hashedPubkey = keccak256(currentState.metadata.pubkey);
        const status = await nativeStakingStrategy.validatorsStates(
          hashedPubkey
        );
        if (validatorStateEnum[status] !== "REGISTERED") {
          console.log(
            `Validator with pubkey ${currentState.metadata.pubkey} not in REGISTERED state. Current state: ${validatorStateEnum[status]}`
          );
          await clearState(currentState.uuid, store);
          break;
        }
      }

      if (currentState.state === "validator_registered") {
        await getDepositData(
          store,
          currentState.uuid,
          "deposit_data_got", // next state
          p2p_api_key,
          p2p_base_url
        );
        currentState = await getState(store);
      }

      if (currentState.state === "deposit_data_got") {
        await depositEth(
          store,
          currentState.uuid,
          "deposit_transaction_broadcast", // next state
          signer,
          nativeStakingStrategy,
          currentState.metadata.pubkey,
          currentState.metadata.depositData
        );
        currentState = await getState(store);
      }

      if (currentState.state === "deposit_transaction_broadcast") {
        await waitForTransactionAndUpdateStateOnSuccess(
          store,
          currentState.uuid,
          "deposit_confirmed", // next state
          nativeStakingStrategy.provider,
          currentState.metadata.depositTx,
          "stakeEth" // name of transaction we are waiting for
        );

        currentState = await getState(store);
      }

      if (currentState.state === "deposit_confirmed") {
        await clearState(currentState.uuid, store);
        break;
      }

      await sleep(1000);
    }
  };

  try {
    if ((await getErrorCount(store)) >= ERROR_THRESHOLD) {
      await clearState(
        currentState.uuid,
        store,
        `Errors have reached the threshold(${ERROR_THRESHOLD}) discarding attempt`
      );
      return;
    }
    await executeOperateLoop();
  } catch (e) {
    await increaseErrorCount(currentState ? currentState.uuid : "", store, e);
    throw e;
  }
};

const getErrorCount = async (store) => {
  const existingRequest = await getState(store);
  return existingRequest && existingRequest.errorCount
    ? existingRequest.errorCount
    : 0;
};

const increaseErrorCount = async (requestUUID, store, error) => {
  if (!requestUUID) {
    return;
  }

  const existingRequest = await getState(store);
  const existingErrorCount = existingRequest.errorCount
    ? existingRequest.errorCount
    : 0;
  const newErrorCount = existingErrorCount + 1;

  await store.put(
    "currentRequest",
    JSON.stringify({
      ...existingRequest,
      errorCount: newErrorCount,
    })
  );
  log(
    `Operate validators loop uuid: ${requestUUID} encountered an error ${newErrorCount} times. Error: `,
    error
  );
};

/* Each P2P request has a life cycle that results in the following states stored
 * in the shared Defender key-value storage memory.
 *  - "validator_creation_issued" the create request that creates a validator issued
 *  - "validator_creation_confirmed" confirmation that the validator has been created
 *  - "register_transaction_broadcast" the transaction to register the validator on
 *    the SSV network has been broadcast to the Ethereum network
 *  - "validator_registered" the register transaction has been confirmed
 *  - "deposit_transaction_broadcast" the stake transaction staking 32 ETH has been
 *    broadcast to the Ethereum network
 *  - "deposit_confirmed" transaction to stake 32 ETH has been confirmed
 */
const updateState = async (requestUUID, state, store, metadata = {}) => {
  if (
    ![
      "validator_creation_issued",
      "validator_creation_confirmed",
      "register_transaction_broadcast",
      "validator_registered",
      "deposit_data_got",
      "deposit_transaction_broadcast",
      "deposit_confirmed",
    ].includes(state)
  ) {
    throw new Error(`Unexpected state: ${state}`);
  }

  const existingRequest = await getState(store);
  const existingMetadata =
    existingRequest && existingRequest.metadata ? existingRequest.metadata : {};

  await store.put(
    "currentRequest",
    JSON.stringify({
      uuid: requestUUID,
      state: state,
      metadata: { ...existingMetadata, ...metadata },
    })
  );
};

const clearState = async (uuid, store, error = false) => {
  if (error) {
    log(
      `Clearing state tracking of ${uuid} request because of an error: ${error}`
    );
  } else {
    log(
      `Clearing state tracking of ${uuid} request as it has completed its spawn cycle`
    );
  }
  await store.del("currentRequest");
};

/* Fetches the state of the current/ongoing cluster creation if there is any
 * returns either:
 *  - false if there is no cluster
 *  -
 */
const getState = async (store) => {
  const currentState = await store.get("currentRequest");
  if (!currentState) {
    return currentState;
  }

  return JSON.parse(await store.get("currentRequest"));
};

const stakingContractPaused = async (nativeStakingStrategy) => {
  const paused = await nativeStakingStrategy.paused();

  log(`Native staking contract is ${paused ? "" : "not "}paused`);
  return paused;
};

const stakingContractHas32ETH = async (nativeStakingStrategy, WETH) => {
  const address = nativeStakingStrategy.address;
  const wethBalance = await WETH.balanceOf(address);
  log(
    `Native Staking Strategy has ${formatUnits(wethBalance, 18)} WETH in total`
  );

  const stakeETHThreshold = await nativeStakingStrategy.stakeETHThreshold();
  const stakeETHTally = await nativeStakingStrategy.stakeETHTally();
  const remainingWETH = stakeETHThreshold.sub(stakeETHTally);
  log(
    `Native Staking Strategy has staked ${formatUnits(
      stakeETHTally
    )} of ${formatUnits(stakeETHThreshold)} ETH with ${formatUnits(
      remainingWETH
    )} WETH remaining`
  );

  // Take the minimum of the remainingETH and the WETH balance
  const availableETH = wethBalance.gt(remainingWETH)
    ? remainingWETH
    : wethBalance;
  log(
    `Native Staking Strategy has ${formatUnits(
      availableETH
    )} WETH available to stake`
  );

  return availableETH.gte(parseEther("32"));
};

/* Make a GET or POST request to P2P API
 * @param api_key: P2P API key
 * @param method: http method that can either be POST or GET
 * @param body: body object in case of a POST request
 */
const p2pRequest = async (url, api_key, method, body) => {
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${api_key}`,
  };

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  const bodyString = JSON.stringify(body);
  log(
    `About to call P2P API: ${method} ${url} `,
    body != undefined ? ` and body: ${bodyString}` : ""
  );

  const rawResponse = await fetch(url, {
    method,
    headers,
    body: bodyString,
  });

  const response = await rawResponse.json();
  if (response.error != null) {
    log("Call to P2P API failed with response:", response);
    throw new Error(
      `Failed to call to P2P API. Error: ${JSON.stringify(response.error)}`
    );
  } else {
    log(`${method} request to P2P API succeeded:`);
    log(response);
  }

  return response;
};

const createValidatorRequest = async (
  store,
  nextState,
  p2p_api_key,
  p2p_base_url,
  nativeStakingStrategy,
  feeAccumulatorAddress,
  validatorSpawnOperationalPeriodInDays
) => {
  const uuid = uuidv4();
  await p2pRequest(
    `https://${p2p_base_url}/api/v1/eth/staking/ssv/request/create`,
    p2p_api_key,
    "POST",
    {
      validatorsCount: 1,
      id: uuid,
      withdrawalAddress: nativeStakingStrategy,
      feeRecipientAddress: feeAccumulatorAddress,
      ssvOwnerAddress: nativeStakingStrategy,
      // TODO: we need to alter this and store the key somewhere
      type: "without-encrypt-key",
      operationPeriodInDays: validatorSpawnOperationalPeriodInDays,
    }
  );

  await updateState(uuid, nextState, store);
};

const waitForTransactionAndUpdateStateOnSuccess = async (
  store,
  uuid,
  nextState,
  provider,
  txHash,
  methodName
) => {
  log(
    `Waiting for transaction with hash "${txHash}", method "${methodName}" and uuid "${uuid}" to be mined...`
  );
  const tx = await provider.waitForTransaction(txHash);
  if (!tx) {
    throw Error(
      `Transaction with hash "${txHash}" not found for method "${methodName}" and uuid "${uuid}"`
    );
  }
  log(
    `Transaction with hash "${txHash}", method "${methodName}" and uuid "${uuid}" has been mined`
  );
  await updateState(uuid, nextState, store);
};

const depositEth = async (
  store,
  uuid,
  nextState,
  signer,
  nativeStakingStrategy,
  pubkey,
  depositData
) => {
  const { signature, depositDataRoot } = depositData;
  try {
    log(`About to stake ETH with:`);
    log(`pubkey: ${pubkey}`);
    log(`signature: ${signature}`);
    log(`depositDataRoot: ${depositDataRoot}`);
    const tx = await nativeStakingStrategy.connect(signer).stakeEth([
      {
        pubkey,
        signature,
        depositDataRoot,
      },
    ]);

    log(`Transaction to stake ETH has been broadcast with hash: ${tx.hash}`);

    await updateState(uuid, nextState, store, {
      depositTx: tx.hash,
    });
  } catch (e) {
    log(`Submitting transaction failed with: `, e);
    //await clearState(uuid, store, `Transaction to deposit to validator fails`)
    throw e;
  }
};

const broadcastRegisterValidator = async (
  store,
  uuid,
  nextState,
  signer,
  metadata,
  nativeStakingStrategy
) => {
  const registerTransactionParams = defaultAbiCoder.decode(
    [
      "bytes",
      "uint64[]",
      "bytes",
      "uint256",
      "tuple(uint32, uint64, uint64, bool, uint256)",
    ],
    hexDataSlice(metadata.registerValidatorData, 4)
  );
  // the publicKey and sharesData params are not encoded correctly by P2P so we will ignore them
  const [, operatorIds, , amount, cluster] = registerTransactionParams;
  // get publicKey and sharesData state storage
  const publicKey = metadata.pubkey;
  if (!publicKey) {
    throw Error(`pubkey not found in metadata: ${metadata}`);
  }
  const { sharesData } = metadata;
  if (!sharesData) {
    throw Error(`sharesData not found in metadata: ${metadata}`);
  }

  log(`About to register validator with:`);
  log(`publicKey: ${publicKey}`);
  log(`operatorIds: ${operatorIds}`);
  log(`sharesData: ${sharesData}`);
  log(`amount: ${amount}`);
  log(`cluster: ${cluster}`);

  try {
    const tx = await nativeStakingStrategy
      .connect(signer)
      .registerSsvValidator(
        publicKey,
        operatorIds,
        sharesData,
        amount,
        cluster
      );

    log(
      `Transaction to register SSV Validator has been broadcast with hash: ${tx.hash}`
    );

    await updateState(uuid, nextState, store, {
      validatorRegistrationTx: tx.hash,
    });
  } catch (e) {
    log(`Submitting transaction failed with: `, e);
    //await clearState(uuid, store, `Transaction to register SSV Validator fails`)
    throw e;
  }
};

const confirmValidatorRegistered = async (
  store,
  uuid,
  nextState,
  p2p_api_key,
  p2p_base_url
) => {
  const doConfirmation = async () => {
    const response = await p2pRequest(
      `https://${p2p_base_url}/api/v1/eth/staking/ssv/request/status/${uuid}`,
      p2p_api_key,
      "GET"
    );
    const isReady =
      response.result?.status === "ready" ||
      response.result?.status === "validator-ready";
    if (response.error != null) {
      log(
        `Error getting validator status with uuid ${uuid}: ${response.error}`
      );
      log(response);
      return false;
    } else if (!isReady) {
      log(
        `Validators with request uuid ${uuid} are not ready yet. Status: ${response?.result?.status}`
      );
      return false;
    } else {
      log(`Validators requested with uuid ${uuid} are ready`);

      const pubkey = response.result.encryptedShares[0].publicKey;
      const registerValidatorData =
        response.result.validatorRegistrationTxs[0].data;
      const sharesData = response.result.encryptedShares[0].sharesData;
      await updateState(uuid, nextState, store, {
        pubkey,
        registerValidatorData,
        sharesData,
      });
      log(`Public key: ${pubkey}`);
      log(`sharesData: ${sharesData}`);
      return true;
    }
  };

  await retry(doConfirmation, uuid, store);
};

const getDepositData = async (
  store,
  uuid,
  nextState,
  p2p_api_key,
  p2p_base_url
) => {
  const doConfirmation = async () => {
    const response = await p2pRequest(
      `https://${p2p_base_url}/api/v1/eth/staking/ssv/request/deposit-data/${uuid}`,
      p2p_api_key,
      "GET"
    );
    if (response.error != null) {
      log(`Error getting deposit data with uuid ${uuid}: ${response.error}`);
      log(response);
      return false;
    } else if (response.result?.status != "validator-ready") {
      log(
        `Deposit data with request uuid ${uuid} are not ready yet. Status: ${response.result?.status}`
      );
      return false;
    } else if (response.result?.status === "validator-ready") {
      log(`Deposit data with request uuid ${uuid} is ready`);

      const depositData = response.result.depositData[0];
      await updateState(uuid, nextState, store, {
        depositData,
      });
      log(`signature: ${depositData.signature}`);
      log(`depositDataRoot: ${depositData.depositDataRoot}`);
      return true;
    } else {
      log(`Error getting deposit data with uuid ${uuid}: ${response.error}`);
      log(response);
      throw Error(`Failed to get deposit data with uuid ${uuid}.`);
    }
  };

  await retry(doConfirmation, uuid, store);
};

const retry = async (apiCall, uuid, store, attempts = 20) => {
  let counter = 0;
  while (true) {
    if (await apiCall()) {
      break;
    }
    counter++;

    if (counter > attempts) {
      log(`Failed P2P API call after ${attempts} attempts.`);
      await clearState(
        uuid,
        store,
        `Too may attempts(${attempts}) to waiting for validator to be ready.`
      );
      break;
    }
    await sleep(3000);
  }
};

async function exitValidator({ pubkey, operatorids }) {
  const signer = await getSigner();

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  log(`About to exit validator`);
  const tx = await strategy
    .connect(signer)
    .exitSsvValidator(pubkey, operatorIds);
  await logTxDetails(tx, "exitSsvValidator");
}

async function removeValidator({ pubkey, operatorids }) {
  const signer = await getSigner();

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  // Cluster details
  const { cluster } = await getClusterInfo({
    chainId: hre.network.config.chainId,
    ssvNetwork: hre.network.name.toUpperCase(),
    operatorids,
    ownerAddress: strategy.address,
  });

  log(`About to exit validator`);
  const tx = await strategy
    .connect(signer)
    .removeSsvValidator(pubkey, operatorIds, cluster);
  await logTxDetails(tx, "removeSsvValidator");
}

async function resetStakeETHTally({ signer }) {
  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  log(`About to resetStakeETHTally`);
  const tx = await strategy.connect(signer).resetStakeETHTally();
  await logTxDetails(tx, "resetStakeETHTally");
}

async function setStakeETHThreshold({ signer, amount }) {
  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  const threshold = parseEther(amount.toString());

  log(`About to setStakeETHThreshold`);
  const tx = await strategy.connect(signer).setStakeETHThreshold(threshold);
  await logTxDetails(tx, "setStakeETHThreshold");
}

module.exports = {
  validatorOperationsConfig,
  registerValidators,
  stakeValidators,
  removeValidator,
  exitValidator,
  resetStakeETHTally,
  setStakeETHThreshold,
};
