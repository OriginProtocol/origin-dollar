import Analytics from 'analytics'
import googleAnalytics from '@analytics/google-analytics'
import mixpanel from '@analytics/mixpanel'
import { isProduction, isDevelopment } from 'constants/env'

const NEXT_PUBLIC_MIXPANEL_ID = process.env.NEXT_PUBLIC_MIXPANEL_ID
const isStaging = process.env.STAGING === 'true'

let mixpanelId = NEXT_PUBLIC_MIXPANEL_ID || 'dev_token'
if (isProduction && !isStaging) {
  mixpanelId = NEXT_PUBLIC_MIXPANEL_ID
}

const plugins = []
if (process.env.NEXT_PUBLIC_GA_ID) {
  plugins.push(
    googleAnalytics({
      trackingId: process.env.NEXT_PUBLIC_GA_ID,
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
