import { displayCurrency } from 'utils/math'

export default class WousdService {
  async fetchWousdValue(account, contracts) {
    const { ousd, wousd } = contracts

    const wousdValue = await displayCurrency(
      await wousd.maxWithdraw(account),
      ousd
    )
    return wousdValue
  }
}

export const wousdService = new WousdService()
