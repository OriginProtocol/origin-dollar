import { ethers } from 'ethers'
import { displayCurrency } from 'utils/math'

export default class AllowancesService {
  async fetchAllowances(account, contracts) {
    const {
      vault,
      zapper,
      weth,
      reth,
      frxeth,
      sfrxeth,
      steth,
      oeth,
      woeth,
      curveOETHPool,
    } = contracts

    const [
      wethAllowanceVault,
      rethAllowanceVault,
      frxethAllowanceVault,
      sfrxethAllowanceVault,
      sfrxethAllowanceZapper,
      stethAllowanceVault,
      oethAllowanceVault,
      woethAllowance,
    ] = await Promise.all([
      displayCurrency(await weth.allowance(account, vault.address), weth),
      displayCurrency(await reth.allowance(account, vault.address), reth),
      displayCurrency(await frxeth.allowance(account, vault.address), frxeth),
      displayCurrency(await sfrxeth.allowance(account, vault.address), sfrxeth),
      displayCurrency(
        await sfrxeth.allowance(account, zapper.address),
        sfrxeth
      ),
      displayCurrency(await steth.allowance(account, vault.address), steth),
      displayCurrency(await oeth.allowance(account, vault.address), oeth),
      displayCurrency(await oeth.allowance(account, woeth.address), oeth),
    ])

    let oethAllowanceCurvePool

    if (curveOETHPool) {
      ;[oethAllowanceCurvePool] = await Promise.all([
        displayCurrency(
          await oeth.allowance(account, curveOETHPool.address),
          oeth
        ),
      ])
    }

    return {
      eth: {
        vault: ethers.constants.MaxUint256,
        zapper: ethers.constants.MaxUint256,
        curve: ethers.constants.MaxUint256,
      },
      oeth: {
        vault: oethAllowanceVault,
        curve: oethAllowanceCurvePool,
        woeth: woethAllowance,
      },
      weth: {
        vault: wethAllowanceVault,
      },
      reth: {
        vault: rethAllowanceVault,
      },
      frxeth: {
        vault: frxethAllowanceVault,
      },
      sfrxeth: {
        vault: sfrxethAllowanceVault,
        zapper: sfrxethAllowanceZapper,
      },
      steth: {
        vault: stethAllowanceVault,
      },
    }
  }
}

export const allowancesService = new AllowancesService()
