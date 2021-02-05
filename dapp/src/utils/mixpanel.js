const mixpanel = require('mixpanel-browser')
const MIXPANEL_ID = process.env.MIXPANEL_ID
const isStaging = process.env.STAGING === 'true'

let mixpanelId = MIXPANEL_ID || 'dev_token'
if (process.env.NODE_ENV === 'production' && !isStaging) {
  mixpanelId = MIXPANEL_ID
}

mixpanel.init(mixpanelId)

export default mixpanel
