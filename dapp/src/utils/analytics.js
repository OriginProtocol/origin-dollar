import Analytics from 'analytics'
import googleAnalytics from '@analytics/google-analytics'
import mixpanel from '@analytics/mixpanel'
import { isProduction, isDevelopment } from 'constants/env'

const MIXPANEL_ID = process.env.MIXPANEL_ID
const isStaging = process.env.STAGING === 'true'

let mixpanelId = MIXPANEL_ID || 'dev_token'
if (isProduction && !isStaging) {
  mixpanelId = MIXPANEL_ID
}

const plugins = []
if (process.env.GA_ID) {
  plugins.push(
    googleAnalytics({
      trackingId: process.env.GA_ID,
    })
  )
}

plugins.push(
  mixpanel({
    token: mixpanelId,
  })
)

const analytics = Analytics({
  app: 'origin-dollar-dapp',
  version: 1,
  plugins: plugins,
  debug: isDevelopment,
})

export default analytics
