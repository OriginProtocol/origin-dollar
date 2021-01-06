import mixpanel from 'utils/mixpanel'
const localStorageUserSourceKey = 'utm_source'

let source
export function getUserSource() {
  return localStorage.getItem(localStorageUserSourceKey)
}

export function setUserSource(userSource) {
  const currentSource = getUserSource()
  if (!currentSource && userSource) {
    localStorage.setItem(localStorageUserSourceKey, userSource)

    // set once doesn't override the already set values
    mixpanel.people.set_once('utm_source', userSource)
  }
}
