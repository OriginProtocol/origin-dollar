import { Contract } from "ethers";
import { Store } from "pullstate";

interface Contracts {
  ousd: Contract;
  vault: Contract;
  dripper: Contract;
  ogv: Contract;
  veogv: Contract;
}

interface IContractStore {
  ousdTvl: any;
  refreshTvl: boolean;
  contracts: Contracts;
  apy: any;
  ogvStats: any;
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
