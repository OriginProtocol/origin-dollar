import ContractStore from '../../stores/ContractStore';
import { useEffect } from 'react';
import { useStoreState } from 'pullstate';
import { setupContracts } from '../utils';

const useContracts = () => {
  const refreshTvl = useStoreState(ContractStore, (s) => s.refreshTvl);

  useEffect(() => {
    const contractsToExport = setupContracts();

    ContractStore.update((s) => {
      s.contracts = contractsToExport;
    });
  }, [refreshTvl]);
};

export default useContracts;
