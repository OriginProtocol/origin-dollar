// viem port of the beacon block/state helpers from utils/beacon.js.
//
// The beacon proof engine is SSZ (@chainsafe/persistent-merkle-tree +
// @lodestar/types), NOT ethers. The only ethers usage in the original
// getBeaconBlock path is `ethers.utils.hexlify` (display only) which is
// replaced here with viem's `toHex`. The Lodestar beacon-node client
// (getBlockV2 for the block fetch) is kept as-is — it is not ethers.
//
// FIX vs the original utils/beacon.js: getBeaconBlock hardcoded
// `ssz.electra.BeaconBlock` / `ssz.electra.BeaconState` for mainnet. Current
// mainnet beacon data is post-FULU, so electra deserialization fails. Here the
// fork types are selected by the beacon block's slot via the Lodestar config's
// `getForkTypes(slot)`, which returns `fulu.*` for current mainnet and the
// correct pre-fork types for historical slots. The cached mainnet states
// (cache/state_14465000.ssz, cache/state_14471000.ssz) are FULU and
// deserialize correctly with this selection.

import fs from "node:fs";
import { toHex as viemToHex } from "viem";

const log = require("../../../utils/logger")("utils:beacon");

const fetchImpl =
  typeof globalThis.fetch === "function"
    ? globalThis.fetch.bind(globalThis)
    : (...args: Parameters<typeof fetch>) =>
        import("node-fetch").then(({ default: f }) =>
          (f as never as typeof fetch)(...args)
        );

/**
 * Gets a Lodestar API client (ESM-only, so dynamically imported).
 * Faithful copy of `configClient` in utils/beacon.js.
 */
const configClient = async () => {
  const { getClient } = await import("@lodestar/api");
  const { config } = await import("@lodestar/config/default");

  const baseUrl = process.env.BEACON_PROVIDER_URL;

  const client = await getClient({ baseUrl, timeoutMs: 60000 }, { config });

  return client;
};

/**
 * Get the slot for a given block identifier.
 * Faithful copy of `getSlot` in utils/beacon.js.
 * @param blockId - "head", a slot number or a beacon block root.
 */
export const getSlot = async (blockId: string | number = "head") => {
  const client = await configClient();

  log(`Fetching block header for blockId ${blockId} from the beacon node`);
  const blockHeaderRes = await client.beacon.getBlockHeader({
    blockId: blockId as never,
  });
  if (!blockHeaderRes.ok) {
    // eslint-disable-next-line no-console
    console.error(blockHeaderRes);
    throw Error(
      `Failed to get block header for blockId ${blockId}. Status ${blockHeaderRes.status} ${blockHeaderRes.statusText}`
    );
  }

  const slot = blockHeaderRes.value().header.message.slot;
  log(`Got slot ${slot} for block id ${blockId}`);

  return slot;
};

/**
 * Gets the full beacon chain data for a given slot, root or "head".
 *
 * Viem port of `getBeaconBlock` in utils/beacon.js. The Lodestar block fetch
 * (getBlockV2) is unchanged. The SSZ fork types are selected by slot rather
 * than hardcoded to electra (the pre-existing bug), which makes current
 * post-FULU mainnet data deserialize correctly.
 *
 * @param slot - "head", a slot number or a beacon block root.
 * @param _networkName - kept for signature parity with the original; fork
 *   selection is now driven by the block slot, not the network name.
 */
export const getBeaconBlock = async (
  slot: string | number = "head",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _networkName = "mainnet"
) => {
  const client = await configClient();

  const { ssz } = await import("@lodestar/types");
  const { config } = await import("@lodestar/config/default");

  // Get the beacon block for the slot from the beacon node.
  log(`Fetching block for slot ${slot} from the beacon node`);
  const blockRes = await client.beacon.getBlockV2({ blockId: slot as never });
  if (!blockRes.ok) {
    // eslint-disable-next-line no-console
    console.error(blockRes);
    throw new Error(
      `Failed to get beacon block for id ${slot}. It could be because the slot was missed or the provider URL does not support beacon chain API. Error: ${blockRes.status} ${blockRes.statusText}`
    );
  }

  const message = blockRes.value().message;
  // Select the fork types by the block's slot (fixes the electra hardcode).
  const { BeaconBlock, BeaconState } = forkTypesForSlot(
    ssz,
    config,
    Number(message.slot)
  );

  const blockView = BeaconBlock.toView(message as never);

  const stateFilename = `./cache/state_${blockView.slot}.ssz`;
  const fetchStateSsz = async () => {
    log(`Fetching state for slot ${blockView.slot} from the beacon node`);

    // Bypass the Lodestar API client and fetch beacon state SSZ directly.
    // (Same rationale as the original: the client's Accept header lets the node
    // reply with a JSON content-type over binary SSZ, which then throws in
    // TextDecoder. Requesting SSZ-only and reading an ArrayBuffer avoids it.)
    let base = process.env.BEACON_PROVIDER_URL;
    if (!base) {
      throw new Error(
        `BEACON_PROVIDER_URL is not set and no cached state exists at ${stateFilename}`
      );
    }
    if (!base.endsWith("/")) base += "/";
    const stateUrl = `${base}eth/v2/debug/beacon/states/${blockView.slot}`;
    const parsedUrl = new URL(stateUrl);
    const headers: Record<string, string> = {
      Accept: "application/octet-stream",
    };
    if (parsedUrl.username || parsedUrl.password) {
      const creds = `${decodeURIComponent(
        parsedUrl.username
      )}:${decodeURIComponent(parsedUrl.password)}`;
      headers.Authorization = `Basic ${Buffer.from(creds).toString("base64")}`;
      parsedUrl.username = "";
      parsedUrl.password = "";
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    let response: Response;
    try {
      response = await fetchImpl(parsedUrl.toString(), {
        method: "GET",
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(
        `Failed to get state for slot ${blockView.slot}. Probably because it was missed. Error: ${response.status} ${response.statusText}`
      );
    }

    const stateSszBytes = new Uint8Array(await response.arrayBuffer());

    log(`Writing state to file ${stateFilename}`);
    fs.writeFileSync(stateFilename, stateSszBytes);
    return stateSszBytes;
  };

  // Read the state from a local file or fetch it from the beacon node.
  let stateSsz: Uint8Array;
  if (fs.existsSync(stateFilename)) {
    log(`Loading state from file ${stateFilename}`);
    stateSsz = fs.readFileSync(stateFilename);
  } else {
    stateSsz = await fetchStateSsz();
  }

  let stateView;
  try {
    stateView = BeaconState.deserializeToView(stateSsz);
  } catch (err) {
    if (!fs.existsSync(stateFilename)) {
      throw err;
    }

    log(
      `Failed to deserialize cached state ${stateFilename}, refetching fresh state`
    );
    stateSsz = await fetchStateSsz();
    stateView = BeaconState.deserializeToView(stateSsz);
  }

  const blockTree = blockView.tree.clone();
  const stateRootGIndex = blockView.type.getPropertyGindex("stateRoot");
  // Patching the tree by attaching the state in the `stateRoot` field of the block.
  blockTree.setNode(stateRootGIndex, stateView.node);

  return { blockTree, blockView, stateView };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ssz = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Config = any;

/**
 * Selects the SSZ BeaconBlock/BeaconState types for a given slot.
 *
 * Prefers the Lodestar config's `getForkTypes(slot)` (fork-accurate and
 * future-proof). Falls back to the fork name (`getForkName(slot)`) mapped onto
 * the `ssz.<fork>` namespace, and finally to `ssz.fulu` (current mainnet fork)
 * so post-FULU cached states always deserialize.
 */
function forkTypesForSlot(ssz: Ssz, config: Config, slot: number) {
  if (typeof config?.getForkTypes === "function") {
    const types = config.getForkTypes(slot);
    if (types?.BeaconBlock && types?.BeaconState) {
      return { BeaconBlock: types.BeaconBlock, BeaconState: types.BeaconState };
    }
  }

  if (typeof config?.getForkName === "function") {
    const forkName = config.getForkName(slot) as keyof typeof ssz;
    const forkTypes = ssz[forkName];
    if (forkTypes?.BeaconBlock && forkTypes?.BeaconState) {
      return {
        BeaconBlock: forkTypes.BeaconBlock,
        BeaconState: forkTypes.BeaconState,
      };
    }
  }

  // Current mainnet fork. FIX vs original which hardcoded electra.
  return {
    BeaconBlock: ssz.fulu.BeaconBlock,
    BeaconState: ssz.fulu.BeaconState,
  };
}

/**
 * Re-export of viem's toHex for display-only formatting, replacing the
 * `ethers.utils.hexlify` used in the original for logging/normalization.
 * NOTE: this is viem's toHex, which for a Uint8Array yields the same 0x-hex
 * as ethers.utils.hexlify. It is only used for human-readable output here.
 */
export const toHex = viemToHex;
