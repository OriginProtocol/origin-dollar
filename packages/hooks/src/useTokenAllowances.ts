import { useMemo } from 'react';
import { useContractReads } from 'wagmi';
import { map, zipObject } from 'lodash';

type Token = {
  name: string;
  address: `0x${string}`;
  abi: any;
  decimals?: number;
  symbol?: string;
};

type TokenBalanceProps = {
  address: `0x${string}`;
  allowances: `0x${string}`[];
  tokens: Token[];
};

const useTokenAllowances = ({
  address,
  tokens,
  allowances,
}: TokenBalanceProps) => {
  const contractReads = useMemo(() => {
    return tokens?.reduce((acc, token) => {
      // Add token decimals fetch
      // @ts-ignore
      acc.push({
        id: token.symbol,
        address: token.address,
        abi: token.abi,
        functionName: 'decimals',
      });
      // Add allowances for each provided address
      map(allowances, (allowanceAddress, name) => {
        // @ts-ignore
        acc.push({
          id: `${token.symbol}_${name}`,
          address: token.address,
          abi: token.abi,
          functionName: 'allowance',
          args: [address, allowanceAddress],
        });
      });
      return acc;
    }, []);
  }, [address, JSON.stringify(tokens), JSON.stringify(allowances)]);

  const { data, isError, isLoading } = useContractReads({
    contracts: contractReads,
  });

  const allowanceLookup = useMemo(
    () => (!isLoading ? zipObject(map(contractReads, 'id'), data as []) : {}),
    [JSON.stringify(contractReads), isLoading, JSON.stringify(data)]
  );

  return { data: allowanceLookup, isError, isLoading };
};

export default useTokenAllowances;
