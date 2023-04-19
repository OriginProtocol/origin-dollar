export default class CirculatingSupplyService {
  async fetchCirculatingSupply() {
    const endpoint = `https://api.originprotocol.com/circulating-ogv`
    return fetch(endpoint).then((r) => r.json())
  }
}

export const circulatingSupplyService = new CirculatingSupplyService()
