export default class TotalSupplyService {
  async fetchTotalSupply() {
    const endpoint = `https://api.originprotocol.com/api/total-ogv`
    return fetch(endpoint).then((r) => r.json())
  }
}

export const totalSupplyService = new TotalSupplyService()
