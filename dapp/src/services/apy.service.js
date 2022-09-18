import { apyDayOptions } from 'utils/constants'

export default class ApyService {
  async fetchApy() {
    const dayResults = await Promise.all(
      apyDayOptions.map(async (days) => {
        let endpoint, varName
        if (apyDayOptions.includes(days)) {
          endpoint = `${process.env.APR_ANALYTICS_ENDPOINT}/${days}`
          varName = `apy${days}`
        } else {
          throw new Error(`Unexpected days param: ${days}`)
        }
        const response = await fetch(endpoint)
        if (!response.ok) {
          throw new Error(`Failed to fetch ${days} day APY`, err)
        }
        const json = await response.json()
        return json.apy / 100
      })
    )
    const apy = {}
    apyDayOptions.map((days, i) => {
      apy[`apy${days}`] = dayResults[i] || 0
    })
    return apy
  }
}

export const apyService = new ApyService()
