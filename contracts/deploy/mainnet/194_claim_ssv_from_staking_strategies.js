const addresses = require("../../utils/addresses");
const { deploymentWithGovernanceProposal } = require("../../utils/deploy");

const strategyConfigs = [
  {
    proxyName: "NativeStakingSSVStrategy2Proxy",
    label: "2nd Native Staking SSV Strategy",
  },
  {
    proxyName: "NativeStakingSSVStrategy3Proxy",
    label: "3rd Native Staking SSV Strategy",
  },
  {
    proxyName: "CompoundingStakingSSVStrategyProxy",
    label: "Compounding Staking SSV Strategy",
  },
];

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "194_claim_ssv_from_staking_strategies",
    forceDeploy: false,
    reduceQueueTime: true,
    deployerIsProposer: false,
    proposalId: "",
  },
  async ({ ethers }) => {
    const ssv = await ethers.getContractAt("IERC20", addresses.mainnet.SSV);
    const recipient = addresses.multichainStrategist;
    const actions = [];

    let totalSSV = ethers.BigNumber.from(0);

    for (const strategyConfig of strategyConfigs) {
      const proxy = await ethers.getContract(strategyConfig.proxyName);
      const strategy = await ethers.getContractAt("IStrategy", proxy.address);
      const balance = await ssv.balanceOf(strategy.address);

      console.log(
        `${strategyConfig.label} ${
          strategy.address
        } has ${ethers.utils.formatEther(balance)} SSV`
      );

      if (balance.isZero()) {
        continue;
      }

      actions.push({
        contract: strategy,
        signature: "transferToken(address,uint256)",
        args: [ssv.address, balance],
      });

      totalSSV = totalSSV.add(balance);
    }

    if (totalSSV.isZero()) {
      throw new Error("No SSV found on staking strategies");
    }

    actions.push({
      contract: ssv,
      signature: "transfer(address,uint256)",
      args: [recipient, totalSSV],
    });

    console.log(
      `Transferring ${ethers.utils.formatEther(totalSSV)} SSV to ${recipient}`
    );

    return {
      name: "Claim SSV from staking strategies and transfer to Guardian multisig",
      actions,
    };
  }
);
