const { deploymentWithGovernanceProposal } = require("../utils/deploy");
const addresses = require("../utils/addresses");

module.exports = deploymentWithGovernanceProposal(
  {
    deployName: "084_support_ethx",
    forceDeploy: false,
    // forceSkip: true,
    // onlyOnFork: true, // this is only executed in forked environment
    // reduceQueueTime: true, // just to solve the issue of later active proposals failing
  },
  async ({ ethers }) => {
    // Current contracts
    const cOETHVaultProxy = await ethers.getContract("OETHVaultProxy");
    const cOETHVault = await ethers.getContractAt(
      "IVault",
      cOETHVaultProxy.address
    );

    // Deploy the new Router
    await deployWithConfirmation("OETHOracleRouter");
    const cOETHOracleRouter = await ethers.getContract("OETHOracleRouter");

    // Cache decimals of all known tokens
    await withConfirmation(
      // CRV/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.CRV)
    );

    await withConfirmation(
      // CVX/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.CVX)
    );

    await withConfirmation(
      // rETH/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.rETH)
    );

    await withConfirmation(
      // stETH/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.stETH)
    );

    await withConfirmation(
      // frxETH/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.frxETH)
    );

    await withConfirmation(
      // frxETH/ETH
      cOETHOracleRouter.cacheDecimals(addresses.mainnet.ETHx)
    );

    // Governance Actions
    // ----------------
    return {
      name: "Shorten OETH Dripper Time\n\
      \n\
      Change the OETH dripper time down to 7 days.\n\
      \n\
      The OETH dripper's duration was set to a long 14 days last month to avoid dripping out all AURA and BAL token rewards too quickly.\
      Now that some time has passed, we can reduce the duration to a more normal size. \
      In the short term this will result in increase of funds flowing from the dripper to OETH.\
      ",
      actions: [
        {
          contract: cOETHVault,
          signature: "setPriceProvider(address)",
          args: [cOETHOracleRouter.address],
        },
        {
          contract: cOETHVault,
          signature: "supportAsset(address,uint8)",
          args: [
            addresses.mainnet.ETHx,
            0 // Decimal conversion 
          ],
        }
      ],
    };
  }
);
