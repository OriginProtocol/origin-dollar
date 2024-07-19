const { deployOnBaseWithGuardian } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const { utils } = require("ethers");

module.exports = deployOnBaseWithGuardian(
  {
    deployName: "004_base_harvester",
  },
  async ({ ethers }) => {
    const { deployerAddr, governorAddr } = await getNamedAccounts();
    const sDeployer = await ethers.provider.getSigner(deployerAddr);

    const cOETHbVaultProxy = await ethers.getContract("OETHBaseVaultProxy");

    // Deploy proxy
    await deployWithConfirmation("OETHBaseHarvesterProxy");
    const cOETHbHarvesterProxy = await ethers.getContract(
      "OETHBaseHarvesterProxy"
    );

    // Deploy implementation
    const dOETHbHarvester = await deployWithConfirmation("OETHBaseHarvester", [
      cOETHbVaultProxy.address,
      addresses.base.WETH,
      addresses.base.AERO,
    ]);

    // Init OETHb Harvester
    // prettier-ignore
    await withConfirmation(
      cOETHbHarvesterProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          dOETHbHarvester.address,
          governorAddr,
          []
        )
    );
    console.log("Initialized OETHBaseHarvesterProxy");

    const cOETHbHarvester = await ethers.getContractAt(
      "OETHBaseHarvester",
      cOETHbHarvesterProxy.address
    );

    return {
      actions: [
        {
          // 1. Rewards proceeds address
          contract: cOETHbHarvester,
          signature: "setRewardProceedsAddress(address)",
          args: [
            // TODO: Vault receives the yield directly
            // Confirm if no Dripper is needed
            cOETHbVaultProxy.address,
          ],
        },
        {
          // 2. Aero Token Config
          // TODO: Fix after adding support for Aerodrome
          contract: cOETHbHarvester,
          signature:
            "setRewardTokenConfig(address,(uint16,uint16,address,bool,uint8,uint256),bytes)",
          args: [
            addresses.base.AERO,
            {
              allowedSlippageBps: 500,
              harvestRewardBps: 100,
              swapPlatform: 0, // Aerodrome, Uniswap V2-compatible
              swapPlatformAddr: addresses.base.aeroRouterAddress,
              liquidationLimit: 0,
              doSwapRewardToken: true,
            },
            utils.defaultAbiCoder.encode(
              ["address[]"],
              [[addresses.base.AERO, addresses.base.WETH]]
            ),
          ],
        },
        {
          // 3. Aero Performance Fee Config
          contract: cOETHbHarvester,
          signature: "setAeroPerformanceFeeConfig(uint16,address)",
          args: [
            300, // 30% fee
            governorAddr, // Governor receives the performance fee
          ],
        },
      ],
    };
  }
);
