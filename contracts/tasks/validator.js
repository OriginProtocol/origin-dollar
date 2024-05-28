const fetch = require("node-fetch");
const { defaultAbiCoder, formatUnits, hexDataSlice, parseEther } =
  require("ethers").utils;
const { v4: uuidv4 } = require("uuid");

//const { resolveContract } = require("../utils/resolvers");
const { sleep } = require("../utils/time");
//const { getClusterInfo } = require("./ssv");

const log = require("../utils/logger")("task:p2p");

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
const operateValidators = async ({ store, signer, contracts, config }) => {
  const {
    feeAccumulatorAddress,
    p2p_api_key,
    p2p_base_url,
    validatorSpawnOperationalPeriodInDays,
    stake,
    clear,
  } = config;

  let currentState = await getState(store);
  log("currentState", currentState);

  if (clear && currentState?.uuid) {
    await clearState(currentState.uuid, store);
    currentState = undefined;
  }

  if (!(await stakingContractHas32ETH(contracts))) {
    log(`Native staking contract doesn't have enough ETH, exiting`);
    return;
  }

  if (await stakingContractPaused(contracts)) {
    log(`Native staking contract is paused... exiting`);
    return;
  }

  const executeOperateLoop = async () => {
    while (true) {
      if (!currentState) {
        await createValidatorRequest(
          p2p_api_key, // api key
          p2p_base_url,
          contracts.nativeStakingStrategy.address, // SSV owner address & withdrawal address
          feeAccumulatorAddress, // execution layer fee recipient
          validatorSpawnOperationalPeriodInDays,
          store
        );
        currentState = await getState(store);
      }

      if (currentState.state === "validator_creation_issued") {
        await confirmValidatorCreatedRequest(
          p2p_api_key,
          p2p_base_url,
          currentState.uuid,
          store
        );
        currentState = await getState(store);
      }

      if (currentState.state === "validator_creation_confirmed") {
        await broadcastRegisterValidator(
          signer,
          store,
          currentState.uuid,
          currentState.metadata,
          contracts.nativeStakingStrategy
        );
        currentState = await getState(store);
      }

      if (currentState.state === "register_transaction_broadcast") {
        await waitForTransactionAndUpdateStateOnSuccess(
          store,
          currentState.uuid,
          contracts.nativeStakingStrategy.provider,
          currentState.metadata.validatorRegistrationTx,
          "registerSsvValidator", // name of transaction we are waiting for
          "validator_registered" // new state when transaction confirmed
        );
        currentState = await getState(store);
      }

      if (!stake) break;

      if (currentState.state === "validator_registered") {
        await depositEth(
          signer,
          store,
          currentState.uuid,
          contracts.nativeStakingStrategy,
          currentState.metadata.depositData
        );
        currentState = await getState(store);
      }

      if (currentState.state === "deposit_transaction_broadcast") {
        await waitForTransactionAndUpdateStateOnSuccess(
          store,
          currentState.uuid,
          contracts.nativeStakingStrategy.provider,
          currentState.metadata.depositTx,
          "stakeEth", // name of transaction we are waiting for
          "deposit_confirmed" // new state when transaction confirmed
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

const stakingContractPaused = async (contracts) => {
  const paused = await contracts.nativeStakingStrategy.paused();

  log(`Native staking contract is ${paused ? "" : "not "}paused`);
  return paused;
};

const stakingContractHas32ETH = async (contracts) => {
  const address = contracts.nativeStakingStrategy.address;
  const wethBalance = await contracts.WETH.balanceOf(address);
  log(
    `Native Staking Strategy has ${formatUnits(wethBalance, 18)} WETH in total`
  );

  const stakeETHThreshold = contracts.nativeStakingStrategy.stakeETHThreshold();
  const stakeETHTally = contracts.nativeStakingStrategy.stakeETHTally();
  const remainingETH = stakeETHThreshold.sub(stakeETHTally);
  log(
    `Native Staking Strategy has staked ${formatUnits(
      stakeETHTally
    )} of ${formatUnits(stakeETHThreshold)} ETH with ${formatUnits(
      remainingETH
    )} ETH remaining`
  );

  // Take the minimum of the remainingETH and the WETH balance
  const availableETH = wethBalance.gt(remainingETH)
    ? remainingETH
    : wethBalance;
  log(
    `Native Staking Strategy has ${formatUnits(
      availableETH
    )} ETH available to stake`
  );

  return availableETH.gte(parseEther("32"));
};

/* Make a GET or POST request to P2P service
 * @param api_key: p2p service api key
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
    `Creating a P2P ${method} request with ${url} `,
    body != undefined ? ` and body: ${bodyString}` : ""
  );

  const rawResponse = await fetch(url, {
    method,
    headers,
    body: bodyString,
  });

  const response = await rawResponse.json();
  if (response.error != null) {
    log("Request to P2P service failed with an error:", response);
    throw new Error(
      `Call to P2P has failed: ${JSON.stringify(response.error)}`
    );
  } else {
    log("Request to P2P service succeeded: ", response);
  }

  return response;
};

const createValidatorRequest = async (
  p2p_api_key,
  p2p_base_url,
  nativeStakingStrategy,
  feeAccumulatorAddress,
  validatorSpawnOperationalPeriodInDays,
  store
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

  await updateState(uuid, "validator_creation_issued", store);
};

const waitForTransactionAndUpdateStateOnSuccess = async (
  store,
  uuid,
  provider,
  txHash,
  methodName,
  newState
) => {
  log(
    `Waiting for transaction with hash "${txHash}" method "${methodName}" and uuid "${uuid}" to be mined...`
  );
  const tx = await provider.waitForTransaction(txHash);
  if (!tx) {
    throw Error(
      `Transaction with hash "${txHash}" not found for method "${methodName}" and uuid "${uuid}"`
    );
  }
  await updateState(uuid, newState, store);
};

const depositEth = async (
  signer,
  store,
  uuid,
  nativeStakingStrategy,
  depositData
) => {
  const { pubkey, signature, depositDataRoot } = depositData;
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

    await updateState(uuid, "deposit_transaction_broadcast", store, {
      depositTx: tx.hash,
    });
  } catch (e) {
    log(`Submitting transaction failed with: `, e);
    //await clearState(uuid, store, `Transaction to deposit to validator fails`)
    throw e;
  }
};

const broadcastRegisterValidator = async (
  signer,
  store,
  uuid,
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
  const publicKey = metadata.depositData.pubkey;
  if (!publicKey) {
    throw Error(
      `pubkey not found in metadata.depositData: ${metadata?.depositData}`
    );
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

    await updateState(uuid, "register_transaction_broadcast", store, {
      validatorRegistrationTx: tx.hash,
    });
  } catch (e) {
    log(`Submitting transaction failed with: `, e);
    //await clearState(uuid, store, `Transaction to register SSV Validator fails`)
    throw e;
  }
};

const confirmValidatorCreatedRequest = async (
  p2p_api_key,
  p2p_base_url,
  uuid,
  store
) => {
  const doConfirmation = async () => {
    const response = await p2pRequest(
      `https://${p2p_base_url}/api/v1/eth/staking/ssv/request/status/${uuid}`,
      p2p_api_key,
      "GET"
    );
    if (response.error != null) {
      log(`Error processing request uuid: ${uuid} error: ${response}`);
    } else if (response.result.status === "ready") {
      const registerValidatorData =
        response.result.validatorRegistrationTxs[0].data;
      const depositData = response.result.depositData[0];
      const sharesData = response.result.encryptedShares[0].sharesData;
      await updateState(uuid, "validator_creation_confirmed", store, {
        registerValidatorData,
        depositData,
        sharesData,
      });
      log(`Validator created using uuid: ${uuid} is ready`);
      log(`Primary key: ${depositData.pubkey}`);
      log(`signature: ${depositData.signature}`);
      log(`depositDataRoot: ${depositData.depositDataRoot}`);
      log(`sharesData: ${sharesData}`);
      return true;
    } else {
      log(
        `Validator created using uuid: ${uuid} not yet ready. State: ${response.result.status}`
      );
      return false;
    }
  };

  let counter = 0;
  const attempts = 20;
  while (true) {
    if (await doConfirmation()) {
      break;
    }
    counter++;

    if (counter > attempts) {
      log(
        `Tried validating the validator formation with ${attempts} but failed`
      );
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

// async function exitValidator({ publicKey, signer, operatorIds }) {
//   const strategy = await resolveContract(
//     "NativeStakingSSVStrategyProxy",
//     "NativeStakingSSVStrategy"
//   );

//   log(`About to exit validator`);
//   const tx = await strategy
//     .connect(signer)
//     .exitSsvValidator(publicKey, operatorIds);
//   await logTxDetails(tx, "exitSsvValidator");
// }

// async function removeValidator({ publicKey, signer, operatorIds }) {
//   const strategy = await resolveContract(
//     "NativeStakingSSVStrategyProxy",
//     "NativeStakingSSVStrategy"
//   );

//   // Cluster details
//   const { cluster } = await getClusterInfo({
//     chainId: hre.network.config.chainId,
//     ssvNetwork: hre.network.name.toUpperCase(),
//     operatorIds,
//     ownerAddress: strategy.address,
//   });

//   log(`About to exit validator`);
//   const tx = await strategy
//     .connect(signer)
//     .removeSsvValidator(publicKey, operatorIds, cluster);
//   await logTxDetails(tx, "removeSsvValidator");
// }

module.exports = {
  operateValidators,
  //removeValidator,
  //exitValidator,
};
