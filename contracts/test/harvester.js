const {
  defaultFixture,
  convexVaultFixture,
  multiStrategyVaultFixture,
} = require("./_fixture");
const { expect } = require("chai");
const { utils, constants } = require("ethers");

const { loadFixture, isFork } = require("./helpers");
const addresses = require("./../utils/addresses");

describe("Harvester", function () {
  if (isFork) {
    this.timeout(0);
  }

  let anna,
    ousd,
    vault,
    harvester,
    governor,
    crv,
    cvx,
    threePoolToken,
    convexStrategy,
    cvxBooster,
    usdt,
    usdc;

  const mint = async (amount, asset) => {
    await asset.connect(anna).mint(units(amount, asset));
    await asset.connect(anna).approve(vault.address, units(amount, asset));
    return await vault
      .connect(anna)
      .mint(asset.address, units(amount, asset), 0);
  };

  beforeEach(async function () {
    const fixture = await loadFixture(convexVaultFixture);
    anna = fixture.anna;
    vault = fixture.vault;
    harvester = fixture.harvester;
    governor = fixture.governor;
    crv = fixture.crv;
    cvx = fixture.cvx;
    threePoolToken = fixture.threePoolToken;
    convexStrategy = fixture.convexStrategy;
    usdt = fixture.usdt;
    usdc = fixture.usdc;

    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdc.address, convexStrategy.address);
    await vault
      .connect(governor)
      .setAssetDefaultStrategy(usdt.address, convexStrategy.address);
  });

  it("Should correctly set reward token config and have correct allowances set for uniswap routers", async () => {
    const mockUniswapRouter = await ethers.getContract("MockUniswapRouter");

    console.error(
      "00",
      await crv.allowance(harvester.address, mockUniswapRouter.address)
    );
    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        crv.address,
        300,
        100,
        mockUniswapRouter.address,
        utils.parseUnits("1.44", 18)
      );

    let crvConfig = await harvester.rewardTokenConfigs(crv.address);

    expect(crvConfig.liquidationLimit).to.equal(utils.parseUnits("1.44", 18));
    expect(crvConfig.allowedSlippageBps).to.equal(300);
    expect(crvConfig.harvestRewardBps).to.equal(100);
    expect(crvConfig.uniswapV2CompatibleAddr).to.equal(
      mockUniswapRouter.address
    );

    expect(
      await crv.allowance(harvester.address, mockUniswapRouter.address)
    ).to.equal(constants.MaxUint256);
    expect(
      await crv.allowance(harvester.address, addresses.mainnet.uniswapV3Router)
    ).to.equal(0);

    await harvester
      .connect(governor)
      .setRewardTokenConfig(
        crv.address,
        350,
        120,
        addresses.mainnet.uniswapV3Router,
        utils.parseUnits("1.22", 18)
      );

    crvConfig = await harvester.rewardTokenConfigs(crv.address);

    expect(
      await crv.allowance(harvester.address, mockUniswapRouter.address)
    ).to.equal(0);
    expect(
      await crv.allowance(harvester.address, addresses.mainnet.uniswapV3Router)
    ).to.equal(constants.MaxUint256);

    expect(crvConfig.liquidationLimit).to.equal(utils.parseUnits("1.22", 18));
    expect(crvConfig.allowedSlippageBps).to.equal(350);
    expect(crvConfig.harvestRewardBps).to.equal(120);
  });

  it("Should fail when token configuration is missing", async () => {
    await harvester.connect(governor).addSwapToken(crv.address);
    await harvester.connect(governor).addSwapToken(cvx.address);

    await expect(
      harvester.connect(anna)["harvestAndSwap()"]()
    ).to.be.revertedWith("Swap token is missing token configuration.");
  });
});
