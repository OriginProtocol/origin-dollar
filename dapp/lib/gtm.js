export const GTM_ID = process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID

export const pageview = () => {
  window?.dataLayer?.push({
    event: 'pageview',
    pageUrl: window.location.href,
    pageTitle: document.title,
  })
}