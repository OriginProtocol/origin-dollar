const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { impersonateAndFund } = require("../../utils/signers");
const { parseEther } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: Harvest (Base)", function () {
  this.timeout(0);

  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  it("config", async function () {
    const { oethBaseHarvester, aerodromeEthStrategy } = fixture;

    const aeroTokenConfig = await oethBaseHarvester.rewardTokenConfigs(
      addresses.base.aeroTokenAddress
    );
    expect(aeroTokenConfig.liquidationLimit.toString()).to.be.equal("0");
    expect(aeroTokenConfig.allowedSlippageBps.toString()).to.be.equal("800");
    expect(aeroTokenConfig.harvestRewardBps.toString()).to.be.equal("100");

    expect(
      await oethBaseHarvester.supportedStrategies(aerodromeEthStrategy.address)
    ).to.be.eq(true);
  });
  it("should harvest and swap", async function () {
    const { oethBaseHarvester, aerodromeEthStrategy, oracleRouter, oethDripper } =
      fixture;
    const yieldAccrued = "1000"; // AERO tokens

    // Mock accrue yield
    const minter = await impersonateAndFund(
      "0xeB018363F0a9Af8f91F06FEe6613a751b2A33FE5"
    );
    const aeroTokenInstance = await ethers.getContractAt(
      "IERC20MintableBurnable",
      addresses.base.aeroTokenAddress
    );
    await aeroTokenInstance
      .connect(minter)
      .mint(oethBaseHarvester.address, parseEther(yieldAccrued));

    // find signer balance before
    const wethTokenInstance = await ethers.getContractAt(
      "IERC20",
      addresses.base.wethTokenAddress
    );
    const wethBalanceBefore = await wethTokenInstance.balanceOf(
      oethDripper.address
    );
    await oethBaseHarvester["harvestAndSwap(address,address)"](
      aerodromeEthStrategy.address,
      oethDripper.address
    );
    const wethBalanceAfter = await wethTokenInstance.balanceOf(
      oethDripper.address
    );

    const rate = await oracleRouter.price(addresses.base.aeroTokenAddress);
    const rewardValue = rate.mul(BigNumber.from(yieldAccrued));

    expect(rewardValue).to.approxEqualTolerance(
      wethBalanceAfter.sub(wethBalanceBefore),
      10
    );
  });
});
