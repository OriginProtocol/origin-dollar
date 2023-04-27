import { useContractReads } from 'wagmi';

type Vault = {
  contract: any;
  token: any;
};

type UseVaultProps = {
  vault: Vault;
};

const useVault = ({ vault }: UseVaultProps) => {
  const { contract } = vault;
  const { data } = useContractReads({
    contracts: [
      {
        address: contract?.address,
        abi: contract?.abi,
        functionName: 'getAllAssets',
      },
      {
        address: contract?.address,
        abi: contract?.abi,
        functionName: 'getAllStrategies',
      },
    ],
  });
  const [assetContractAddresses, strategyContractAddresses] = data || [];
  return [
    {
      assetContractAddresses,
      strategyContractAddresses,
    },
  ];
};

export default useVault;
