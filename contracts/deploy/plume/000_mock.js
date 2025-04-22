const { deployOnPlume } = require("../../utils/deploy-l2");
const { deployWithConfirmation } = require("../../utils/deploy");
const { replaceContractAt } = require("../../utils/hardhat");
const addresses = require("../../utils/addresses");

module.exports = deployOnPlume(
  {
    deployName: "000_mock",
    forceSkip: true,
  },
  async () => {
    // Just a workaround to get WETH on testnet
    await deployWithConfirmation("MockWETH", []);
    const mockWETH = await ethers.getContract("MockWETH");
    await replaceContractAt(addresses.plume.WETH, mockWETH);

    const weth = await ethers.getContractAt("MockWETH", addresses.plume.WETH);
    console.log("MockWETH live at", weth.address);
  }
);
