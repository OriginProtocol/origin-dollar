import { Store } from 'pullstate'

const ContractStore = new Store({
  contracts: {},
  apy: null,
  ousdExchangeRates: {
    dai: {
      mint: 1,
      redeem: 1,
    },
    usdt: {
      mint: 1,
      redeem: 1,
    },
    usdc: {
      mint: 1,
      redeem: 1,
    },
  },
  // 'null' -> default zero state, 'loading' -> loading the estimates
  swapEstimations: null,
  selectedSwap: undefined,
  coinInfoList: {
    usdt: {
      contract: null,
      decimals: 6,
    },
    usdc: {
      contract: null,
      decimals: 6,
    },
    dai: {
      contract: null,
      decimals: 18,
    },
    ousd: {
      contract: null,
      decimals: 18,
    },
    mix: {
      contract: null,
      decimals: 0,
    },
  },
  chainId: parseInt(process.env.ETHEREUM_RPC_CHAIN_ID),
  walletConnected: false,
  vaultAllocateThreshold: null,
  vaultRebaseThreshold: null,
  showAllContracts: false,
})

export default ContractStore
