import { useMemo } from 'react';
import { useBalance, useContractReads, erc20ABI } from 'wagmi';
import { BigNumber } from 'ethers';

type Token = {
  name: string;
  address: `0x${string}` | string | undefined;
  abi: never;
  decimals?: number;
  symbol?: string;
};

type TokenBalanceProps = {
  address: `0x${string}` | string | undefined;
  tokens: {
    [key: string]: Token;
  };
};

const useTokenBalances = ({ address, tokens }: TokenBalanceProps) => {
  const tokenKeys = Object.keys(tokens);

  const { data: ethBalance } = useBalance({
    // @ts-ignore
    address,
  });

  const { data, isError, isLoading, refetch } = useContractReads({
    // @ts-ignore
    contracts: tokenKeys.map((key) => {
      const { address: contractAddress, abi = erc20ABI } = tokens[key];
      return {
        address: contractAddress,
        abi,
        functionName: 'balanceOf',
        args: [address],
      };
    }),
    watch: true,
  });

  const balances = useMemo(() => {
    return tokenKeys.reduce(
      (acc, key, index) => {
        // @ts-ignore
        acc[key] = {
          // @ts-ignore
          ...tokens[key],
          balanceOf: data?.[index] ?? BigNumber.from(0),
        };
        return acc;
      },
      {
        ETH: {
          name: 'ETH',
          symbol: 'ETH',
          balanceOf: ethBalance?.value ?? BigNumber.from(0),
          logoSrc: '/tokens/ETH.png',
        },
      }
    );
  }, [JSON.stringify(tokenKeys), JSON.stringify(data), ethBalance]);

  return { data: balances, isError, isLoading, onRefresh: refetch };
};

export default useTokenBalances;
