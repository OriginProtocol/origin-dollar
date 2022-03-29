export default class TransactionHistoryService {
  constructor() {
    this.baseURL = `${process.env.ANALYTICS_ENDPOINT}/api/v1/address`
  }

  async fetchHistory(account) {
    const response = await fetch(
      `${this.baseURL}/${account.toLowerCase()}/history`
    )

    if (!response.ok) {
      throw new Error('Failed fetching history from analytics')
    }

    return (await response.json()).history
  }
}

export const transactionHistoryService = new TransactionHistoryService()
