const mixpanel = require('mixpanel-browser')
const mixpanelId =
  process.env.NODE_ENV === 'production'
    ? MIXPANEL_ID
    : MIXPANEL_ID || 'dev_token'

mixpanel.init(mixpanelId)

export default mixpanel
