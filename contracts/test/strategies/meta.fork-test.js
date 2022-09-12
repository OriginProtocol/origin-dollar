const { loadFixture } = require('ethereum-waffle')
const { ethers } = require('hardhat')
const addresses = require('../../utils/addresses')
const { isForkTest } = require('../helpers')
const { convexMetaVaultFixture } = require('../_fixture')

// Ugly hack to avoid running these tests when running `npx hardhat test` directly.
// A right way would be to add suffix to files and use patterns to filter
const forkDescribe = isForkTest ? describe : describe.skip

forkDescribe('Convex 3pool/OUSD Meta Strategy', function () {
  this.timeout(0)

  let fixture
  beforeEach(async () => {
    fixture = await loadFixture(balancedMetaPoolFixture)
  })

  async function balancedMetaPoolFixture() {
    const f = await loadFixture(convexMetaVaultFixture)
    await balanceMetaPool(f)
    return f
  }

  async function balanceMetaPool(_fixture = fixture) {
    const { OUSDMetaPool, originTeam, threePoolToken } = _fixture
    const ousd = await OUSDMetaPool.connect(originTeam).balances(0)
    const crv3 = await OUSDMetaPool.connect(originTeam).balances(1)
    const diff = ousd.gt(crv3) ? ousd.sub(crv3) : crv3.sub(ousd)
    console.log(`Trying to balance metapool...`)
    console.log(`OUSD: ${ousd.toString()}`)
    console.log(`3CRV: ${crv3.toString()}`)
    console.log(`Diff: ${diff.toString()}`)

    const bal = await threePoolToken.connect(originTeam).balanceOf(originTeam.getAddress())
    console.log('Bal :', bal.toString())

    if (ousd.gt(crv3)) {
      await tiltMetapoolTo3CRV(diff.div(2), _fixture)
    } else if (crv3.gt(ousd)) {
      await tiltMetapoolToOUSD(diff.div(2), _fixture)
    }
  }

  async function tiltMetapoolToOUSD(amount, _fixture = fixture) {
    console.log(`Tilting MetaPool to OUSD by ${amount}`)
    const { OUSDMetaPool, originTeam } = _fixture
    await OUSDMetaPool.connect(originTeam)['exchange(int128,int128,uint256,uint256)'](0, 1, amount.toString(), 0)
  }

  async function tiltMetapoolTo3CRV(amount, _fixture = fixture) {
    console.log(`Tilting MetaPool to 3CRV by ${amount}`)
    const { OUSDMetaPool, originTeam } = _fixture
    await OUSDMetaPool.connect(originTeam)['exchange(int128,int128,uint256,uint256)'](1, 0, amount.toString(), 0)
  }

  describe('Balanced metapool', () => {
    it('Add equal liquidity', async () => {
      const { ousd, usdt, matt } = fixture
  
      // # always leave the balancing call. Even if we want to tilt the pool we first want to balance
      // # it to mitigate the pre-existing state
      // balance_metapool()
  
      // # un-comment any of the below two to make the initial state of the pool balanced/unbalanced
      // #tiltMetapoolTo3CRV(0.25*1e6*1e18)
      // tiltMetapoolToOUSD(0.25*1e6*1e18)
  
      // show_metapool_balances()
      // # un-comment any of the liquidity adding strategies
      // # [crv3LiquidityAdded, ousdLiquidityAdded, lp_added] = addEqualLiquidity()
      // [crv3LiquidityAdded, ousdLiquidityAdded, lp_added] = addLiquidityToBeEqualInPool()
      // # [crv3LiquidityAdded, ousdLiquidityAdded, lp_added] = addTwiceTheOUSD()
      // show_metapool_balances()
      // # un-comment any of the liquidity removing strategies
      // removeLiquidityBalanced(crv3LiquidityAdded, ousdLiquidityAdded, lp_added)
      // #removeLiquidityImbalanced(crv3LiquidityAdded, ousdLiquidityAdded, lp_added)
  
      // show_metapool_balances()
    })

    it('Add equal liquidity 2', async () => {
      const { ousd, usdt, matt } = fixture
    })

    it('Add equal liquidity 3', async () => {
      const { ousd, usdt, matt } = fixture
    })
  })
})

