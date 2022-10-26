export default class TotalSupplyService {
  async fetchTotalSupply() {
    const endpoint = `/api/total-ogv`
    return fetch(endpoint).then((r) => r.json())
  }
}

export const totalSupplyService = new TotalSupplyService();
