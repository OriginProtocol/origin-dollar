const log = require("./logger")("utils:morpho-apy");

const DEFAULT_SUBSQUID_URL =
  "https://origin.squids.live/origin-squid:prod/api/graphql";

const MORPHO_GRAPHQL_URL = "https://api.morpho.org/graphql";

// ─── Generic GraphQL helpers ──────────────────────────────────────────────────

/**
 * POST a GraphQL query to the Origin Subsquid server.
 * URL is read from ORIGIN_SUBSQUID_SERVER env var, with a hardcoded default.
 *
 * @param {string} query - GraphQL query string
 * @returns {Promise<object>} parsed `data` field from the response
 */
async function _fetchFromSubsquid(query) {
  const url = process.env.ORIGIN_SUBSQUID_SERVER || DEFAULT_SUBSQUID_URL;
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

// ─── Subsquid APY (authoritative — used for rebalancer decisions) ─────────────

/**
 * Fetch the current vault APY from the Origin Subsquid indexer.
 *
 * @param {string} vaultAddress - MetaMorpho V1.1 vault address
 * @param {number} chainId - 1, 8453, or 999
 * @returns {Promise<number>} APY as a decimal (0.035 = 3.5%)
 */
async function fetchSubsquidVaultApy(vaultAddress, chainId) {
  const data = await _fetchFromSubsquid(`{
    morphoVaultApy(
      chainId: ${chainId},
      vaultAddress: "${vaultAddress.toLowerCase()}"
    )
  }`);
  const apy = data?.morphoVaultApy;
  log(
    `subsquid APY for ${vaultAddress} on chain ${chainId}: ${
      apy != null ? (apy * 100).toFixed(2) + "%" : "null"
    }`
  );
  return apy != null ? Number(apy) : 0;
}

/**
 * Simulate a deposit and measure APY impact via the Origin Subsquid indexer.
 *
 * @param {string}    vaultAddress   - MetaMorpho V1.1 vault address
 * @param {number}    chainId        - 1, 8453, or 999
 * @param {BigNumber} depositAmount  - in the loan token's native decimals
 * @returns {Promise<{ currentApy: number, newApy: number, impactBps: number }>}
 */
async function fetchSubsquidDepositImpact(
  vaultAddress,
  chainId,
  depositAmount
) {
  const data = await _fetchFromSubsquid(`{
    morphoDepositImpact(
      chainId: ${chainId},
      vaultAddress: "${vaultAddress.toLowerCase()}",
      depositAmount: "${depositAmount.toString()}"
    ) {
      currentApy
      newApy
      impactBps
    }
  }`);
  const result = data?.morphoDepositImpact;
  log(
    `subsquid deposit impact for ${vaultAddress} on chain ${chainId}: ` +
      `current=${(result.currentApy * 100).toFixed(2)}% ` +
      `new=${(result.newApy * 100).toFixed(2)}% ` +
      `impact=${result.impactBps}bps`
  );
  return {
    currentApy: result.currentApy,
    newApy: result.newApy,
    impactBps: result.impactBps,
  };
}

// ─── Morpho API (display-only — NOT used for rebalancer decisions) ────────────

/**
 * Fetch vault netApy from Morpho's own GraphQL API.
 * This is display-only (shown as "API: X.XX%" in the allocations table).
 *
 * @param {string} vaultAddress - MetaMorpho V1.1 vault address
 * @param {number} chainId
 * @returns {Promise<number>} APY as a decimal
 */
async function _fetchMorphoVaultApy(vaultAddress, chainId) {
  const query = `{
    vaultByAddress(address: "${vaultAddress}", chainId: ${chainId}) {
      state { netApy }
    }
  }`;

  try {
    const response = await fetch(MORPHO_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await response.json();
    const netApy = data?.data?.vaultByAddress?.state?.netApy;
    return netApy != null ? Number(netApy) : 0;
  } catch (e) {
    log(`Failed to fetch Morpho API APY for ${vaultAddress}: ${e.message}`);
    return 0;
  }
}

// ─── Combined fetcher ─────────────────────────────────────────────────────────

/**
 * Fetch APYs for multiple vaults in parallel.
 * Returns both subsquid (authoritative) and Morpho API (display-only) APYs.
 *
 * @param {Array} vaults - objects with { metaMorphoVaultAddress, morphoChainId }
 * @returns {Promise<{ apys: Object<string, number>, graphqlApys: Object<string, number> }>}
 */
async function fetchMorphoApys(vaults) {
  const entries = await Promise.all(
    vaults.map(async (v) => {
      const [subsquidApy, morphoApy] = await Promise.all([
        fetchSubsquidVaultApy(
          v.metaMorphoVaultAddress,
          v.morphoChainId
        ).catch((err) => {
          console.error(
            `[morpho-apy] Subsquid APY failed for ${v.metaMorphoVaultAddress} ` +
              `on chain ${v.morphoChainId}: ${err.message}`
          );
          return 0;
        }),
        _fetchMorphoVaultApy(v.metaMorphoVaultAddress, v.morphoChainId),
      ]);

      return {
        addr: v.metaMorphoVaultAddress,
        subsquidApy,
        morphoApy,
      };
    })
  );

  const apys = {};
  const graphqlApys = {};
  for (const { addr, subsquidApy, morphoApy } of entries) {
    apys[addr] = subsquidApy;
    graphqlApys[addr] = morphoApy;
  }
  return { apys, graphqlApys };
}

module.exports = { fetchMorphoApys, fetchSubsquidDepositImpact };
