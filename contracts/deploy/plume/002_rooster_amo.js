const hre = require("hardhat");
const { deployOnPlume } = require("../../utils/deploy-l2");
const {
  deployWithConfirmation,
  withConfirmation,
} = require("../../utils/deploy");
const addresses = require("../../utils/addresses");
const {
  deployOSWETHRoosterAmoPool,
  deployPlumeRoosterAMOStrategyImplementation
} = require("../deployActions");
const { isFork, oethUnits } = require("../../test/helpers");
const { setERC20TokenBalance } = require("../../test/_fund");

module.exports = deployOnPlume(
  {
    deployName: "002_rooster_amo",
  },
  async () => {
    const { deployerAddr } = await getNamedAccounts();
    const sDeployer = await ethers.getSigner(deployerAddr);
    const cOETHpVaultProxy = await ethers.getContract("OETHPlumeVaultProxy");

    const cOETHpVault = await ethers.getContractAt(
      "IVault",
      cOETHpVaultProxy.address
    );


    // TODO: delete the pool creation contract once it is already live
    const poolAddress = await deployOSWETHRoosterAmoPool();
    console.log("OETHp / WETH pool deployed at ", poolAddress);

    await deployWithConfirmation("RoosterAMOStrategyProxy");
    const cAMOStrategyProxy = await ethers.getContract(
      "RoosterAMOStrategyProxy"
    );

    const cAMOStrategyImpl = await deployPlumeRoosterAMOStrategyImplementation(poolAddress);

    await withConfirmation(
      cAMOStrategyProxy
        .connect(sDeployer)["initialize(address,address,bytes)"](
          cAMOStrategyImpl.address,
          // TODO: change governor when needed
          //addresses.plume.governor,
          deployerAddr,
          "0x"
        )
    );

    const cAMOStrategy = await ethers.getContractAt(
      "RoosterAMOStrategy",
      cAMOStrategyProxy.address
    );

    if (isFork) {
      const weth = await ethers.getContractAt(
        "IWETH9",
        addresses.plume.WETH
      );

      // 50 WETH
      await setERC20TokenBalance(sDeployer.address, weth, "50", hre);
      await weth.connect(sDeployer).transfer(cAMOStrategy.address, oethUnits("10"));
      console.log("WETH balance", (await weth.connect(sDeployer).balanceOf(sDeployer.address)).toString());
    }

    return {
      actions: [
        {
          // Approve the AMO strategy on the Vault
          contract: cOETHpVault,
          signature: "approveStrategy(address)",
          args: [cAMOStrategy.address],
        },
        {
          // Set strategy as whitelisted one to mint OETHp tokens
          contract: cOETHpVault,
          signature: "addStrategyToMintWhitelist(address)",
          args: [cAMOStrategy.address],
        },
        {
          // Safe approve tokens
          contract: cAMOStrategy,
          signature: "safeApproveAllTokens()",
          args: [],
        },
        {
          // Safe approve tokens
          contract: cAMOStrategy,
          signature: "mintInitialPosition()",
          args: [],
        },
        {
          // Safe approve tokens
          contract: cAMOStrategy,
          signature: "donateLiquidity()",
          args: [],
        }
      ],
    };
  }
);
