const {
  createFixtureLoader,
  claimRewardsModuleFixture,
} = require("../_fixture");
const { expect } = require("chai");
const { ethers } = require("hardhat");

const mainnetFixture = createFixtureLoader(claimRewardsModuleFixture);

describe("ForkTest: Claim Strategy Rewards Safe Module", function () {
  let fixture;

  beforeEach(async () => {
    fixture = await mainnetFixture();
  });

  it("Should claim CRV rewards", async () => {
    const { crv, safeSigner, claimRewardsModule } = fixture;

    const cOUSDCurveAMOProxy = await ethers.getContract("OUSDCurveAMOProxy");
    const cOETHCurveAMOProxy = await ethers.getContract("OETHCurveAMOProxy");
    const strategies = [cOUSDCurveAMOProxy.address, cOETHCurveAMOProxy.address];

    let crvBalanceInStrategies = ethers.BigNumber.from(0);

    for (const strategy of strategies) {
      crvBalanceInStrategies = (await crv.balanceOf(strategy)).add(
        crvBalanceInStrategies
      );
    }

    const crvBalanceBefore = await crv.balanceOf(safeSigner.address);

    await claimRewardsModule.connect(safeSigner).claimRewards(true);

    const crvBalanceAfter = await crv.balanceOf(safeSigner.address);

    expect(crvBalanceAfter).to.gte(
      crvBalanceBefore.add(crvBalanceInStrategies)
    );

    for (const strategy of strategies) {
      expect(await crv.balanceOf(strategy)).to.eq(0);
    }
  });

  it("Should claim Morpho rewards", async () => {
    const { morphoToken, safeSigner, claimRewardsModule } = fixture;

    const cGauntletUSDCStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDCStrategyProxy"
    );
    const cGauntletUSDTStrategyProxy = await ethers.getContract(
      "MorphoGauntletPrimeUSDTStrategyProxy"
    );
    const cMetaMorphoStrategyProxy = await ethers.getContract(
      "MetaMorphoStrategyProxy"
    );
    const strategies = [
      cGauntletUSDCStrategyProxy.address,
      cGauntletUSDTStrategyProxy.address,
      cMetaMorphoStrategyProxy.address,
    ];

    let morphoBalanceInStrategies = ethers.BigNumber.from(0);

    for (const strategy of strategies) {
      morphoBalanceInStrategies = (await morphoToken.balanceOf(strategy)).add(
        morphoBalanceInStrategies
      );
    }

    const morphoBalanceBefore = await morphoToken.balanceOf(safeSigner.address);

    await claimRewardsModule.connect(safeSigner).claimRewards(true);

    const morphoBalanceAfter = await morphoToken.balanceOf(safeSigner.address);

    expect(morphoBalanceAfter).to.gte(
      morphoBalanceBefore.add(morphoBalanceInStrategies)
    );

    for (const strategy of strategies) {
      expect(await morphoToken.balanceOf(strategy)).to.eq(0);
    }
  });
});
