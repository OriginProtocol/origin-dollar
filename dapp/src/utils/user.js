import analytics from 'utils/analytics'
const localStorageUserSourceKey = 'utm_source'

let source
export function getUserSource() {
  return localStorage.getItem(localStorageUserSourceKey)
}

export function setUserSource(userSource) {
  const currentSource = getUserSource()
  if (!currentSource && userSource) {
    localStorage.setItem(localStorageUserSourceKey, userSource)

    analytics.identify(analytics.user('userId'), {
      utm_source_custom: userSource,
    })
  }
}
