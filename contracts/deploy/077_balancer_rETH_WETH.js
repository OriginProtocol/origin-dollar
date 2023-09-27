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
    proposalId: "56592381723485287954592129736025898843308662712094761381994317989536511548227",
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
      The new implementation of the Balancer rETH/WETH strategy pool fixes a medium vulnerability of the strategy's checkBalance function.\n\
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
