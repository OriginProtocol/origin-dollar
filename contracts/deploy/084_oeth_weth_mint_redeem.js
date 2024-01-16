const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "084_oeth_weth_mint_redeem",
    forceDeploy: false,
    reduceQueueTime: true,
    //proposalId: ""
  },
  async ({ assetAddresses, deployWithConfirmation }) => {
    // Deployer Actions
    // ----------------

    // 1. Deploy new OETH Vault Core and Admin implementations
    // Need to override the storage safety check as we are repacking the
    // internal assets mapping to just use 1 storage slot
    const dVaultCore = await deployWithConfirmation(
      "OETHVaultCore",
      [addresses.mainnet.WETH],
      null,
      true
    );
    const dVaultAdmin = await deployWithConfirmation(
      "OETHVaultAdmin",
      [addresses.mainnet.WETH],
      null,
      true
    );

    // 2. Connect to the OETH Vault as its governor via the proxy
    const cVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cVault = await ethers.getContractAt("OETHVault", cVaultProxy.address);

    // Governance Actions
    // ----------------
    return {
      name: "Weth only mint & redeem Vault Upgrade\n\
      \n\
      The Vault allows for WETH only mint and redeems without any fees.\n\
      \n\
      In the interest of increasing composability of OETH with other protocols this \
      upgrade allows for WETH only minting and redeeming. This enables the protocol to remove \
      any fees on minting & redeeming and reduces the gas cost of both functions.\
      ",
      actions: [
        // 1. Upgrade the OETH Vault proxy to the new core vault implementation
        {
          contract: cVaultProxy,
          signature: "upgradeTo(address)",
          args: [dVaultCore.address],
        },
        // 2. set OETH Vault proxy to the new admin vault implementation
        {
          contract: cVault,
          signature: "setAdminImpl(address)",
          args: [dVaultAdmin.address],
        },
        // 3. set redeem fee to 0%
        {
          contract: cVault,
          signature: "setRedeemFeeBps(uint256)",
          args: [0],
        },
      ],
    };
  }
);
