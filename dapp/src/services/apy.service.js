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

        try {
          const response = await fetch(endpoint)
          if (response.ok) {
            const json = await response.json()
            return json.apy / 100
          }
        } catch (err) {
          console.error(`Failed to fetch ${days} day APY`, err)
        }
        return null
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
