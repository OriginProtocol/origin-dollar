export default class TransactionHistoryPageService {
  constructor() {
    this.baseURL = `${process.env.ANALYTICS_ENDPOINT}/api/v1/address`
  }

  async fetchHistory(account, transactionHistoryItemsPerPage) {
    const response = await fetch(
      `${this.baseURL}/${account.toLowerCase()}/history?per_page=${transactionHistoryItemsPerPage}`
    )

    if (!response.ok) {
      throw new Error('Failed fetching history from analytics')
    }

    return (await response.json())
  }
}

export const transactionHistoryPageService = new TransactionHistoryPageService()
