const fs = require("fs");

const log = require("./logger")("utils:beacon");

const configClient = async () => {
  // Get the latest slot from the beacon chain API
  // Dynamically import the Lodestar API client as its an ESM module
  const { getClient } = await import("@lodestar/api");
  const { config } = await import("@lodestar/config/default");

  const baseUrl = process.env.PROVIDER_URL;

  const client = await getClient({ baseUrl, timeoutMs: 60000 }, { config });

  return client;
};

const getSlot = async (blockId = "head") => {
  const client = await configClient();

  // Get the latest beacon block data using Lodestar
  log(`Fetching block header for blockId ${blockId} from the beacon node`);
  const blockHeaderRes = await client.beacon.getBlockHeader({
    blockId,
  });
  if (!blockHeaderRes.ok) {
    console.error(`Failed to get block header for blockId ${blockId}`);
    console.error(blockHeaderRes);
    throw blockHeaderRes.error;
  }

  const slot = blockHeaderRes.value().header.message.slot;
  log(`Got slot ${slot} at ${blockId}`);

  return slot;
};

const getBeaconBlock = async (slot) => {
  const client = await configClient();

  const { ssz } = await import("@lodestar/types");
  const BeaconBlock = ssz.electra.BeaconBlock;
  const BeaconState = ssz.electra.BeaconState;

  // Get the beacon block for the slot from the beacon node.
  log(`Fetching block for slot ${slot} from the beacon node`);
  const blockRes = await client.beacon.getBlockV2({ blockId: slot });
  if (!blockRes.ok) {
    log(blockRes.error);
    throw new Error(
      `Failed to get beacon block for slot ${slot}. Probably because it was missed`,
      {
        cause: blockRes.error,
      }
    );
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
      throw new Error(
        `Failed to get state for slot ${slot}. Probably because it was missed`,
        {
          cause: stateRes.error,
        }
      );
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
  getSlot,
};
