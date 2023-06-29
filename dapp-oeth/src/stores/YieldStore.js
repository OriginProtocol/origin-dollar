import { Store } from 'pullstate'

const YieldStore = new Store({
  currentCreditsPerToken: 0,
  nextCreditsPerToken: 0,
  expectedIncrease: 0,
  expectedIncreaseWrapped: 0,
  animatedExpectedIncrease: 0,
  animatedExpectedIncreaseWrapped: 0,
  redeemFee: 0,
})

export default YieldStore
