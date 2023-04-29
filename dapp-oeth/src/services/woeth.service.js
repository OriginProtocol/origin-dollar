import { displayCurrency } from 'utils/math'

export default class WOETHService {
  async fetchWOETHValue(account, contracts) {
    const { oeth, woeth } = contracts

    const woethValue = await displayCurrency(
      await woeth.maxWithdraw(account),
      oeth
    )
    return woethValue
  }
}

export const woethService = new WOETHService()
