import { ethers, BigNumber } from 'ethers';
import { formatUnits } from 'ethers/lib/utils';
import { find } from 'lodash';

type Token = {
  address: `0x${string}` | string | undefined;
  name: string;
  symbol: string;
};

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

export const isEqualAddress = (
  addr: `0x${string}` | string | undefined,
  otherAddr: `0x${string}` | string | undefined
) => addr?.toLowerCase() === otherAddr?.toLowerCase();

export const findTokenBySymbol = (tokens: Token[], symbol: string) => {
  return find(tokens, ({ symbol: currentSymbol }) =>
    isEqualAddress(currentSymbol, symbol)
  );
};

export const findTokenByAddress = (
  tokens: Token[],
  contractAddress: string
) => {
  return find(tokens, ({ address }) =>
    isEqualAddress(address, contractAddress)
  );
};

export const getProviderName = () => {
  //@ts-ignore
  if (!process.browser) {
    return null;
  }

  // @ts-ignore
  const { ethereum, web3 }: any = window || {};

  if (!ethereum || !web3) {
    return null;
  }

  if (ethereum?.isMetaMask) {
    return 'metamask';
  } else if (ethereum?.isImToken) {
    return 'imtoken';
    //@ts-ignore
  } else if (typeof window.__CIPHER__ !== 'undefined') {
    return 'cipher';
  } else if (!web3.currentProvider) {
    return null;
  } else if (web3?.currentProvider.isToshi) {
    return 'coinbase';
  } else if (web3?.currentProvider.isTrust) {
    return 'trust';
  } else if (web3?.currentProvider.isGoWallet) {
    return 'gowallet';
  } else if (web3?.currentProvider.isAlphaWallet) {
    return 'alphawallet';
  } else if (web3?.currentProvider.isStatus) {
    return 'status';
  } else if (web3?.currentProvider.constructor.name === 'EthereumProvider') {
    return 'mist';
  } else if (web3?.currentProvider.constructor.name === 'Web3FrameProvider') {
    return 'parity';
  } else if (
    web3?.currentProvider.host &&
    web3?.currentProvider.host.indexOf('infura') !== -1
  ) {
    return 'infura';
  } else if (
    web3?.currentProvider.host &&
    web3?.currentProvider.host.indexOf('localhost') !== -1
  ) {
    return 'localhost';
  }

  return 'unknown';
};

export {
  formatUnits,
  parseUnits,
  parseEther,
  formatEther,
  formatBytes32String,
} from 'ethers/lib/utils.js';

export const MaxUint256 = ethers.constants.MaxUint256;
