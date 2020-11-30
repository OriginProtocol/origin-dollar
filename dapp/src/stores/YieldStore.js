import { Store } from 'pullstate'

const YieldStore = new Store({
  currentCreditsPerToken: 0,
  nextCreditsPerToken: 0,
  expectedIncrease: 0,
  animatedExpectedIncrease: 0,
})

export default YieldStore
