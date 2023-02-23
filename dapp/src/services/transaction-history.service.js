export default class TransactionHistoryService {
  constructor() {
    this.baseURL = `${process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT}/api/v1/address`
  }

  async fetchHistory(account, filters) {
    const filter = filters.reduce((result, filter, i) => {
      return `${result}${i !== 0 ? '+' : ''}${filter}`
    }, '')
    const filter_param = filter ? `&filter=${filter}` : ''
    const response = await fetch(
      `${
        this.baseURL
      }/${account.toLowerCase()}/history?per_page=1000000${filter_param}`
    )
    if (!response || !response.ok) {
      throw new Error('Failed fetching history from analytics')
    }

    return (await response.json()).history
  }
}

export const transactionHistoryService = new TransactionHistoryService()
