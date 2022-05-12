export default class TransactionHistoryWrappedService {
  constructor() {
    this.baseURL = `${process.env.ANALYTICS_ENDPOINT}/api/v1/address`
  }

  async fetchHistoryWrapped(account) {
    const response = await fetch(
      `${this.baseURL}/${account.toLowerCase()}/wrap_history`
    )

    if (!response.ok) {
      throw new Error('Failed fetching wrapped history from analytics')
    }

    return (await response.json()).history
  }
}

export const transactionHistoryWrappedService =
  new TransactionHistoryWrappedService()
