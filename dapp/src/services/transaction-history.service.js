export default class TransactionHistoryService {
  async fetchHistory(token, account, filters) {
    const filter = filters.reduce((result, filter, i) => {
      return `${result}${i !== 0 ? '+' : ''}${filter}`
    }, '')
    const filter_param = filter ? `&filter=${filter}` : ''
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT}/api/v2/${token}/address/${account.toLowerCase()}/history?per_page=1000000${filter_param}`
    )
    if (!response || !response.ok) {
      throw new Error('Failed fetching history from analytics')
    }

    return (await response.json()).history
  }
}

export const transactionHistoryService = new TransactionHistoryService()
