import { formatUnits } from 'ethers/lib/utils';

export function shortenAddress(address: string, shorter = false) {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.substring(0, 5)}...${
    !shorter ? address.substring(address.length - 5) : ''
  }`;
}

export const formatWeiBalance = (balance, decimals = 6) =>
  parseFloat(formatUnits(balance ?? 0n)).toFixed(decimals);

export { formatUnits } from 'ethers/lib/utils.js';
