const localStorageUserSourceKey = 'utm_source'

export function getUserSource() {
  return localStorage.getItem(localStorageUserSourceKey)
}

export function setUserSource(userSource) {
  const currentSource = getUserSource()
  if (!currentSource && userSource) {
    localStorage.setItem(localStorageUserSourceKey, userSource)
  }
}
