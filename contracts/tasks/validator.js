const fetch = require("node-fetch");
const { defaultAbiCoder, formatUnits, hexDataSlice, parseEther, keccak256 } =
  require("ethers").utils;
const { v4: uuidv4 } = require("uuid");
const {
  KeyValueStoreClient,
} = require("@openzeppelin/defender-kvstore-client");

const { getBlock } = require("./block");
const { checkPubkeyFormat } = require("./taskUtils");
const { storePrivateKeyToS3 } = require("../utils/amazon");
const addresses = require("../utils/addresses");
const { resolveContract } = require("../utils/resolversNoHardhat");
const { getDefenderSigner } = require("../utils/signersNoHardhat");
const { sleep } = require("../utils/time");
const { logTxDetails } = require("../utils/txLogger");
const { networkMap } = require("../utils/hardhat-helpers");
const { p2pApiEncodedKey } = require("../utils/constants");

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

  const signer = await getDefenderSigner();

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

  const awsS3AccessKeyId = process.env.AWS_ACCESS_S3_KEY_ID;
  const awsS3SexcretAccessKeyId = process.env.AWS_SECRET_S3_ACCESS_KEY;
  const s3BucketName = process.env.VALIDATOR_KEYS_S3_BUCKET_NAME;

  if (!awsS3AccessKeyId) {
    throw new Error("Secret AWS_ACCESS_S3_KEY_ID not set");
  }
  if (!awsS3SexcretAccessKeyId) {
    throw new Error("Secret AWS_SECRET_S3_ACCESS_KEY not set");
  }
  if (!s3BucketName) {
    throw new Error("Secret VALIDATOR_KEYS_S3_BUCKET_NAME not set");
  }

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
    clear: taskArgs.clear,
    uuid: taskArgs.uuid,
    maxValidatorsToRegister: taskArgs.validators,
    ssvAmount: taskArgs.ssv,
    awsS3AccessKeyId,
    awsS3SexcretAccessKeyId,
    s3BucketName,
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
  maxValidatorsToRegister,
  ssvAmount,
  awsS3AccessKeyId,
  awsS3SexcretAccessKeyId,
  s3BucketName,
}) => {
  let currentState = await getState(store);
  log("currentState", currentState);

  if (clear && currentState?.uuid) {
    await clearState(currentState.uuid, store);
    currentState = undefined;
  }

  const validatorsForEth = await validatorsThatCanBeStaked(
    nativeStakingStrategy,
    WETH
  );
  if (validatorsForEth == 0 || validatorsForEth < maxValidatorsToRegister) {
    console.log(
      `Native staking contract doesn't have enough WETH available to stake. Does depositToStrategy or resetStakeETHTally need to be called?`
    );
    if (maxValidatorsToRegister) {
      console.log(
        `Requested to spawn ${maxValidatorsToRegister} validators but only ${validatorsForEth} can be spawned.`
      );
    }
    return;
  }
  const validatorsCount =
    validatorsForEth < maxValidatorsToRegister
      ? validatorsForEth
      : maxValidatorsToRegister;

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
          validatorSpawnOperationalPeriodInDays,
          validatorsCount
        );
        currentState = await getState(store);
      }

      if (currentState.state === "validator_creation_issued") {
        await confirmValidatorRegistered(
          store,
          currentState.uuid,
          "validator_creation_confirmed", // next state
          p2p_api_key,
          p2p_base_url,
          awsS3AccessKeyId,
          awsS3SexcretAccessKeyId,
          s3BucketName
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
          nativeStakingStrategy,
          ssvAmount
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

      if (currentState.state === "validator_registered") {
        log(
          `Validator has been registered. Run the stakeValidators task to stake the validator`
        );
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
  awsS3AccessKeyId,
  awsS3SexcretAccessKeyId,
  s3BucketName,
}) => {
  if (await stakingContractPaused(nativeStakingStrategy)) {
    log(`Native staking contract is paused... exiting`);
    return;
  }

  let currentState;
  if (!uuid) {
    currentState = await getState(store);
    log("currentState", currentState);

    if (!currentState) {
      log(
        `There are no registered validators in local storage. Have you run registerValidators?`
      );
      return;
    }
  } else {
    log(`Processing uuid: ${uuid}`);
  }

  const executeOperateLoop = async () => {
    while (true) {
      if (!currentState) {
        await confirmValidatorRegistered(
          store,
          uuid,
          "validator_registered", // next state
          p2p_api_key,
          p2p_base_url,
          awsS3AccessKeyId,
          awsS3SexcretAccessKeyId,
          s3BucketName
        );
        currentState = await getState(store);

        // Check the first validator has not already been staked
        const hashedPubkey = keccak256(currentState.metadata.pubkeys[0]);
        const status = await nativeStakingStrategy.validatorsStates(
          hashedPubkey
        );
        if (validatorStateEnum[status] !== "REGISTERED") {
          log(
            `Validator with pubkey ${currentState.metadata.pubkeys[0]} not in REGISTERED state. Current state: ${validatorStateEnum[status]}`
          );
          // await clearState(currentState.uuid, store);
          // TODO just remove the validator that has already been staked from the metadata
          break;
        } else {
          log(
            `Validator with pubkey ${currentState.metadata.pubkeys[0]} is in the expected REGISTERED state.`
          );
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
        const validatorsForEth = await validatorsThatCanBeStaked(
          nativeStakingStrategy,
          WETH
        );
        const validatorsInState = currentState.metadata.pubkeys.length;
        if (validatorsForEth < validatorsInState) {
          `Native staking contract only has enough WETH to stake to ${validatorsForEth} validators, not ${validatorsInState}. Does depositToStrategy or resetStakeETHTally need to be called?`;
          return;
        }

        await depositEth(
          store,
          currentState.uuid,
          "deposit_transaction_broadcast", // next state
          signer,
          nativeStakingStrategy,
          currentState.metadata.pubkeys,
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

const validatorsThatCanBeStaked = async (nativeStakingStrategy, WETH) => {
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

  const validatorCountBN = availableETH.div(parseEther("32"));
  const validatorCount = parseInt(validatorCountBN.toString());
  log(`Native Staking Strategy can stake to ${validatorCount} validators`);
  return validatorCount;
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
    log(`Call to P2P API failed: ${method} ${url}`);
    // TODO: response might be too big for the logs to handle?
    //log(`response: `, response);
    throw new Error(
      `Failed to call to P2P API. Error: ${JSON.stringify(response.error)}`
    );
  } else {
    log(`${method} request to P2P API succeeded:`);
    // TODO: response might be too big for the logs to handle?
    //log(response);
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
  validatorSpawnOperationalPeriodInDays,
  validatorsCount
) => {
  const uuid = uuidv4();
  log(`validatorsCount: ${validatorsCount}`);
  await p2pRequest(
    `https://${p2p_base_url}/api/v1/eth/staking/ssv/request/create`,
    p2p_api_key,
    "POST",
    {
      validatorsCount,
      id: uuid,
      withdrawalAddress: nativeStakingStrategy,
      feeRecipientAddress: feeAccumulatorAddress,
      ssvOwnerAddress: nativeStakingStrategy,
      type: "with-encrypt-key",
      operationPeriodInDays: validatorSpawnOperationalPeriodInDays,
      ecdhPublicKey: p2pApiEncodedKey,
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
  pubkeys,
  depositData
) => {
  // const { signature, depositDataRoot } = depositData;
  try {
    log(`About to stake ETH with:`);

    const validatorsStakeData = depositData.map((d) => ({
      pubkey: d.pubkey,
      signature: d.signature,
      depositDataRoot: d.depositDataRoot,
    }));
    log(`validators stake data: ${JSON.stringify(validatorsStakeData)}`);
    const tx = await nativeStakingStrategy
      .connect(signer)
      .stakeEth(validatorsStakeData);

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
  nativeStakingStrategy,
  ssvAmount
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
  const publicKeys = metadata.pubkeys;
  if (!publicKeys) {
    throw Error(`pubkeys not found in metadata: ${metadata}`);
  }
  const { sharesData } = metadata;
  if (!sharesData) {
    throw Error(`sharesData not found in metadata: ${metadata}`);
  }

  ssvAmount = ssvAmount !== undefined ? ssvAmount : amount;

  log(`About to register validator with:`);
  log(`publicKeys: ${publicKeys}`);
  log(`operatorIds: ${operatorIds}`);
  log(`sharesData: ${sharesData}`);
  log(`ssvAmount: ${ssvAmount}`);
  log(`cluster: ${cluster}`);

  try {
    const tx = await nativeStakingStrategy
      .connect(signer)
      .registerSsvValidators(
        publicKeys,
        operatorIds,
        sharesData,
        ssvAmount,
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
  p2p_base_url,
  awsS3AccessKeyId,
  awsS3SexcretAccessKeyId,
  s3BucketName
) => {
  const doConfirmation = async () => {
    if (!uuid) {
      throw Error(`UUID is required to get validator status.`);
    }

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

      const registerValidatorData =
        response.result.validatorRegistrationTxs[0].data;
      const sharesData = [];
      const pubkeys = [];
      const nonces = [];
      const result = response.result;
      for (let i = 0; i < result.encryptedShares.length; i++) {
        const encryptedShare = result.encryptedShares[i];
        pubkeys[i] = encryptedShare.publicKey;
        nonces[i] = encryptedShare.nonce;
        sharesData[i] = encryptedShare.sharesData;

        await storePrivateKeyToS3({
          pubkey: pubkeys[i],
          encryptedPrivateKey: encryptedShare.ecdhEncryptedPrivateKey,
          awsS3AccessKeyId,
          awsS3SexcretAccessKeyId,
          s3BucketName,
        });
      }
      await updateState(uuid, nextState, store, {
        pubkeys,
        registerValidatorData,
        sharesData,
      });
      log(`Public keys: ${pubkeys}`);
      log(`nonces: ${nonces}`);
      log(`registerValidatorData: ${registerValidatorData}`);
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
    if (!uuid) {
      throw Error(`UUID is required to get deposit data.`);
    }
    const response = await p2pRequest(
      `https://${p2p_base_url}/api/v1/eth/staking/ssv/request/deposit-data/${uuid}`,
      p2p_api_key,
      "GET"
    );
    if (response.error != null) {
      log(`Error getting deposit data with uuid ${uuid}: ${response.error}`);
      // TODO: we shouldn't log full P2P responses. They break the logs
      //log(response);
      return false;
    } else if (response.result?.status != "validator-ready") {
      log(
        `Deposit data with request uuid ${uuid} are not ready yet. Status: ${response.result?.status}`
      );
      return false;
    } else if (response.result?.status === "validator-ready") {
      log(`Deposit data with request uuid ${uuid} is ready`);

      const depositData = response.result.depositData;
      await updateState(uuid, nextState, store, {
        depositData,
      });
      log(`signature 0: ${depositData[0].signature}`);
      log(`depositDataRoot 0: ${depositData[0].depositDataRoot}`);
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
  const signer = await getDefenderSigner();

  log(`Splitting operator IDs ${operatorids}`);
  const operatorIds = operatorids.split(",").map((id) => parseInt(id));

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  log(`About to exit validator`);
  pubkey = checkPubkeyFormat(pubkey);

  const tx = await strategy
    .connect(signer)
    .exitSsvValidator(pubkey, operatorIds);
  await logTxDetails(tx, "exitSsvValidator");
}

async function doAccounting({ signer, nativeStakingStrategy }) {
  log(`About to doAccounting`);
  const tx = await nativeStakingStrategy.connect(signer).doAccounting();
  await logTxDetails(tx, "doAccounting");
}

async function resetStakeETHTally() {
  const signer = await getDefenderSigner();

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  log(`About to resetStakeETHTally`);
  const tx = await strategy.connect(signer).resetStakeETHTally();
  await logTxDetails(tx, "resetStakeETHTally");
}

async function setStakeETHThreshold({ amount }) {
  const signer = await getDefenderSigner();

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  const threshold = parseEther(amount.toString());

  log(`About to setStakeETHThreshold`);
  const tx = await strategy.connect(signer).setStakeETHThreshold(threshold);
  await logTxDetails(tx, "setStakeETHThreshold");
}

async function fixAccounting({ validators, rewards, ether }) {
  const signer = await getDefenderSigner();

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  log(`About to fix accounting`);
  const tx = await strategy
    .connect(signer)
    .manuallyFixAccounting(validators, rewards, ether);
  await logTxDetails(tx, "manuallyFixAccounting");
}

async function pauseStaking() {
  const signer = await getDefenderSigner();

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  log(`About to pause the Native Staking Strategy`);
  const tx = await strategy.connect(signer).pause();
  await logTxDetails(tx, "pause");
}

async function snapStaking({ block, admin }) {
  const blockTag = getBlock(block);

  const strategy = await resolveContract(
    "NativeStakingSSVStrategyProxy",
    "NativeStakingSSVStrategy"
  );

  const feeAccumulator = await resolveContract(
    "NativeStakingFeeAccumulatorProxy",
    "FeeAccumulator"
  );
  const vault = await resolveContract("OETHVaultProxy", "IVault");

  const { chainId } = await ethers.provider.getNetwork();

  const wethAddress = addresses[networkMap[chainId]].WETH;
  const weth = await ethers.getContractAt("IERC20", wethAddress);
  const ssvAddress = addresses[networkMap[chainId]].SSV;
  const ssv = await ethers.getContractAt("IERC20", ssvAddress);

  const checkBalance = await strategy.checkBalance(wethAddress, { blockTag });
  const wethStrategyBalance = await weth.balanceOf(strategy.address, {
    blockTag,
  });
  const ssvStrategyBalance = await ssv.balanceOf(strategy.address, {
    blockTag,
  });
  const ethStrategyBalance = await ethers.provider.getBalance(strategy.address);
  const ethFeeAccumulatorBalance = await ethers.provider.getBalance(
    feeAccumulator.address
  );

  console.log(
    `Active validators        : ${await strategy.activeDepositedValidators({
      blockTag,
    })}`
  );
  console.log(
    `Strategy balance         : ${formatUnits(
      checkBalance
    )} ether, ${checkBalance} wei`
  );
  console.log(
    `Strategy ETH             : ${formatUnits(
      ethStrategyBalance
    )} ether, ${ethStrategyBalance} wei`
  );
  console.log(
    `Fee accumulator ETH      : ${formatUnits(
      ethFeeAccumulatorBalance
    )} ether, ${ethFeeAccumulatorBalance} wei`
  );
  console.log(
    `Deposited WETH           : ${formatUnits(
      await strategy.depositedWethAccountedFor({
        blockTag,
      })
    )}`
  );
  console.log(`Strategy WETH            : ${formatUnits(wethStrategyBalance)}`);
  console.log(`Strategy SSV             : ${formatUnits(ssvStrategyBalance)}`);

  const stakeETHThreshold = await strategy.stakeETHThreshold({ blockTag });
  const stakeETHTally = await strategy.stakeETHTally({ blockTag });

  console.log(`Stake ETH Tally          : ${formatUnits(stakeETHTally)}`);
  console.log(`Stake ETH Threshold      : ${formatUnits(stakeETHThreshold)}`);

  if (admin) {
    console.log(
      `Staking monitor          : ${await strategy.stakingMonitor()}`
    );
    console.log(
      `Validator registrator    : ${await strategy.validatorRegistrator()}`
    );
    console.log(`Governor                 : ${await strategy.governor()}`);
    console.log(`Strategist               : ${await vault.strategistAddr()}`);
    console.log(`Native staking strategy  : ${strategy.address}`);
    console.log(`Fee accumulator          : ${feeAccumulator.address}`);
  }
}

module.exports = {
  validatorOperationsConfig,
  registerValidators,
  stakeValidators,
  exitValidator,
  doAccounting,
  resetStakeETHTally,
  setStakeETHThreshold,
  fixAccounting,
  pauseStaking,
  snapStaking,
};
