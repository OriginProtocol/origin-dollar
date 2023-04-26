export { formatUnits } from 'ethers/lib/utils.js';

export function shortenAddress(address: string, shorter = false) {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.substring(0, 5)}...${
    !shorter ? address.substring(address.length - 5) : ''
  }`;
}
