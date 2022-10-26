export default class CirculatingSupplyService {
  async fetchCirculatingSupply() {
    const endpoint = `/api/circulating-ogv`
    return fetch(endpoint).then((r) => r.json())
  }
}

export const circulatingSupplyService = new CirculatingSupplyService()
