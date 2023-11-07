const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");
const { balancer_rETH_WETH_PID } = require("../utils/constants");

const platformAddress = addresses.mainnet.rETH_WETH_BPT;

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "077_balancer_rETH_WETH",
    forceDeploy: false,
    //forceSkip: true,
    deployerIsProposer: false,
    proposalId:
      "74218378193341950599723121963495928807921066995654503883276572108846598568193",
  },
  async ({ deployWithConfirmation, ethers }) => {
    // Current contracts
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");

    // Deployer Actions
    // ----------------
    const cOETHBalancerMetaPoolStrategyProxy = await ethers.getContract(
      "OETHBalancerMetaPoolrEthStrategyProxy"
    );

    // 1. Deploy new Balancer strategy implementation
    const dOETHBalancerMetaPoolStrategyImpl = await deployWithConfirmation(
      "BalancerMetaPoolStrategy",
      [
        [platformAddress, cOETHVaultProxy.address],
        [
          addresses.mainnet.rETH,
          addresses.mainnet.stETH,
          addresses.mainnet.wstETH,
          addresses.mainnet.frxETH,
          addresses.mainnet.sfrxETH,
          addresses.mainnet.balancerVault, // Address of the Balancer vault
          balancer_rETH_WETH_PID, // Pool ID of the Balancer pool
        ],
        addresses.mainnet.rETH_WETH_AuraRewards, // Address of the Aura rewards contract
      ]
    );

    console.log(
      "Balancer strategy address:",
      cOETHBalancerMetaPoolStrategyProxy.address
    );

    // Governance Actions
    // ----------------
    return {
      name: "Deploy new implementation of Balancer rETH/WETH MetaPool strategy\n\
      \n\
      The new implementation of the Balancer rETH/WETH strategy fixes the checkBalance function that could report confusing information - even though it had no impact on the operations of the protocol.\n\
      \n\
      ",
      actions: [
        // 1. Upgrade strategy implementation
        {
          contract: cOETHBalancerMetaPoolStrategyProxy,
          signature: "upgradeTo(address)",
          args: [dOETHBalancerMetaPoolStrategyImpl.address],
        },
      ],
    };
  }
);
