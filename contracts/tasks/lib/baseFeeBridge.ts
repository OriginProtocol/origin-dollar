import { BigNumber, ethers } from "ethers";

/** The module re-quotes the CCIP fee when the tx runs, so leave room for the
 *  quote to move between our read and the tx. 12_000 = fee + 20%. */
export const TOPUP_HEADROOM_BPS = 12_000;

/** Never attach more than this to one claim. About 2.5x the ~0.019 ETH fee, so
 *  a broken quote can't drain the relayer. */
export const MAX_TOPUP_WEI = ethers.utils.parseEther("0.05");

/** ETH to attach to `claimAndBridge` so the fee Safe can pay this bridge's
 *  CCIP fee. 0 when the Safe already has enough. */
export function bridgeTopUp(safeEth: BigNumber, fee: BigNumber): BigNumber {
  const target = fee.mul(TOPUP_HEADROOM_BPS).div(10_000);
  return safeEth.gte(target) ? BigNumber.from(0) : target.sub(safeEth);
}
