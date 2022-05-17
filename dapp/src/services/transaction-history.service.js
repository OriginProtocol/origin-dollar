export default class TransactionHistoryService {
  constructor() {
    this.baseURL = `${process.env.ANALYTICS_ENDPOINT}/api/v1/address`
  }

  async fetchHistory(account, transactionItems) {
    if (transactionItems === 0) return []

    const response = await fetch(
      `${
        this.baseURL
      }/${account.toLowerCase()}/history?per_page=${transactionItems}`
    )
    if (!response.ok) {
      throw new Error('Failed fetching history from analytics')
    }

    return (await response.json()).history
  }
}

export const transactionHistoryService = new TransactionHistoryService()
