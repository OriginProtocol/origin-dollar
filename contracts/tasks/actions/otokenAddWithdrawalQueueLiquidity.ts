import { BigNumber, ethers } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";
import { logTxDetails } from "../../utils/txLogger";

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

// Mirrors VaultCore._addWithdrawalQueueLiquidity — keep in sync. Computed
// off-chain so the 10-minute schedule only spends gas when the call would
// actually increase the queue's claimable amount.
export function computeClaimableToAdd({
  queued,
  claimable,
  claimed,
  balance,
}: {
  queued: BigNumber;
  claimable: BigNumber;
  claimed: BigNumber;
  balance: BigNumber;
}) {
  const shortfall = queued.sub(claimable);
  const allocated = claimable.sub(claimed);
  let added = BigNumber.from(0);
  if (shortfall.gt(0) && balance.gt(allocated)) {
    const unallocated = balance.sub(allocated);
    added = shortfall.lt(unallocated) ? shortfall : unallocated;
  }
  return { added, shortfall, allocated };
}

async function claimableToAdd(vault: ethers.Contract) {
  const { queued, claimable, claimed } = await vault.withdrawalQueueMetadata();
  const asset = await getContractAt("IERC20", await vault.asset());
  const balance: BigNumber = await asset.balanceOf(vault.address);
  const decimals: number = await asset.decimals();

  return {
    ...computeClaimableToAdd({ queued, claimable, claimed, balance }),
    balance,
    decimals,
  };
}

action({
  name: "otokenAddWithdrawalQueueLiquidity",
  description:
    "Call addWithdrawalQueueLiquidity on every OToken vault on the current network when it would add claimable liquidity",
  chains: Object.keys(VAULT_DEPLOYMENTS_BY_CHAIN_ID).map(Number),
  run: async ({ signer, chainId, networkName, log }) => {
    const deploymentNames = VAULT_DEPLOYMENTS_BY_CHAIN_ID[chainId];

    for (const deploymentName of deploymentNames) {
      const vaultProxy = await getContract(deploymentName);
      const vault = await getContractAt("IVault", vaultProxy.address);

      const { added, shortfall, balance, allocated, decimals } =
        await claimableToAdd(vault);
      const fmt = (v: BigNumber) => formatUnits(v, decimals);

      if (added.isZero()) {
        log.info(
          `Skipping ${deploymentName} at ${vault.address} (${networkName}): nothing to add ` +
            `(shortfall ${fmt(shortfall)}, balance ${fmt(
              balance
            )}, allocated ${fmt(allocated)})`
        );
        continue;
      }

      log.info(
        `Calling addWithdrawalQueueLiquidity on ${deploymentName} at ${
          vault.address
        } (${networkName}) to add ${fmt(added)} claimable`
      );
      const tx = await vault
        .connect(signer)
        .addWithdrawalQueueLiquidity({ gasLimit: 400000 });
      await logTxDetails(tx, `addWithdrawalQueueLiquidity:${deploymentName}`);
    }
  },
});
