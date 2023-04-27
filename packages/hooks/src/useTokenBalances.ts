import { useMemo } from 'react';
import { useBalance, useContractReads, erc20ABI } from 'wagmi';

type Token = {
  name: string;
  address: `0x${string}`;
  abi: any;
  decimals?: number;
  symbol?: string;
};

type TokenBalanceProps = {
  address: `0x${string}`;
  tokens: Token[];
};

const useTokenBalances = ({ address, tokens }: TokenBalanceProps) => {
  const tokenKeys = Object.keys(tokens);

  const { data: ethBalance } = useBalance({
    address,
  });

  const { data, isError, isLoading } = useContractReads({
    contracts: tokenKeys.map((key) => {
      const { address: contractAddress, abi = erc20ABI } = tokens[key];
      return {
        address: contractAddress,
        abi,
        functionName: 'balanceOf',
        args: [address],
      };
    }),
  });

  const balances = useMemo(() => {
    return tokenKeys.reduce(
      (acc, key, index) => {
        acc[key] = {
          ...tokens[key],
          balanceOf: data?.[index] ?? 0n,
        };
        return acc;
      },
      {
        ETH: {
          name: 'ETH',
          symbol: 'ETH',
          balanceOf: ethBalance?.value ?? 0n,
          logoSrc: '/tokens/ETH.png',
        },
      }
    );
  }, [JSON.stringify(tokenKeys), JSON.stringify(data), ethBalance]);

  return { data: balances, isError, isLoading };
};

export default useTokenBalances;
