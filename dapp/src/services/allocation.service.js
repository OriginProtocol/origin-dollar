export default class AllocationService {
  async fetchAllocation() {
    const endpoint = `${process.env.ANALYTICS_ENDPOINT}/api/v1/strategies`
    const response = await fetch(endpoint)
    if (!response.ok) {
      throw new Error(`Failed to fetch allocation`, err)
    }
    const json = await response.json()
    return json
  }
}

export const allocationService = new AllocationService()
