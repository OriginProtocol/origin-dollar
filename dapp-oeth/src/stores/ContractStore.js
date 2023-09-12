import { Store } from 'pullstate'
import { BigNumber } from 'ethers'

const ContractStore = new Store({
  contracts: {},
  apy: {},
  lastOverride: '',
  oethExchangeRates: {
    weth: {
      mint: 1,
      redeem: 1,
    },
    reth: {
      mint: 1,
      redeem: 1,
    },
    frxeth: {
      mint: 1,
      redeem: 1,
    },
    steth: {
      mint: 1,
      redeem: 1,
    },
  },
  // 'null' -> default zero state, 'loading' -> loading the estimates
  swapEstimations: null,
  swapEstimationsError: null,
  selectedSwap: undefined,
  coinInfoList: {
    eth: {
      contract: null,
      decimals: 18,
    },
    weth: {
      contract: null,
      decimals: 18,
    },
    reth: {
      contract: null,
      decimals: 18,
    },
    frxeth: {
      contract: null,
      decimals: 18,
    },
    steth: {
      contract: null,
      decimals: 18,
    },
    oeth: {
      contract: null,
      decimals: 18,
    },
    sfrxeth: {
      contract: null,
      decimals: 18,
    },
    mix: {
      contract: null,
      decimals: 0,
    },
  },
  chainId: parseInt(process.env.NEXT_PUBLIC_ETHEREUM_RPC_CHAIN_ID),
  walletConnected: false,
  vaultAllocateThreshold: null,
  vaultRebaseThreshold: null,
  gasPrice: BigNumber.from(0),
  isGasPriceUserOverriden: false,
  readOnlyProvider: false,
  showAllContracts: false,
  curveUnderlyingCoins: false,
  fetchId: -1,
})

export default ContractStore
