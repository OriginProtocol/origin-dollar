import { ethers, BigNumber } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';

export function shortenAddress(
  address: `0x${string}` | string | undefined,
  shorter = false
) {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.substring(0, 5)}...${
    !shorter ? address.substring(address.length - 5) : ''
  }`;
}

export const formatWeiBalance = (balance: any, maxDecimalDigits = 18) =>
  ethers.FixedNumber.from(
    formatUnits(balance || BigNumber.from(0), maxDecimalDigits)
  )
    .round(
      maxDecimalDigits ?? ethers.BigNumber.from(maxDecimalDigits).toNumber()
    )
    .toString();

export {
  formatUnits,
  parseUnits,
  parseEther,
  formatEther,
  formatBytes32String,
} from 'ethers/lib/utils.js';

export const MaxUint256 = ethers.constants.MaxUint256;
