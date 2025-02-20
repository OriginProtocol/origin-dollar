const { deployOnSonic } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");

module.exports = deployOnSonic(
  {
    deployName: "010_swapx_amo",
  },
  async ({ ethers }) => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    // Deploy Sonic SwapX AMO Strategy proxy
    const cOSonicProxy = await ethers.getContract("OSonicProxy");
    const cOSonicVaultProxy = await ethers.getContract("OSonicVaultProxy");
    const cOSonicVaultAdmin = await ethers.getContractAt(
      "OSonicVaultAdmin",
      cOSonicVaultProxy.address
    );
    const cHarvesterProxy = await ethers.getContract("OSonicHarvesterProxy");
    const cHarvester = await ethers.getContractAt(
      "OETHHarvesterSimple",
      cHarvesterProxy.address
    );

    const dSonicSwapXAMOStrategyProxy = await deployWithConfirmation(
      "SonicSwapXAMOStrategyProxy",
      []
    );

    const cSonicSwapXAMOStrategyProxy = await ethers.getContract(
      "SonicSwapXAMOStrategyProxy"
    );

    // Deploy Sonic SwapX AMO Strategy implementation
    const dSonicSwapXAMOStrategy = await deployWithConfirmation(
      "SonicSwapXAMOStrategy",
      [
        [addresses.sonic.SwapXWSOS.pool, cOSonicVaultProxy.address],
        cOSonicProxy.address,
        addresses.sonic.wS,
        addresses.sonic.SwapXWSOS.gauge,
      ]
    );
    const cSonicSwapXAMOStrategy = await ethers.getContractAt(
      "SonicSwapXAMOStrategy",
      dSonicSwapXAMOStrategyProxy.address
    );

    // Initialize Sonic Curve AMO Strategy implementation
    const initData = cSonicSwapXAMOStrategy.interface.encodeFunctionData(
      "initialize(address[])",
      [[addresses.sonic.SWPx]]
    );
    await withConfirmation(
      // prettier-ignore
      cSonicSwapXAMOStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dSonicSwapXAMOStrategy.address,
          addresses.sonic.timelock,
          initData
        )
    );

    return {
      actions: [
        // 1. Approve new strategy on the Vault
        {
          contract: cOSonicVaultAdmin,
          signature: "approveStrategy(address)",
          args: [cSonicSwapXAMOStrategyProxy.address],
        },
        // 2. Add strategy to mint whitelist
        {
          contract: cOSonicVaultAdmin,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cSonicSwapXAMOStrategyProxy.address],
        },
        // 3. Enable for SwapX AMO after it has been deployed
        {
          contract: cHarvester,
          signature: "setSupportedStrategy(address,bool)",
          args: [cSonicSwapXAMOStrategyProxy.address, true],
        },
        // 4. Set the Harvester on the SwapX AMO strategy
        {
          contract: cSonicSwapXAMOStrategy,
          signature: "setHarvesterAddress(address)",
          args: [cHarvesterProxy.address],
        },
      ],
    };
  }
);
