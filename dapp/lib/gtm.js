export const GTM_ID = process.env.GOOGLE_TAG_MANAGER_ID

export const pageview = () => {
  window?.dataLayer?.push({
    event: 'pageview',
    pageUrl: window.location.href,
    pageTitle: document.title,
  })
}