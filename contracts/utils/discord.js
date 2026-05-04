/**
 * Post a plain-text message to a Discord webhook.
 * @param {string} webhookUrl
 * @param {string} content - The message text (max 2000 chars for a single Discord message)
 */
async function postToDiscord(webhookUrl, content) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${res.statusText}`);
  }
}

module.exports = { postToDiscord };
