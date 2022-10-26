export default class CollateralService {
  async fetchCollateral() {
    const endpoint = `${process.env.ANALYTICS_ENDPOINT}/api/v1/collateral`
    const response = await fetch(endpoint)
    if (!response.ok) {
      throw new Error(`Failed to fetch collateral`, err)
    }
    const json = await response.json()
    return json
  }
}

export const collateralService = new CollateralService()
