import { getStrapiURL } from "./api";

export function getStrapiMedia(media) {
  if (!media || !media.data) return;
  const { url } = media.data.attributes;
  return url.startsWith("/") ? getStrapiURL(url) : url;
}
