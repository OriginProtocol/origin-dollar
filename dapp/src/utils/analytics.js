import Analytics from 'analytics'
import googleAnalytics from '@analytics/google-analytics'
import mixpanel from '@analytics/mixpanel'

const MIXPANEL_ID = process.env.MIXPANEL_ID
const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'
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
