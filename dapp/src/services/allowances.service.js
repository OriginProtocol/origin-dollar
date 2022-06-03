import { displayCurrency } from 'utils/math'

export default class AllowancesService {
  async fetchAllowances(account, contracts) {
    const {
      usdt,
      dai,
      usdc,
      ousd,
      wousd,
      vault,
      uniV3SwapRouter,
      uniV2Router,
      sushiRouter,
      flipper,
      curveOUSDMetaPool,
    } = contracts

    const [
      usdtAllowanceVault,
      daiAllowanceVault,
      usdcAllowanceVault,
      ousdAllowanceVault,
      usdtAllowanceRouter,
      daiAllowanceRouter,
      usdcAllowanceRouter,
      ousdAllowanceRouter,
      usdtAllowanceFlipper,
      daiAllowanceFlipper,
      usdcAllowanceFlipper,
      ousdAllowanceFlipper,
      ousdAllowanceWousd,
    ] = await Promise.all([
      displayCurrency(await usdt.allowance(account, vault.address), usdt),
      displayCurrency(await dai.allowance(account, vault.address), dai),
      displayCurrency(await usdc.allowance(account, vault.address), usdc),
      displayCurrency(await ousd.allowance(account, vault.address), ousd),
      displayCurrency(
        await usdt.allowance(account, uniV3SwapRouter.address),
        usdt
      ),
      displayCurrency(
        await dai.allowance(account, uniV3SwapRouter.address),
        dai
      ),
      displayCurrency(
        await usdc.allowance(account, uniV3SwapRouter.address),
        usdc
      ),
      displayCurrency(
        await ousd.allowance(account, uniV3SwapRouter.address),
        ousd
      ),
      displayCurrency(await usdt.allowance(account, flipper.address), usdt),
      displayCurrency(await dai.allowance(account, flipper.address), dai),
      displayCurrency(await usdc.allowance(account, flipper.address), usdc),
      displayCurrency(await ousd.allowance(account, flipper.address), ousd),
      displayCurrency(await ousd.allowance(account, wousd.address), ousd),
    ])

    let usdtAllowanceCurvePool,
      daiAllowanceCurvePool,
      usdcAllowanceCurvePool,
      ousdAllowanceCurvePool,
      usdtAllowanceRouterV2,
      daiAllowanceRouterV2,
      usdcAllowanceRouterV2,
      ousdAllowanceRouterV2,
      usdtAllowanceSushiRouter,
      daiAllowanceSushiRouter,
      usdcAllowanceSushiRouter,
      ousdAllowanceSushiRouter

    // curve pool functionality supported on mainnet and hardhat fork
    if (curveOUSDMetaPool) {
      ;[
        usdtAllowanceCurvePool,
        daiAllowanceCurvePool,
        usdcAllowanceCurvePool,
        ousdAllowanceCurvePool,
        usdtAllowanceRouterV2,
        daiAllowanceRouterV2,
        usdcAllowanceRouterV2,
        ousdAllowanceRouterV2,
        usdtAllowanceSushiRouter,
        daiAllowanceSushiRouter,
        usdcAllowanceSushiRouter,
        ousdAllowanceSushiRouter,
      ] = await Promise.all([
        displayCurrency(
          await usdt.allowance(account, curveOUSDMetaPool.address),
          usdt
        ),
        displayCurrency(
          await dai.allowance(account, curveOUSDMetaPool.address),
          dai
        ),
        displayCurrency(
          await usdc.allowance(account, curveOUSDMetaPool.address),
          usdc
        ),
        displayCurrency(
          await ousd.allowance(account, curveOUSDMetaPool.address),
          ousd
        ),
        displayCurrency(
          await usdt.allowance(account, uniV2Router.address),
          usdt
        ),
        displayCurrency(await dai.allowance(account, uniV2Router.address), dai),
        displayCurrency(
          await usdc.allowance(account, uniV2Router.address),
          usdc
        ),
        displayCurrency(
          await ousd.allowance(account, uniV2Router.address),
          ousd
        ),
        displayCurrency(
          await usdt.allowance(account, sushiRouter.address),
          usdt
        ),
        displayCurrency(await dai.allowance(account, sushiRouter.address), dai),
        displayCurrency(
          await usdc.allowance(account, sushiRouter.address),
          usdc
        ),
        displayCurrency(
          await ousd.allowance(account, sushiRouter.address),
          ousd
        ),
      ])
    }

    return {
      usdt: {
        vault: usdtAllowanceVault,
        uniswapV3Router: usdtAllowanceRouter,
        uniswapV2Router: usdtAllowanceRouterV2,
        sushiRouter: usdtAllowanceSushiRouter,
        flipper: usdtAllowanceFlipper,
        curve: usdtAllowanceCurvePool,
      },
      dai: {
        vault: daiAllowanceVault,
        uniswapV3Router: daiAllowanceRouter,
        uniswapV2Router: daiAllowanceRouterV2,
        sushiRouter: daiAllowanceSushiRouter,
        flipper: daiAllowanceFlipper,
        curve: daiAllowanceCurvePool,
      },
      usdc: {
        vault: usdcAllowanceVault,
        uniswapV3Router: usdcAllowanceRouter,
        uniswapV2Router: usdcAllowanceRouterV2,
        sushiRouter: usdcAllowanceSushiRouter,
        flipper: usdcAllowanceFlipper,
        curve: usdcAllowanceCurvePool,
      },
      ousd: {
        vault: ousdAllowanceVault,
        uniswapV3Router: ousdAllowanceRouter,
        uniswapV2Router: ousdAllowanceRouterV2,
        sushiRouter: ousdAllowanceSushiRouter,
        flipper: ousdAllowanceFlipper,
        curve: ousdAllowanceCurvePool,
        wousd: ousdAllowanceWousd,
      },
    }
  }
}

export const allowancesService = new AllowancesService()
