const fs = require("fs");
const fetch = require("node-fetch");

const log = require("./logger")("utils:beacon");

/// They following use Lodestar API calls

const getValidatorBalance = async (pubkey) => {
  const client = await configClient();

  log(`Fetching validator details for ${pubkey} from the beacon node`);
  const validatorRes = await client.beacon.getStateValidator({
    stateId: "head",
    validatorId: pubkey,
  });
  if (!validatorRes.ok) {
    console.error(validatorRes);
    throw Error(
      `Failed to get validator details for ${pubkey}. Status ${validatorRes.status} ${validatorRes.statusText}`
    );
  }

  const values = validatorRes.value();
  log(validatorRes.value());
  log(`Got balance ${values.balance} for validator ${values.index}`);
  return values.balance;
};

const getSlot = async (blockId = "head") => {
  const client = await configClient();

  // Get the latest beacon block data using Lodestar
  log(`Fetching block header for blockId ${blockId} from the beacon node`);
  const blockHeaderRes = await client.beacon.getBlockHeader({
    blockId,
  });
  if (!blockHeaderRes.ok) {
    console.error(blockHeaderRes);
    throw Error(
      `Failed to get block header for blockId ${blockId}. Status ${blockHeaderRes.status} ${blockHeaderRes.statusText}`
    );
  }

  const slot = blockHeaderRes.value().header.message.slot;
  log(`Got slot ${slot} for block id ${blockId}`);

  return slot;
};

const getBeaconBlockRoot = async (blockId = "head") => {
  const client = await configClient();

  log(
    `Fetching beacon block root for block id ${blockId} from the beacon node`
  );
  const blockHeaderRes = await client.beacon.getBlockRoot({
    blockId,
  });
  if (!blockHeaderRes.ok) {
    console.error(blockHeaderRes);
    throw Error(
      `Failed to get beacon block root for block id ${blockId}. Status ${blockHeaderRes.status} ${blockHeaderRes.statusText}`
    );
  }

  const root = blockHeaderRes.root;
  log(`Got beacon block root ${root} for block id ${blockId}`);

  return root;
};

const getBeaconBlock = async (slot = "head") => {
  const client = await configClient();

  const { ssz } = await import("@lodestar/types");
  const BeaconBlock = ssz.electra.BeaconBlock;
  const BeaconState = ssz.electra.BeaconState;

  // Get the beacon block for the slot from the beacon node.
  log(`Fetching block for slot ${slot} from the beacon node`);
  const blockRes = await client.beacon.getBlockV2({ blockId: slot });
  if (!blockRes.ok) {
    console.error(blockRes);
    throw new Error(
      `Failed to get beacon block for slot ${slot}. It could be because the slot was missed or the provider URL does not support beacon chain API. Error: ${blockRes.status} ${blockRes.statusText}`
    );
  }

  const blockView = BeaconBlock.toView(blockRes.value().message);

  // Read the state from a local file or fetch it from the beacon node.
  let stateSsz;
  const stateFilename = `./cache/state_${blockView.slot}.ssz`;
  if (fs.existsSync(stateFilename)) {
    log(`Loading state from file ${stateFilename}`);
    stateSsz = fs.readFileSync(stateFilename);
  } else {
    log(`Fetching state for slot ${blockView.slot} from the beacon node`);
    const stateRes = await client.debug.getStateV2(
      { stateId: blockView.slot },
      "ssz"
    );
    if (!stateRes.ok) {
      console.error(stateRes);
      throw new Error(
        `Failed to get state for slot ${blockView.slot}. Probably because it was missed. Error: ${stateRes.status} ${stateRes.statusText}`
      );
    }

    log(`Writing state to file ${stateFilename}`);
    fs.writeFileSync(stateFilename, stateRes.ssz());
    stateSsz = stateRes.ssz();
  }

  const stateView = BeaconState.deserializeToView(stateSsz);

  const blockTree = blockView.tree.clone();
  const stateRootGIndex = blockView.type.getPropertyGindex("stateRoot");
  // Patching the tree by attaching the state in the `stateRoot` field of the block.
  blockTree.setNode(stateRootGIndex, stateView.node);

  return { blockTree, blockView, stateView };
};

const concatProof = (proof) => {
  const witnessLength = proof.witnesses.length;
  const witnessBytes = new Uint8Array(witnessLength * 32);
  for (let i = 0; i < witnessLength; i++) {
    witnessBytes.set(proof.witnesses[i], i * 32);
  }
  return witnessBytes;
};

const hashPubKey = (pubKey) => {
  // Ensure pubKey is a hex string or Buffer
  const pubKeyBytes = ethers.utils.arrayify(pubKey);

  // Create 16 bytes of zeros
  const zeroBytes = ethers.utils.hexZeroPad("0x0", 16);

  // Concatenate pubKey and zero bytes
  const concatenated = ethers.utils.concat([pubKeyBytes, zeroBytes]);

  // Compute SHA256 hash
  return ethers.utils.sha256(concatenated);
};

const configClient = async () => {
  // Get the latest slot from the beacon chain API
  // Dynamically import the Lodestar API client as its an ESM module
  const { getClient } = await import("@lodestar/api");
  const { config } = await import("@lodestar/config/default");

  const baseUrl = process.env.PROVIDER_URL;

  const client = await getClient({ baseUrl, timeoutMs: 60000 }, { config });

  return client;
};

/// The following connect directly to the BeaconChain API
/// They could be replaced with Lodestar API calls in the future.

const getValidator = async (pubkey) => {
  return await beaconchainRequest(`validator/${pubkey}`);
};

const getValidators = async (pubkeys, beaconChainApiKey) => {
  const encodedPubkeys = encodeURIComponent(pubkeys);
  return await beaconchainRequest(
    `validator/${encodedPubkeys}`,
    beaconChainApiKey
  );
};

const getEpoch = async (epochId = "latest") => {
  return await beaconchainRequest(`epoch/${epochId}`);
};

const beaconchainRequest = async (endpoint) => {
  const API_URL =
    process.env.BEACON_PROVIDER_URL || "https://beaconcha.in/api/v1/";
  const apikey = process.env.BEACONCHAIN_API_KEY;
  const url = `${API_URL}${endpoint}`;
  if (!apikey) {
    throw new Error(
      "Set BEACONCHAIN_API_KEY in order to be able to query the API"
    );
  }

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey,
  };

  log(`About to call Beacon API: ${url} `);

  const rawResponse = await fetch(url, {
    method: "GET",
    headers,
  });

  const response = await rawResponse.json();
  if (response.status != "OK") {
    log(`Call to Beacon API failed: ${url}`);
    log(`response: `, response);
    throw new Error(
      `Call to Beacon API failed. Error: ${JSON.stringify(response.status)}`
    );
  } else {
    log(`GET request to Beacon API succeeded. Response: `, response);
  }

  return response.data;
};

module.exports = {
  concatProof,
  getBeaconBlock,
  getSlot,
  getBeaconBlockRoot,
  getValidator,
  getValidators,
  getValidatorBalance,
  getEpoch,
  hashPubKey,
};
