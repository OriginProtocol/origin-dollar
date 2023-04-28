import { displayCurrency } from 'utils/math'

export default class AllowancesService {
  async fetchAllowances(account, contracts) {
    const {
      vault,

      weth,
      reth,
      frxeth,
      steth,
      oeth,
      woeth,
    } = contracts

    const [
      wethAllowanceVault,
      rethAllowanceVault,
      frxethAllowanceVault,
      stethAllowanceVault,
      oethAllowanceVault,
    ] = await Promise.all([
      displayCurrency(await weth.allowance(account, vault.address), weth),
      displayCurrency(await reth.allowance(account, vault.address), reth),
      displayCurrency(await frxeth.allowance(account, vault.address), frxeth),
      displayCurrency(await steth.allowance(account, vault.address), steth),
      displayCurrency(await oeth.allowance(account, vault.address), oeth),
    ])

    return {
      oeth: {
        vault: oethAllowanceVault,
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
      steth: {
        vault: stethAllowanceVault,
      },
    }
  }
}

export const allowancesService = new AllowancesService()
