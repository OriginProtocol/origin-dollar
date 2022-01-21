const {
  defaultFixture,
  compoundVaultFixture,
  multiStrategyVaultFixture,
} = require("./../_fixture");
const { expect } = require("chai");
const { utils, constants } = require("ethers");

const { loadFixture, isFork } = require("./../helpers");
const addresses = require("./../../utils/addresses");

describe("Harvester", function () {
  if (isFork) {
    this.timeout(0);
  }

  it("Should fail when token configuration is missing", async () => {
    const { harvester, governor, comp, anna } = await loadFixture(
      compoundVaultFixture
    );
    await harvester.connect(governor).addSwapToken(comp.address);

    await expect(
      harvester.connect(anna)["harvestAndSwap()"]()
    ).to.be.revertedWith("Swap token is missing token configuration.");
  });

  it("Should correctly set reward token config and have correct allowances set for Uniswap like routers", async () => {
    const { harvester, governor, comp, anna } = await loadFixture(
      compoundVaultFixture
    );
    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        300,
        100,
        mockUniswapRouter.address,
        utils.parseUnits("1.44", 18)
      );

    let compConfig = await harvester.rewardTokenConfigs(comp.address);

    expect(compConfig.liquidationLimit).to.equal(utils.parseUnits("1.44", 18));
    expect(compConfig.allowedSlippageBps).to.equal(300);
    expect(compConfig.harvestRewardBps).to.equal(100);
    expect(compConfig.uniswapV2CompatibleAddr).to.equal(
      mockUniswapRouter.address
    );

    expect(
      await comp.allowance(harvester.address, mockUniswapRouter.address)
    ).to.equal(constants.MaxUint256);
    expect(
      await comp.allowance(harvester.address, addresses.mainnet.uniswapV3Router)
    ).to.equal(0);

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        comp.address,
        350,
        120,
        addresses.mainnet.uniswapV3Router,
        utils.parseUnits("1.22", 18)
      );

    compConfig = await harvester.rewardTokenConfigs(comp.address);

    expect(
      await comp.allowance(harvester.address, mockUniswapRouter.address)
    ).to.equal(0);
    expect(
      await comp.allowance(harvester.address, addresses.mainnet.uniswapV3Router)
    ).to.equal(constants.MaxUint256);

    expect(compConfig.liquidationLimit).to.equal(utils.parseUnits("1.22", 18));
    expect(compConfig.allowedSlippageBps).to.equal(350);
    expect(compConfig.harvestRewardBps).to.equal(120);
  });

  it("Should fail when calling harvest or harvestAndSwap with the non valid strategy address", async () => {
    const { harvester, governor, comp, anna } = await loadFixture(
      compoundVaultFixture
    );
    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    await expect(
      harvester
        .connect(anna)
        ["harvestAndSwap(address)"](mockUniswapRouter.address)
    ).to.be.revertedWith("Not a valid strategy address");

    await expect(
      harvester.connect(governor)["harvest(address)"](mockUniswapRouter.address)
    ).to.be.revertedWith("Not a valid strategy address");
  });
});
