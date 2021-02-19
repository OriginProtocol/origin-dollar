import Analytics from 'analytics'
import googleAnalytics from '@analytics/google-analytics'
import mixpanel from '@analytics/mixpanel'

const MIXPANEL_ID = process.env.MIXPANEL_ID
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'
const isStaging = process.env.STAGING === 'true'

let mixpanelId = MIXPANEL_ID || 'dev_token'
if (isProduction && !isStaging) {
  mixpanelId = MIXPANEL_ID
}

const analytics = Analytics({
  app: 'origin-dollar-dapp',
  version: 1,
  plugins: [
    googleAnalytics({
      trackingId: process.env.GA_ID,
      debug: isDevelopment ? true : false,
    }),
    mixpanel({
      token: mixpanelId,
    }),
  ],
})

export default analytics
