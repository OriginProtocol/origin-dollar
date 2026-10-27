import { ethers } from "ethers";
import { action } from "../lib/action";
import {
  ADAPTER_ABI,
  MASTER_ABI,
  MSG,
  REMOTE_ABI,
  ccipLink,
  encodePayload,
  peerProvider,
  quoteFee,
  reportDecision,
  reportTopUp,
} from "../lib/oethbV3";
import { logTxDetails } from "../../utils/txLogger";
// CJS util.
import addresses from "../../utils/addresses";

/**
 * Sends a balance report from the OETHb V3 Remote strategy (Ethereum) to Master
 * (Base). Reports are the only thing that refreshes Master's
 * `remoteStrategyBalance` between operations, so this runs about every 2 hours.
 *
 * The report pays its CCIP fee from Remote's ETH balance (the fee pool), which
 * also pays for every ack Remote sends. The action tops the pool up in the same
 * transaction when it runs low.
 */

/** Simulated use is about 451k. */
const GAS_LIMIT = 700_000;

const fmt = ethers.utils.formatEther;

action({
  name: "oethbV3BalanceReport",
  description:
    "Send an OETHb V3 Remote balance report to Master on Base, topping up Remote's CCIP fee pool",
  chains: [1],
  params: (t) => {
    t.addFlag("dryrun", "Simulate without broadcasting");
  },
  run: async ({ signer, args, log }) => {
    const dryrun = !!args.dryrun;
    const provider = signer.provider!;
    const remoteAddr = addresses.mainnet.OETHbV3RemoteStrategy;
    const adapterAddr = addresses.mainnet.OETHbV3SuperbridgeAdapter;
    const remote = new ethers.Contract(remoteAddr, REMOTE_ABI, signer);
    const adapter = new ethers.Contract(adapterAddr, ADAPTER_ABI, provider);
    const master = new ethers.Contract(
      addresses.base.OETHbV3MasterStrategy,
      MASTER_ABI,
      peerProvider(8453)
    );

    const [operator, outbound, signerAddr] = await Promise.all([
      remote.operator(),
      remote.outboundAdapter(),
      signer.getAddress(),
    ]);
    if (operator.toLowerCase() !== signerAddr.toLowerCase()) {
      throw new Error(
        `Signer ${signerAddr} is not the Remote operator (${operator})`
      );
    }
    if (outbound.toLowerCase() !== adapterAddr.toLowerCase()) {
      throw new Error(
        `Remote outbound adapter is ${outbound}, expected ${adapterAddr}`
      );
    }

    const [
      masterInFlight,
      masterNonce,
      masterRemoteBalance,
      lastCheck,
      remoteNonce,
      remoteBalance,
    ] = await Promise.all([
      master.isYieldOpInFlight(),
      master.lastYieldNonce(),
      master.remoteStrategyBalance(),
      master.lastBalanceCheckTimestamp(),
      remote.lastYieldNonce(),
      remote.checkBalance(addresses.mainnet.WETH),
    ]);
    log.info(
      `Remote balance ${fmt(remoteBalance)} WETH; Master sees ${fmt(
        masterRemoteBalance
      )} WETH, last report at ${lastCheck} (nonce ${masterNonce})`
    );

    const decision = reportDecision({
      masterInFlight,
      masterNonce,
      remoteNonce,
      remoteBalance,
      masterRemoteBalance,
    });
    if (decision.action === "error") {
      log.error(decision.reason);
      throw new Error(decision.reason);
    }
    if (decision.action === "skip") {
      log.info(`${decision.reason}; not sending a report`);
      return;
    }

    // The fee only depends on the payload length, so a representative body
    // is enough.
    const body = ethers.utils.defaultAbiCoder.encode(
      ["uint256", "uint256"],
      [remoteBalance, Math.floor(Date.now() / 1000)]
    );
    const fee = await quoteFee(
      adapter,
      remoteAddr,
      encodePayload(MSG.BALANCE_REPORT, remoteNonce, body)
    );
    const pool = await provider.getBalance(remoteAddr);
    const value = reportTopUp(pool, fee);
    log.info(
      `CCIP fee ${fmt(fee)} ETH; Remote pool ${fmt(pool)} ETH; top-up ${fmt(
        value
      )} ETH`
    );

    await remote.callStatic.sendBalanceReport({ value });
    if (dryrun) {
      log.info("Dry run: report simulation succeeded, not broadcasting");
      return;
    }
    const tx = await remote.sendBalanceReport({ value, gasLimit: GAS_LIMIT });
    await logTxDetails(tx, "sendBalanceReport on OETHb V3 Remote");
    const poolAfter = await provider.getBalance(remoteAddr);
    log.info(`Remote pool after ${fmt(poolAfter)} ETH`);
    log.info(`CCIP message: ${ccipLink(tx.hash)}`);
  },
});
