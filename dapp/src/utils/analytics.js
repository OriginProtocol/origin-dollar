import Analytics from 'analytics'
import googleAnalytics from '@analytics/google-analytics'
import { isDevelopment } from 'constants/env'

const plugins = []
if (process.env.GA_ID) {
  plugins.push(
    googleAnalytics({
      trackingId: process.env.GA_ID,
    })
  )
}

const analytics = Analytics({
  app: 'origin-dollar-dapp',
  version: 1,
  plugins: plugins,
  debug: isDevelopment,
})

export default analytics
