const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");
const { impersonateAndFund } = require("../../utils/signers");
const {
  getClusterInfo,
  normalizeCluster,
  splitOperatorIds,
} = require("../../utils/ssv");
const { isFork } = require("../../test/helpers");
const { hashPubKey } = require("../../utils/beacon");
const {
  getStorageAt,
  setStorageAt,
} = require("@nomicfoundation/hardhat-network-helpers");
const { BigNumber } = require("ethers");
const { keccak256, solidityPack, hexZeroPad } = require("ethers/lib/utils");

const compoundingSsvClusterOperatorIds = "2070,2071,2072,2073";
const validatorMappingSlot = 55;
const exitedValidatorState = 6;
const compoundingSsvValidatorPubkeys = [
  "0x8b5f08ce7af02245ae664a96fde5af1585edaa257f852490e5bb1957f1b3433b9b213577a3e475d6b034618f641f3bee",
  "0x8a29191751a94a7eb921cd832972a875376b629bd3978c92ab3daaf596cab5e3cd1877cf63e65fe59ccc769c3b77a607",
  "0xb5d37226e27e0ab066541ccb795e04149300bb8c0b0fd528785f6a940e94c624b65ef1eb771f78a5f2685317b7e6f34f",
  "0x87b76ce8ea170a8a6db6842848eca2f3117367ada43120401a7f3095498a910a1455352bd12d15f5a07693f61e5b8c37",
  "0x8427639adf9c746f7d7271ddee3bbcd7a1f3b4beb3bd67224c345d7c7e7cffd58d61d5bc84a3ab7d0f909ebf71da7b8b",
  "0x84ef4399aa33bbea588965cad4f1df99a2586ef2791cc2527677f1f10a922996ad9b6cd7c8287ca215dc7dffb2e7946d",
  "0x9695233248996e2d288baef676ee03ef30467eba161258894abeb382fa89ed7381dac05745a5c95df456533ef8a5fdad",
  "0x9226889b28bee5478d0039a86bb913b645769ec3af18f08cc93ab46421fe8b3493e7e13b381682cf48fd3d5fa67c2f08",
  "0x8f52f57132e409e749f0fc8305c4e2784c33abf43f80f1cc329b06ca94f7c50638b47a350b03c2ef4cc72860fee29730",
  "0xa4258aa50aba9d7441f734213ae76fad9809572a593765c25c25d7afd42b83baba06397bd9e264a9fa24c3327a308682",
];

const setForkValidatorExited = async (strategy, pubkey) => {
  const validatorSlot = keccak256(
    solidityPack(
      ["bytes32", "uint256"],
      [hashPubKey(pubkey), validatorMappingSlot]
    )
  );
  const existingValue = BigNumber.from(
    await getStorageAt(strategy.address, validatorSlot)
  );
  const exitedValue = existingValue
    .and(BigNumber.from(2).pow(256).sub(256))
    .or(exitedValidatorState);

  await setStorageAt(
    strategy.address,
    validatorSlot,
    hexZeroPad(exitedValue.toHexString(), 32)
  );
};

const parseRemovedCluster = (ssvNetwork, receipt) => {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== ssvNetwork.address.toLowerCase()) {
      continue;
    }

    try {
      const parsed = ssvNetwork.interface.parseLog(log);
      if (parsed.name === "ValidatorRemoved") {
        return parsed.args.cluster;
      }
    } catch (err) {
      // Ignore logs from other SSV events.
    }
  }

  throw new Error("ValidatorRemoved event not found");
};

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "197_remove_old_compounding_ssv_strategy",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ ethers }) => {
    const { chainId } = await ethers.provider.getNetwork();

    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );
    const cCompoundingStakingSSVStrategyProxy = await ethers.getContract(
      "CompoundingStakingSSVStrategyProxy"
    );
    const cCompoundingStakingSSVStrategy = await ethers.getContractAt(
      "CompoundingStakingSSVStrategy",
      cCompoundingStakingSSVStrategyProxy.address
    );

    const compoundingOperatorIds = splitOperatorIds(
      compoundingSsvClusterOperatorIds
    );
    let { cluster: compoundingSsvCluster } = await getClusterInfo({
      chainId,
      operatorids: compoundingOperatorIds.join(","),
      ownerAddress: cCompoundingStakingSSVStrategyProxy.address,
    });

    if (isFork && Number(compoundingSsvCluster.validatorCount) !== 0) {
      const cConsolidationController = await ethers.getContract(
        "ConsolidationController"
      );
      const cSsvNetwork = await ethers.getContractAt(
        "ISSVNetwork",
        addresses.mainnet.SSVNetwork
      );
      const sValidatorRegistrator = await impersonateAndFund(
        addresses.mainnet.talosRelayer
      );

      console.log(
        `Removing ${compoundingSsvValidatorPubkeys.length} validators from old compounding SSV cluster on fork`
      );

      for (const pubkey of compoundingSsvValidatorPubkeys) {
        await setForkValidatorExited(cCompoundingStakingSSVStrategy, pubkey);

        const tx = await cConsolidationController
          .connect(sValidatorRegistrator)
          .removeSsvValidator(
            cCompoundingStakingSSVStrategy.address,
            pubkey,
            compoundingOperatorIds,
            compoundingSsvCluster
          );
        const receipt = await tx.wait();
        compoundingSsvCluster = normalizeCluster(
          parseRemovedCluster(cSsvNetwork, receipt)
        );
      }
    }

    if (Number(compoundingSsvCluster.validatorCount) !== 0) {
      throw new Error(
        `Compounding SSV cluster still has ${compoundingSsvCluster.validatorCount} validators`
      );
    }

    const compoundingSsvClusterEthBalance = ethers.BigNumber.from(
      compoundingSsvCluster.balance
    );

    console.log(
      `Withdrawing ${ethers.utils.formatEther(
        compoundingSsvClusterEthBalance
      )} ETH from the old compounding SSV cluster`
    );

    return {
      name: "Withdraw old compounding SSV cluster ETH and remove strategy from OETH Vault",
      actions: [
        {
          contract: cCompoundingStakingSSVStrategy,
          signature:
            "withdrawSsvClusterEth(uint64[],uint256,(uint32,uint64,uint64,bool,uint256))",
          args: [
            compoundingOperatorIds,
            compoundingSsvClusterEthBalance,
            compoundingSsvCluster,
          ],
        },
        {
          contract: cOETHVault,
          signature: "removeStrategy(address)",
          args: [cCompoundingStakingSSVStrategyProxy.address],
        },
      ],
    };
  }
);
