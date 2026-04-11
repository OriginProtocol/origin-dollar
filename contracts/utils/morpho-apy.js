const { fetchVaultApy } = require("origin-morpho-utils");

const { getRpcUrl, getSubsquidUrl } = require("./rebalancer-config");
const log = require("./logger")("utils:morpho-apy");

// ─── Generic GraphQL helpers ──────────────────────────────────────────────────

/**
 * POST a GraphQL query to the Origin Subsquid server.
 *
 * @param {string} query - GraphQL query string
 * @returns {Promise<object>} parsed `data` field from the response
 */
async function _fetchFromSubsquid(query) {
  const url = getSubsquidUrl();
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Subsquid request failed: ${response.status}`);
  }

  const json = await response.json();
  if (json.errors) {
    throw new Error(
      `Subsquid GraphQL error: ${json.errors.map((e) => e.message).join(", ")}`
    );
  }
  return json.data;
}

// ─── Subsquid APY (time-windowed average — not available from RPC) ───────────

/**
 * Fetch the time-weighted average APY from the Origin Subsquid indexer.
 * Used as the authoritative APY for allocation decisions (less noisy than spot).
 *
 * @param {string} vaultAddress - MetaMorpho V1.1 vault address
 * @param {number} chainId - 1, 8453, or 999
 * @param {string} [timeWindow="1h"] - e.g. "1h", "6h", "24h"
 * @returns {Promise<number>} APY as a decimal (0.035 = 3.5%)
 */
async function fetchSubsquidVaultApyAverage(
  vaultAddress,
  chainId,
  timeWindow = "1h"
) {
  const data = await _fetchFromSubsquid(`{
    morphoVaultApyAverage(
      chainId: ${chainId},
      vaultAddress: "${vaultAddress.toLowerCase()}",
      timeWindow: "${timeWindow}"
    ) {
      averageApy
      timeWindowHours
    }
  }`);
  const result = data?.morphoVaultApyAverage;
  const apy = result?.averageApy;
  log(
    `subsquid ${timeWindow} avg APY for ${vaultAddress} on chain ${chainId}: ${
      apy != null ? (apy * 100).toFixed(2) + "%" : "null"
    }`
  );
  return apy != null ? Number(apy) : 0;
}

// ─── Combined fetcher ─────────────────────────────────────────────────────────

/**
 * Fetch APYs for multiple vaults in parallel.
 * Spot APY is computed from on-chain state via origin-morpho-utils (RPC).
 * Time-windowed average APY is fetched from the Origin Subsquid indexer.
 *
 * @param {Array} vaults - objects with { metaMorphoVaultAddress, morphoChainId }
 * @param {object} [options]
 * @param {string} [options.timeWindow="1h"] - time window for average APY
 * @returns {Promise<{ apys: Object<string, number>, avgApys: Object<string, number> }>}
 */
async function fetchMorphoApys(vaults, { timeWindow = "1h" } = {}) {
  const entries = await Promise.all(
    vaults.map(async (v) => {
      const rpcUrl = getRpcUrl(v.morphoChainId);
      const [spotApy, avgApy] = await Promise.all([
        rpcUrl
          ? fetchVaultApy(rpcUrl, v.morphoChainId, v.metaMorphoVaultAddress)
              .then((r) => r?.apy ?? 0)
              .catch((err) => {
                console.error(
                  `[morpho-apy] RPC spot APY failed for ${v.metaMorphoVaultAddress} ` +
                    `on chain ${v.morphoChainId}: ${err.message}`
                );
                return 0;
              })
          : Promise.resolve(0),
        fetchSubsquidVaultApyAverage(
          v.metaMorphoVaultAddress,
          v.morphoChainId,
          timeWindow
        ).catch((err) => {
          console.error(
            `[morpho-apy] Subsquid avg APY failed for ${v.metaMorphoVaultAddress} ` +
              `on chain ${v.morphoChainId}: ${err.message}`
          );
          return 0;
        }),
      ]);
      return { addr: v.metaMorphoVaultAddress, spotApy, avgApy };
    })
  );

  const apys = {};
  const avgApys = {};
  for (const { addr, spotApy, avgApy } of entries) {
    apys[addr] = spotApy;
    avgApys[addr] = avgApy;
  }
  return { apys, avgApys };
}

module.exports = {
  fetchMorphoApys,
  fetchSubsquidVaultApyAverage,
};
