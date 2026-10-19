import { ethers } from "ethers";
import { action, types } from "../lib/action";
import { getContract } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

/**
 * Sells the Super OETH (OETHb) protocol fees on the Base fee Safe for WETH on
 * the Curve AMO pool and bridges the WETH over CCIP to the Ethereum
 * FeeSplitter, where it joins the OUSD/OETH fees on their way to xOGN.
 *
 * The destination, route and a par-relative slippage floor are fixed in
 * BaseFeeBridgeModule, so a bug here cannot send the fees anywhere else or
 * sell them far below par.
 */

const MODULE_ABI = [
  "function safeContract() view returns (address)",
  "function oethb() view returns (address)",
  "function curvePool() view returns (address)",
  "function oethbIndex() view returns (int128)",
  "function wethIndex() view returns (int128)",
  "function maxSlippageBps() view returns (uint256)",
  "function bridgeFee(uint256 wethAmount) view returns (uint256)",
  "function swapAndBridge(uint256 oethbAmount, uint256 minWethOut)",
];

const CURVE_POOL_ABI = [
  "function get_dy(int128 i, int128 j, uint256 dx) view returns (uint256)",
];

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

/** Warn when the Safe's ETH covers fewer than this many CCIP fees. */
const LOW_SAFE_ETH_FEES = 3;

action({
  name: "bridgeBaseFees",
  description:
    "Swap Base OETHb fees to WETH on Curve and bridge them to the Ethereum FeeSplitter",
  chains: [8453],
  params: (t) => {
    t.addOptionalParam(
      "maxFeeBps",
      "Skip until the CCIP fee is at most this share of the WETH bridged",
      100,
      types.int
    );
    t.addOptionalParam(
      "slippageBps",
      "Slippage applied to the Curve quote for minWethOut",
      10,
      types.int
    );
    t.addOptionalParam(
      "dryrun",
      "Simulate the swap and bridge without broadcasting",
      false,
      types.boolean
    );
  },
  run: async ({ signer, args, log }) => {
    const dryrun = !!args.dryrun;
    const maxFeeBps = Number(args.maxFeeBps);
    const slippageBps = Number(args.slippageBps);

    const { address: moduleAddr } = await getContract("BaseFeeBridgeModule");
    const module = new ethers.Contract(moduleAddr, MODULE_ABI, signer);
    const provider = signer.provider!;

    const [safe, oethbAddr, poolAddr, oethbIndex, wethIndex, maxSlippageBps] =
      await Promise.all([
        module.safeContract(),
        module.oethb(),
        module.curvePool(),
        module.oethbIndex(),
        module.wethIndex(),
        module.maxSlippageBps(),
      ]);

    const oethb = new ethers.Contract(oethbAddr, ERC20_ABI, provider);
    const amount = await oethb.balanceOf(safe);
    log.info(
      `Fee Safe ${safe} holds ${ethers.utils.formatEther(amount)} OETHb`
    );

    if (amount.isZero()) {
      log.info("Nothing to bridge");
      return;
    }

    const pool = new ethers.Contract(poolAddr, CURVE_POOL_ABI, provider);
    const quote = await pool.get_dy(oethbIndex, wethIndex, amount);
    const minWethOut = quote.mul(10_000 - slippageBps).div(10_000);
    const floor = amount.mul(10_000 - maxSlippageBps.toNumber()).div(10_000);
    log.info(
      `Curve quote ${ethers.utils.formatEther(quote)} WETH, ` +
        `minWethOut ${ethers.utils.formatEther(minWethOut)}, ` +
        `module floor ${ethers.utils.formatEther(floor)}`
    );

    // Fail loudly rather than skip: a pool this far below par needs a human to
    // look at the AMO, and a skipped run would hide that.
    if (minWethOut.lt(floor)) {
      throw new Error(
        `Curve pool is more than ${maxSlippageBps} bps below par; not swapping`
      );
    }

    // The CCIP fee is roughly flat per message (~0.019 ETH at the time of
    // writing), so batch fees across runs until it is a small share.
    const fee = await module.bridgeFee(quote);
    const feeBps = fee.mul(10_000).div(quote).toNumber();
    log.info(
      `CCIP fee ${ethers.utils.formatEther(
        fee
      )} ETH (${feeBps} bps of the WETH)`
    );
    if (feeBps > maxFeeBps) {
      log.info(`Above the ${maxFeeBps} bps maximum; waiting for more fees`);
      return;
    }

    const safeEth = await provider.getBalance(safe);
    if (safeEth.lt(fee)) {
      throw new Error(
        `Fee Safe has ${ethers.utils.formatEther(safeEth)} ETH, ` +
          `less than the ${ethers.utils.formatEther(
            fee
          )} ETH CCIP fee; top it up`
      );
    }
    if (safeEth.lt(fee.mul(LOW_SAFE_ETH_FEES))) {
      log.warn(
        `Fee Safe ETH covers fewer than ${LOW_SAFE_ETH_FEES} CCIP fees; top it up`
      );
    }

    // Simulate first so a missing module enablement or an unfunded CCIP fee
    // surfaces as a revert reason instead of a failed transaction.
    await module.callStatic.swapAndBridge(amount, minWethOut);

    if (dryrun) {
      log.info("Dry run: simulation succeeded, not broadcasting");
      return;
    }

    const tx = await module.swapAndBridge(amount, minWethOut);
    await logTxDetails(tx, "swapAndBridge on BaseFeeBridgeModule");
  },
});
