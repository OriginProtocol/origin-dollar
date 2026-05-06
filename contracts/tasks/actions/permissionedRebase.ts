import { ethers as ethersLib } from "ethers";
import { action } from "../lib/action";
import { logTxDetails } from "../../utils/txLogger";

// PermissionedRebase Safe module addresses, keyed by chain id. The contract
// source lives in a PR not yet merged into this branch — until that lands and
// the module gets a Hardhat deployment artifact, addresses are pinned here.
const MODULES_BY_CHAIN_ID: Record<number, string> = {
  1: "0xB3bCfA33C54fa4D18146196eDfB404BD036a52a6", // Ethereum
  8453: "0xf633980A61E9F90a41d030676059Dc201D9d4A37", // Base
  146: "0x77121911A387c9e4Eae46345E0f831A6da8a1364", // Sonic
};

const PERMISSIONED_REBASE_ABI = ["function permissionedRebase() external"];

action({
  name: "permissionedRebase",
  description:
    "Call permissionedRebase() on the PermissionedRebase Safe module on the current chain (Ethereum / Base / Sonic). The module unpauses, rebases, and re-pauses every vault it manages atomically.",
  chains: [1, 8453, 146],
  run: async ({ signer, chainId, networkName, log }) => {
    const moduleAddress = MODULES_BY_CHAIN_ID[chainId];
    if (!moduleAddress) {
      throw new Error(
        `No PermissionedRebase module address configured for ${networkName} (${chainId})`
      );
    }

    log.info(
      `Calling permissionedRebase on ${networkName} module at ${moduleAddress}`
    );

    const module = new ethersLib.Contract(
      moduleAddress,
      PERMISSIONED_REBASE_ABI,
      signer
    );
    const tx = await module.permissionedRebase();
    await logTxDetails(tx, "permissionedRebase");
  },
});
