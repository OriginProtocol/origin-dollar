import { Store } from 'pullstate';
import { Dripper, Ogv, Ousd, Vault, Veogv } from '../types/contracts';

interface Contracts {
  ousd: Ousd;
  vault: Vault;
  dripper: Dripper;
  ogv: Ogv;
  veogv: Veogv;
}

interface IContractStore {
  ousdTvl: any;
  refreshTvl: boolean;
  contracts: Contracts;
  apy: any;
  ogvStats: {
    price: number;
    circulating: number;
    total: number;
  };
}

const ContractStore = new Store<IContractStore>({
  contracts: {
    ousd: null,
    vault: null,
    dripper: null,
    ogv: null,
    veogv: null,
  },
  apy: {},
  ogvStats: {
    price: 0,
    circulating: 0,
    total: 0,
  },
  ousdTvl: 0,
  refreshTvl: false,
});

export default ContractStore;
