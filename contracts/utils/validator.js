const fetch = require("node-fetch");
const { ethers } = require("ethers");
const { defaultAbiCoder, formatUnits, hexDataSlice, parseEther, keccak256 } =
  require("ethers").utils;
const { v4: uuidv4 } = require("uuid");

const { storePrivateKeyToS3 } = require("./amazon");
const { sleep } = require("./time");
const { p2pApiEncodedKey } = require("./constants");
const { mainnet } = require("./addresses");
const { logTxDetails } = require("./txLogger");

const log = require("./logger")("task:p2p");

const validatorStateEnum = {
  0: "NOT_REGISTERED",
  1: "REGISTERED",
  2: "STAKED",
  3: "EXITED",
  4: "EXIT_COMPLETE",
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
  uuid,
  maxValidatorsToRegister,
  ssvAmount,
  awsS3AccessKeyId,
  awsS3SexcretAccessKeyId,
  s3BucketName,
}) => {
  if (uuid && clear) {
    throw new Error(`Can not clear state and use a uuid at the same time.`);
  }
  let currentState;
  if (!uuid) {
    // If starting a new registration or restarting a failed one
    currentState = await getState(store);
    log("currentState", currentState);
  } else {
    // If restarting a registration that failed to get the SSV request status
    await clearState(uuid, store);
    await updateState(uuid, "validator_creation_issued", store);
    currentState = await getState(store);
    log(`Processing uuid: ${uuid}`);
  }

  // If clearing the local storage so a new registration can be started
  if (clear && currentState?.uuid) {
    await clearState(currentState.uuid, store);
    currentState = undefined;
  }

  // Calculate how many validators can be staked to
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
    maxValidatorsToRegister === undefined ||
    validatorsForEth < maxValidatorsToRegister
      ? validatorsForEth
      : maxValidatorsToRegister;
  log(`validatorsCount: ${validatorsCount}`);

  // Check if this Native Staking Contract is not paused
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

      log(`Waiting for 5 seconds...`);
      await sleep(5000);
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
  log(`About to create a SSV validator request with uuid: ${uuid}`);
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

  log(`About to wait for 90 seconds for the P2P API to process the request...`);
  await sleep(90000);
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
  if (tx.status !== 1) {
    throw Error(
      `Transaction with hash "${txHash}" failed for method "${methodName}" and uuid "${uuid}"`
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
  try {
    log(`About to stake ETH with:`);

    // Check none of the validators are already registered
    await depositFrontRunCheck(pubkeys, nativeStakingStrategy.provider);

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

const depositFrontRunCheck = async (pubkeys, provider) => {
  const latestBlock = await provider.getBlockNumber();

  // Create a contract instance
  const depositContract = new ethers.Contract(
    // Address
    mainnet.beaconChainDepositContract,
    // ABI
    [
      "event DepositEvent(bytes pubkey, bytes withdrawal_credentials, bytes amount, bytes signature, bytes index)",
    ],
    provider
  );

  // Check the events from the last 1000 blocks
  const recentBlocks = 1000;
  const filter = {
    address: depositContract.address,
    topics: [
      "0x649bbc62d0e31342afea4e5cd82d4049e7e1ee912fc0889aa790803be39038c5",
    ],
    fromBlock: latestBlock - recentBlocks,
    toBlock: "latest",
  };
  const logs = await provider.getLogs(filter);
  log(`Checking ${logs.length} logs for duplicate deposits of public keys:`);
  log(pubkeys);

  for (const eventLog of logs) {
    const parsedLog = depositContract.interface.parseLog(eventLog);
    const eventPubkey = parsedLog.args.pubkey;

    if (pubkeys.includes(eventPubkey.toLowerCase())) {
      throw Error(`Validator with pubkey ${eventPubkey} has already deposited`);
    }
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

  // Check the first validator has not already been registered
  const hashedPubkey = keccak256(metadata.pubkeys[0]);
  const status = await nativeStakingStrategy.validatorsStates(hashedPubkey);
  if (validatorStateEnum[status] !== "NOT_REGISTERED") {
    log(
      `Validator with pubkey ${metadata.pubkeys[0]} is not in NOT_REGISTERED state. Current state: ${validatorStateEnum[status]}`
    );
    throw Error(
      `public key has already been registered for uuid ${uuid}: ${metadata.pubkeys[0]} `
    );
  }

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

    await logTxDetails(tx, "registerSsvValidators");

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
      // Will not clear the state
      throw new Error(`Failed P2P API call after ${attempts} attempts.`);
    }
    await sleep(3000);
  }
};

module.exports = {
  registerValidators,
  stakeValidators,
  validatorsThatCanBeStaked,
};
