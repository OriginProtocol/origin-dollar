const mixpanel = require('mixpanel-browser')
const MIXPANEL_ID = process.env.MIXPANEL_ID

const mixpanelId =
  process.env.NODE_ENV === 'production'
    ? MIXPANEL_ID
    : MIXPANEL_ID || 'dev_token'

console.log('MIXPANEL ID: ', mixpanelId)
mixpanel.init(mixpanelId)

export default mixpanel
