import { ethers } from "ethers";
import { action } from "../lib/action";
import {
  ERC20_ABI,
  REMOTE_ABI,
  retryableIdle,
  revertReason,
} from "../lib/oethbV3";
import { logTxDetails } from "../../utils/txLogger";
// CJS util.
import addresses from "../../utils/addresses";

/**
 * Manual: re-runs the OETH mint and wOETH wrap on the OETHb V3 Remote strategy
 * after `DepositUnderlyingFailed` or `WithdrawRequestUnderlyingFailed` left
 * WETH or OETH idle on it. Idle value is still counted, it just earns nothing.
 */

/** Below this the gas costs more than putting the value to work is worth. */
const DUST_WEI = ethers.utils.parseEther("0.001");

const fmt = ethers.utils.formatEther;

action({
  name: "oethbV3RetryDeposit",
  description:
    "Re-wrap idle WETH/OETH on the OETHb V3 Remote strategy after a failed deposit or withdraw request",
  chains: [1],
  params: (t) => {
    t.addFlag("dryrun", "Simulate without broadcasting");
  },
  run: async ({ signer, args, log }) => {
    const dryrun = !!args.dryrun;
    const provider = signer.provider!;
    const remoteAddr = addresses.mainnet.OETHbV3RemoteStrategy;
    const remote = new ethers.Contract(remoteAddr, REMOTE_ABI, signer);
    const weth = new ethers.Contract(
      addresses.mainnet.WETH,
      ERC20_ABI,
      provider
    );
    const oeth = new ethers.Contract(
      addresses.mainnet.OETHProxy,
      ERC20_ABI,
      provider
    );

    const [wethBalance, oethBalance, requestId, requestAmount] =
      await Promise.all([
        weth.balanceOf(remoteAddr),
        oeth.balanceOf(remoteAddr),
        remote.outstandingRequestId(),
        remote.outstandingRequestAmount(),
      ]);
    const { idleWeth, idleOeth } = retryableIdle({
      wethBalance,
      oethBalance,
      requestId,
      requestAmount,
    });
    log.info(
      `Remote idle: ${fmt(idleWeth)} WETH (of ${fmt(wethBalance)} held), ${fmt(
        idleOeth
      )} OETH`
    );
    if (idleWeth.lt(DUST_WEI) && idleOeth.lt(DUST_WEI)) {
      log.info("Nothing above dust to retry");
      return;
    }

    try {
      await remote.callStatic.retryDeposit();
    } catch (err) {
      throw new Error(`retryDeposit reverts: ${revertReason(err)}`);
    }
    if (dryrun) {
      log.info("Dry run: retryDeposit simulation succeeded, not broadcasting");
      return;
    }
    const tx = await remote.retryDeposit();
    await logTxDetails(tx, "retryDeposit on OETHb V3 Remote");
  },
});
