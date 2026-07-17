import { action } from "../lib/viemAction";

// Vault proxy deployment name(s) per chain id. addWithdrawalQueueLiquidity is
// permissionless and a no-op when the withdrawal queue has no shortfall, so it
// is safe to call on every OToken vault on the network. Mainnet has two vaults
// (OUSD + OETH); the L2s have one each.
const VAULT_DEPLOYMENTS_BY_CHAIN_ID: Record<number, string[]> = {
  1: ["VaultProxy", "OETHVaultProxy"], // mainnet: OUSD + OETH
  8453: ["OETHBaseVaultProxy"], // base: Super OETH
  146: ["OSonicVaultProxy"], // sonic: Origin Sonic
  98866: ["OETHPlumeVaultProxy"], // plume: Super OETH
};

action({
  name: "otokenAddWithdrawalQueueLiquidity",
  description:
    "Call addWithdrawalQueueLiquidity on every OToken vault on the current network",
  chains: Object.keys(VAULT_DEPLOYMENTS_BY_CHAIN_ID).map(Number),
  run: async ({ chainId, networkName, log, resolveContract, writeContract }) => {
    const deploymentNames = VAULT_DEPLOYMENTS_BY_CHAIN_ID[chainId];

    for (const deploymentName of deploymentNames) {
      // Address from the proxy deployment (deployed truth); ABI from the
      // curated IVault interface (the proxy artifact's own ABI is admin-only).
      const vault = resolveContract({
        deploymentName,
        abiFrom: { kind: "curated", file: "IVault" },
      });

      log.info(
        `Calling addWithdrawalQueueLiquidity on ${deploymentName} at ${vault.address} (${networkName})`
      );
      await writeContract(
        vault,
        "addWithdrawalQueueLiquidity",
        [],
        `addWithdrawalQueueLiquidity:${deploymentName}`,
        { gas: 400000n }
      );
    }
  },
});
