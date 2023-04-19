import qs from "qs";
import { getStrapiURL } from "../../lib/api";
import transformLinks from "../../src/utils/transformLinks";

const navigationLinks = async (req, res) => {
  try {
    const { path = "/ousd-nav-links", options = {}, params = {} } = req.body;

    // Build request URL
    const queryString = qs.stringify(params);

    const requestUrl = `${getStrapiURL(
      `/api${path}${queryString ? `?${queryString}` : ""}`
    )}`;

    // Trigger API call
    const result = await fetch(requestUrl, {
      headers: {
        method: "GET",
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.STRAPI_API_KEY}`,
      },
      ...options,
    }).then((res) => res.json());

    const navLinks = transformLinks(result?.data || []);

    return res.json({
      data: navLinks,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      error: error.message,
      data: [],
    });
  }
};

const handler = async (req, res) => {
  const { method } = req;
  switch (method) {
    case "POST":
      return navigationLinks(req, res);
    default:
      res.setHeader("Allow", ["POST", "OPTIONS"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
};

export default handler;
