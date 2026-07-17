import { parseAbi } from "viem";
import { action } from "../lib/viemAction";

// PermissionedRebase Safe module addresses, keyed by chain id. The contract
// source lives in a PR not yet merged into this branch — until that lands and
// the module gets a Hardhat deployment artifact, addresses are pinned here.
const MODULES_BY_CHAIN_ID: Record<number, `0x${string}`> = {
  1: "0xB3bCfA33C54fa4D18146196eDfB404BD036a52a6", // Ethereum
  8453: "0xf633980A61E9F90a41d030676059Dc201D9d4A37", // Base
  146: "0x77121911A387c9e4Eae46345E0f831A6da8a1364", // Sonic
};

const PERMISSIONED_REBASE_ABI = parseAbi([
  "function permissionedRebase() external",
]);

action({
  name: "permissionedRebase",
  description:
    "Collect fixed-rate drippers, then call permissionedRebase() on the " +
    "PermissionedRebase Safe module on the current chain (Ethereum / Base / " +
    "Sonic). The module unpauses, rebases, and re-pauses every vault it " +
    "manages atomically.",
  chains: [1, 8453, 146],
  run: async ({ chainId, networkName, log, resolveContract, writeContract }) => {
    const moduleAddress = MODULES_BY_CHAIN_ID[chainId];
    if (!moduleAddress) {
      throw new Error(
        `No PermissionedRebase module address configured for ${networkName} (${chainId})`
      );
    }

    if (chainId === 1) {
      const dripper = resolveContract({
        deploymentName: "OETHFixedRateDripperProxy",
        abiFrom: { kind: "curated", file: "IDripper" },
      });
      log.info(
        `Calling collect on ${networkName} fixed-rate dripper at ${dripper.address}`
      );
      await writeContract(
        dripper,
        "collect",
        [],
        "OETHFixedRateDripperProxy.collect"
      );
    }

    log.info(
      `Calling permissionedRebase on ${networkName} module at ${moduleAddress}`
    );
    await writeContract(
      { address: moduleAddress, abi: PERMISSIONED_REBASE_ABI },
      "permissionedRebase",
      [],
      "permissionedRebase"
    );
  },
});
