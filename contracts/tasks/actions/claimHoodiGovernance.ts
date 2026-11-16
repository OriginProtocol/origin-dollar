import { ethers } from "ethers";
import { action } from "../lib/action";
import { getContract, getContractAt } from "../lib/contracts";

// Fresh descriptors are written by make deploy-hoodi before this action is run.
action({
  name: "claimHoodiGovernance",
  chains: [560048],
  description:
    "Claim governance of the fresh Hoodi token, vault, and staking strategy",
  run: async ({ signer, log }) => {
    const account = (await signer.getAddress()).toLowerCase();
    const vault = await getContractAt(
      "OETHVault",
      (
        await getContract("OETHVaultProxy")
      ).address
    );
    const strategy = await getContractAt(
      "CompoundingStakingStrategy",
      (
        await getContract("CompoundingStakingStrategyProxy")
      ).address
    );
    if (
      (await vault.strategistAddr()).toLowerCase() !== account ||
      (await strategy.validatorRegistrator()).toLowerCase() !== account ||
      (await strategy.vaultAddress()).toLowerCase() !==
        vault.address.toLowerCase()
    )
      throw new Error(
        "Fresh Hoodi contracts are not configured for this relayer"
      );
    const token = await getContractAt(
      "OETH",
      (
        await getContract("OETHProxy")
      ).address
    );
    if ((await vault.oToken()).toLowerCase() !== token.address.toLowerCase()) {
      throw new Error("Hoodi token/vault mismatch");
    }
    for (const target of [token, vault, strategy]) {
      const proxy = new ethers.Contract(
        target.address,
        [
          "function governor() view returns (address)",
          "function claimGovernance()",
        ],
        signer
      );
      if ((await proxy.governor()).toLowerCase() !== account) {
        const tx = await proxy.claimGovernance();
        await tx.wait();
      }
      if ((await proxy.governor()).toLowerCase() !== account)
        throw new Error("Governance claim failed");
      log.info(`Hoodi governance held by ${account}: ${proxy.address}`);
    }
  },
});
