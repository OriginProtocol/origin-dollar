export default class TransactionHistoryService {
  constructor() {
    this.baseURL = `${process.env.ANALYTICS_ENDPOINT}/api/v1/address`
  }

  async fetchHistory(account) {
    const response = await fetch(`${this.baseURL}/${account.toLowerCase()}/history`).then(
      (res) => res.json()
    )

    return response.history
  }
}

export const transactionHistoryService = new TransactionHistoryService()
