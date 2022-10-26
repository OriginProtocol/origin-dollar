export default class PriceService {
  async fetchPrice() {
    const endpoint = `${process.env.COINGECKO_API}/simple/price?ids=origin-protocol%2Corigin-dollar-governance&vs_currencies=usd`
    const response = await fetch(endpoint)
    if (!response.ok) {
      throw new Error(`Failed to fetch price`, err)
    }
    return await response.json()
  }
}

export const priceService = new PriceService()
