const fs = require("fs");

const log = require("./logger")("utils:beacon");

const getClient = async () => {
  // Get the latest slot from the beacon chain API
  // Dynamically import the Lodestar API client as its an ESM module
  const { getClient } = await import("@lodestar/api");
  const { config } = await import("@lodestar/config/default");

  const baseUrl = process.env.PROVIDER_URL;
  const client = await getClient({ baseUrl, timeoutMs: 60000 }, { config });

  return client;
};

const getCurrentSlot = async () => {
  const client = await getClient();

  // Get the latest beacon block data using Lodestar
  const blockHeaderRes = await client.beacon.getBlockHeader({
    blockId: "head",
  });
  if (!blockHeaderRes.ok) {
    throw blockHeaderRes.error;
  }

  const currentSlot = blockHeaderRes.value().header.message.slot;
  log(`Got slot ${currentSlot} at head`);

  return currentSlot;
};

const getBeaconBlock = async (slot) => {
  const client = await getClient();

  const { ssz } = await import("@lodestar/types");
  const BeaconBlock = ssz.electra.BeaconBlock;
  const BeaconState = ssz.electra.BeaconState;

  // Get the beacon block for the slot from the beacon node.
  log(`Fetching block for slot ${slot} from the beacon node`);
  const blockRes = await client.beacon.getBlockV2({ blockId: slot });
  if (!blockRes.ok) {
    throw blockRes.error;
  }

  const blockView = BeaconBlock.toView(blockRes.value().message);

  // Read the state from a local file or fetch it from the beacon node.
  let stateSsz;
  const stateFilename = `./cache/state_${slot}.ssz`;
  if (fs.existsSync(stateFilename)) {
    log(`Loading state from file ${stateFilename}`);
    stateSsz = fs.readFileSync(stateFilename);
  } else {
    log(`Fetching state for slot ${slot} from the beacon node`);
    const stateRes = await client.debug.getStateV2({ stateId: slot }, "ssz");
    if (!stateRes.ok) {
      throw stateRes.error;
    }

    fs.writeFileSync(stateFilename, stateRes.ssz());
    stateSsz = stateRes.ssz();
  }
  const stateRes = await client.debug.getStateV2({ stateId: slot }, "ssz");
  if (!stateRes.ok) {
    throw stateRes.error;
  }

  const stateView = BeaconState.deserializeToView(stateSsz);

  const blockTree = blockView.tree.clone();
  const stateRootGIndex = blockView.type.getPropertyGindex("stateRoot");
  // Patching the tree by attaching the state in the `stateRoot` field of the block.
  blockTree.setNode(stateRootGIndex, stateView.node);

  return { blockTree, blockView };
};

const concatProof = (proof) => {
  const witnessLength = proof.witnesses.length;
  const witnessBytes = new Uint8Array(witnessLength * 32);
  for (let i = 0; i < witnessLength; i++) {
    witnessBytes.set(proof.witnesses[i], i * 32);
  }
  return witnessBytes;
};

module.exports = {
  concatProof,
  getBeaconBlock,
  getCurrentSlot,
};
