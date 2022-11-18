import { apyDayOptions } from 'utils/constants'

export default class ApyHistoryService {
  async fetchApyHistory() {
    const apyHistory = await Promise.all(
      apyDayOptions.map(async (days) => {
        const endpoint = `${process.env.ANALYTICS_ENDPOINT}/api/v1/apr/trailing_history/${days}`
        const response = await fetch(endpoint)
        if (!response.ok) {
          throw new Error(
            `Failed to fetch ${days}-day trailing APY history`
          )
        }
        const json = await response.json()
        return json.trailing_history
      })
    ).then(function(apyHistory) {
      const data = {}
      apyDayOptions.map((days, i) => {
        data[`apy${days}`] = apyHistory[i] || []
      })
      return data
    }).catch(function(err) {
      console.log(err.message);
    });


    
  }
}

export const apyHistoryService = new ApyHistoryService()
