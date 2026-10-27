import { ethers } from "ethers";
import { action } from "../lib/action";
import {
  ADAPTER_ABI,
  MASTER_ABI,
  MSG,
  OETH_VAULT_ABI,
  REMOTE_ABI,
  ccipLink,
  claimReadiness,
  claimTopUp,
  encodePayload,
  peerProvider,
  quoteFee,
  revertReason,
} from "../lib/oethbV3";
import { logTxDetails } from "../../utils/txLogger";
// CJS util.
import addresses from "../../utils/addresses";

/**
 * Moves OETHb V3 withdrawals along on Base. Sends a transaction only when there
 * is something to do, so it is safe to run often:
 *   A. Finish a Superbridge message that reached Master before its ETH
 *      (`processStoredMessage`, anyone may call it).
 *   B. Start leg 2 of a withdrawal (`Master.triggerClaim`, operator only) once
 *      Remote's OETH queue request is claimable. Triggering early only earns
 *      a NACK: two CCIP fees and another round trip.
 */

const fmt = ethers.utils.formatEther;

action({
  name: "oethbV3SettleWithdrawal",
  description:
    "Finish stored Superbridge messages and trigger leg 2 of OETHb V3 Master withdrawals once claimable",
  chains: [8453],
  params: (t) => {
    t.addFlag("dryrun", "Simulate without broadcasting");
  },
  run: async ({ signer, args, log }) => {
    const dryrun = !!args.dryrun;
    const provider = signer.provider!;
    const masterAddr = addresses.base.OETHbV3MasterStrategy;
    const master = new ethers.Contract(masterAddr, MASTER_ABI, signer);
    const superbridge = new ethers.Contract(
      addresses.base.OETHbV3SuperbridgeAdapter,
      ADAPTER_ABI,
      signer
    );

    // --- A. Finish a stored Superbridge message --------------------------
    if (await superbridge.hasPendingMessage(masterAddr)) {
      try {
        await superbridge.callStatic.processStoredMessage(masterAddr);
      } catch (err) {
        const reason = revertReason(err);
        if (reason.includes("Super: tokens not yet landed")) {
          log.info("Stored message is waiting for the canonical ETH");
          return;
        }
        throw new Error(`processStoredMessage reverts: ${reason}`);
      }
      if (dryrun) {
        log.info("Dry run: processStoredMessage simulation succeeded");
        return;
      }
      const tx = await superbridge.processStoredMessage(masterAddr);
      await logTxDetails(tx, "processStoredMessage on OETHb V3 Superbridge");
      return;
    }

    // --- B. Trigger leg 2 ------------------------------------------------
    const pending = await master.pendingWithdrawalAmount();
    if (pending.isZero()) {
      log.info("No pending withdrawal");
      return;
    }
    if (await master.isYieldOpInFlight()) {
      log.info(
        `Pending withdrawal of ${fmt(
          pending
        )} WETH, but an operation is still in flight; waiting`
      );
      return;
    }

    const mainnet = peerProvider(1);
    const remoteAddr = addresses.mainnet.OETHbV3RemoteStrategy;
    const remote = new ethers.Contract(remoteAddr, REMOTE_ABI, mainnet);
    const oethVault = new ethers.Contract(
      addresses.mainnet.OETHVaultProxy,
      OETH_VAULT_ABI,
      mainnet
    );
    const [requestId, requestAmount, block] = await Promise.all([
      remote.outstandingRequestId(),
      remote.outstandingRequestAmount(),
      mainnet.getBlock("latest"),
    ]);
    const readiness = await claimReadiness({
      requestId,
      requestAmount,
      now: block.timestamp,
      readRequest: (id) => oethVault.withdrawalRequests(id),
      readDelay: () => oethVault.withdrawalClaimDelay(),
      simulateClaim: (id) =>
        oethVault.callStatic.claimWithdrawal(id, { from: remoteAddr }),
    });
    if (!readiness.ready) {
      log.info(`${readiness.reason}; waiting`);
      return;
    }
    log.info(`Pending withdrawal of ${fmt(pending)} WETH: ${readiness.reason}`);

    const ccip = new ethers.Contract(
      addresses.base.OETHbV3CCIPAdapter,
      ADAPTER_ABI,
      provider
    );
    const nonce = await master.lastYieldNonce();
    const fee = await quoteFee(
      ccip,
      masterAddr,
      encodePayload(MSG.WITHDRAW_CLAIM, nonce.add(1))
    );
    const pool = await provider.getBalance(masterAddr);
    const value = claimTopUp(pool, fee);
    log.info(
      `CCIP fee ${fmt(fee)} ETH; Master pool ${fmt(pool)} ETH; top-up ${fmt(
        value
      )} ETH`
    );

    await master.callStatic.triggerClaim({ value });
    if (dryrun) {
      log.info("Dry run: triggerClaim simulation succeeded, not broadcasting");
      return;
    }
    const tx = await master.triggerClaim({ value });
    await logTxDetails(tx, "triggerClaim on OETHb V3 Master");
    log.info(`CCIP message: ${ccipLink(tx.hash)}`);
  },
});
