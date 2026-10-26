import { ethers } from "ethers";
import { action, types } from "../lib/action";
import type { Logger } from "../lib/action";
import { getContract } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

/**
 * Redeems the Super OETH (OETHb) protocol fees on the Base fee Safe for WETH
 * through the vault's withdrawal queue and bridges the WETH over CCIP to the
 * Ethereum FeeSplitter, where it joins the OUSD/OETH fees on their way to xOGN.
 *
 * BaseFeeBridgeModule keeps at most one request open and fixes the CCIP
 * destination, so a bug here cannot send the fees anywhere else. This action
 * decides when to act and sends a transaction only when it will do something:
 *   1. If a request is pending, claim and bridge it once it is claimable;
 *      otherwise wait. A new request is never opened while one is pending.
 *   2. With nothing pending, open a new request at most once per interval, and
 *      only when the flat CCIP fee is a small share of the amount.
 */

const MODULE_ABI = [
  "function safeContract() view returns (address)",
  "function vault() view returns (address)",
  "function pendingRequestId() view returns (uint256)",
  "function hasPendingRequest() view returns (bool)",
  "function lastRequestAt() view returns (uint256)",
  "function MIN_WITHDRAWAL_AMOUNT() view returns (uint256)",
  "function bridgeFee(uint256 wethAmount) view returns (uint256)",
  "function requestWithdrawal(uint256 oethbAmount)",
  "function claimAndBridge()",
];

const VAULT_ABI = [
  "function oToken() view returns (address)",
  "function withdrawalClaimDelay() view returns (uint256)",
  "function claimWithdrawal(uint256 requestId) returns (uint256)",
  "function withdrawalRequests(uint256) view returns (tuple(address withdrawer, bool claimed, uint40 timestamp, uint128 amount, uint128 queued))",
];

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

const DAY = 24 * 60 * 60;

/** Warn when the Safe's ETH covers fewer than this many CCIP fees. */
const LOW_SAFE_ETH_FEES = 3;

function revertReason(err: unknown): string {
  const e = err as {
    reason?: string;
    error?: { message?: string };
    message?: string;
  };
  return e.reason || e.error?.message || e.message || String(err);
}

async function checkSafeEth(
  provider: ethers.providers.Provider,
  safe: string,
  fee: ethers.BigNumber,
  log: Logger
) {
  const safeEth = await provider.getBalance(safe);
  if (safeEth.lt(fee)) {
    throw new Error(
      `Fee Safe has ${ethers.utils.formatEther(safeEth)} ETH, ` +
        `less than the ${ethers.utils.formatEther(fee)} ETH CCIP fee; top it up`
    );
  }
  if (safeEth.lt(fee.mul(LOW_SAFE_ETH_FEES))) {
    log.warn(
      `Fee Safe ETH covers fewer than ${LOW_SAFE_ETH_FEES} CCIP fees; top it up`
    );
  }
}

action({
  name: "bridgeBaseFees",
  description:
    "Redeem Base OETHb fees for WETH and bridge them to the Ethereum FeeSplitter",
  chains: [8453],
  params: (t) => {
    t.addOptionalParam(
      "maxFeeBps",
      "Only open a request when the CCIP fee is at most this share of it",
      100,
      types.int
    );
    t.addOptionalParam(
      "minIntervalDays",
      "Minimum days between withdrawal requests",
      7,
      types.int
    );
    t.addOptionalParam(
      "dryrun",
      "Simulate without broadcasting",
      false,
      types.boolean
    );
  },
  run: async ({ signer, args, log }) => {
    const dryrun = !!args.dryrun;
    const maxFeeBps = Number(args.maxFeeBps);
    const minInterval = Number(args.minIntervalDays) * DAY;

    const { address: moduleAddr } = await getContract("BaseFeeBridgeModule");
    const module = new ethers.Contract(moduleAddr, MODULE_ABI, signer);
    const provider = signer.provider!;

    const [safe, vaultAddr] = await Promise.all([
      module.safeContract(),
      module.vault(),
    ]);
    const vault = new ethers.Contract(vaultAddr, VAULT_ABI, provider);
    const now = (await provider.getBlock("latest")).timestamp;

    // --- 1. Claim and bridge a pending request ---------------------------
    if (await module.hasPendingRequest()) {
      const requestId = await module.pendingRequestId();
      const [request, delay] = await Promise.all([
        vault.withdrawalRequests(requestId),
        vault.withdrawalClaimDelay(),
      ]);
      // A Safe owner can claim the request directly on the vault. The claim
      // simulation below would then revert with "Already claimed" and read as
      // "not yet", so the action would wait forever and never open a new one.
      if (request.claimed) {
        throw new Error(
          `Request ${requestId} was claimed outside the module; the fee Safe ` +
            `must call clearPendingRequest() on BaseFeeBridgeModule (and ` +
            `handle the WETH that claim left on the Safe)`
        );
      }
      const claimableAt = Number(request.timestamp) + delay.toNumber();
      if (now < claimableAt) {
        log.info(
          `Request ${requestId} claimable in ${claimableAt - now}s; waiting`
        );
        return;
      }

      // The claim also needs queue liquidity, which only a simulation can
      // confirm. A revert here just means "not yet", so wait without a tx.
      try {
        await module.callStatic.claimAndBridge();
      } catch (err) {
        // The module only sees that the Safe call failed. Simulating the claim
        // as the Safe tells "not yet" (a vault revert) apart from a real
        // problem past the claim, such as the Safe not covering the CCIP fee.
        let vaultReason: string | undefined;
        try {
          await vault.callStatic.claimWithdrawal(requestId, { from: safe });
        } catch (vaultErr) {
          vaultReason = revertReason(vaultErr);
        }
        if (vaultReason === undefined) {
          throw new Error(
            `Request ${requestId} is claimable but claimAndBridge reverts: ${revertReason(
              err
            )}`
          );
        }
        log.info(
          `Request ${requestId} not claimable yet (${vaultReason}); waiting`
        );
        return;
      }

      // Not fee-gated: the request is already open, and WETH idle on the Safe
      // helps no one.
      const fee = await module.bridgeFee(request.amount);
      await checkSafeEth(provider, safe, fee, log);
      log.info(
        `Claiming request ${requestId} and bridging ` +
          `${ethers.utils.formatEther(request.amount)} WETH ` +
          `(CCIP fee ${ethers.utils.formatEther(fee)} ETH)`
      );
      if (dryrun) {
        log.info("Dry run: claim simulation succeeded, not broadcasting");
        return;
      }
      const tx = await module.claimAndBridge();
      await logTxDetails(tx, "claimAndBridge on BaseFeeBridgeModule");
      await tx.wait();
    }

    // --- 2. Open a new request -------------------------------------------
    const lastRequestAt = (await module.lastRequestAt()).toNumber();
    if (lastRequestAt > 0 && now - lastRequestAt < minInterval) {
      const nextAt = new Date((lastRequestAt + minInterval) * 1000);
      log.info(`Next request not before ${nextAt.toISOString()}`);
      return;
    }

    const oethb = new ethers.Contract(
      await vault.oToken(),
      ERC20_ABI,
      provider
    );
    const amount = await oethb.balanceOf(safe);
    log.info(
      `Fee Safe ${safe} holds ${ethers.utils.formatEther(amount)} OETHb`
    );
    const minAmount = await module.MIN_WITHDRAWAL_AMOUNT();
    if (amount.lt(minAmount)) {
      log.info(
        `Below the module's ${ethers.utils.formatEther(
          minAmount
        )} OETHb minimum; nothing to redeem`
      );
      return;
    }

    // The redeem is 1:1, so the WETH that will be bridged is known now. The
    // CCIP fee is roughly flat per message, so wait for a bigger batch rather
    // than pay it on a small one.
    const fee = await module.bridgeFee(amount);
    const feeBps = fee.mul(10_000).div(amount).toNumber();
    log.info(
      `CCIP fee ${ethers.utils.formatEther(
        fee
      )} ETH (${feeBps} bps of the amount)`
    );
    if (feeBps > maxFeeBps) {
      log.info(`Above the ${maxFeeBps} bps maximum; waiting for more fees`);
      return;
    }

    await module.callStatic.requestWithdrawal(amount);
    if (dryrun) {
      log.info("Dry run: request simulation succeeded, not broadcasting");
      return;
    }
    const tx = await module.requestWithdrawal(amount);
    await logTxDetails(tx, "requestWithdrawal on BaseFeeBridgeModule");
  },
});
