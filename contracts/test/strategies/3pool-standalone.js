const { expect } = require("chai");
const { utils } = require("ethers");

const { BigNumber } = require("ethers");
const { threepoolFixture } = require("../_fixture");
const { loadFixture, units } = require("../helpers");

describe("3Pool Strategy Standalone", function () {
  let governor,
    threePool,
    threePoolToken,
    threePoolStrategy,
    threePoolGauge,
    tpStandalone,
    usdt,
    usdc,
    dai;

  beforeEach(async function () {
    ({
      governor,
      threePool,
      threePoolToken,
      threePoolGauge,
      tpStandalone,
      usdt,
      usdc,
      dai,
    } = await loadFixture(threepoolFixture));
    threePoolStrategy = tpStandalone.connect(governor);
  });

  const deposit = async (amount, asset) => {
    await asset
      .connect(governor)
      .transfer(threePoolStrategy.address, units(amount, asset));
    await threePoolStrategy.deposit(asset.address, units(amount, asset));
  };

  it("Should deposit all", async function () {
    await dai
      .connect(governor)
      .transfer(threePoolStrategy.address, units("100", dai));
    await usdt
      .connect(governor)
      .transfer(threePoolStrategy.address, units("200", usdt));
    await usdc
      .connect(governor)
      .transfer(threePoolStrategy.address, units("300", usdc));
    await threePoolStrategy.depositAll();
    await expect(await threePoolGauge.balanceOf(threePoolStrategy.address)).eq(
      utils.parseUnits("600", 18)
    );
  });

  it("Should withdraw all", async function () {
    const governorAddress = await governor.getAddress();
    const governorDai = await dai.balanceOf(governorAddress);
    const governorUsdt = await usdt.balanceOf(governorAddress);
    const governorUsdc = await usdc.balanceOf(governorAddress);

    await dai
      .connect(governor)
      .transfer(threePoolStrategy.address, units("100", dai));
    await usdt
      .connect(governor)
      .transfer(threePoolStrategy.address, units("200", usdt));
    await usdc
      .connect(governor)
      .transfer(threePoolStrategy.address, units("300", usdc));
    await threePoolStrategy.depositAll();

    await expect(await dai.balanceOf(governorAddress)).eq(
      governorDai.sub(await units("100", dai))
    );
    await expect(await usdt.balanceOf(governorAddress)).eq(
      governorUsdt.sub(await units("200", usdt))
    );
    await expect(await usdc.balanceOf(governorAddress)).eq(
      governorUsdc.sub(await units("300", usdc))
    );

    // NOTE tpStandlone configures Governor as the Vault
    // Withdraw everything from 3pool. which will unstake from Gauge and return
    // assets to Governor
    await threePoolStrategy.withdrawAll();

    // Check balances of Governor, withdrawn assets reside here
    await expect(await dai.balanceOf(governorAddress)).eq(governorDai);
    await expect(await usdt.balanceOf(governorAddress)).eq(governorUsdt);
    await expect(await usdc.balanceOf(governorAddress)).eq(governorUsdc);
  });

  it("Should allow safeApproveAllTokens to be called", async function () {
    const MAX = BigNumber.from(
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
    );
    const expectAllowanceRaw = async (expected, asset, owner, spender) => {
      const allowance = await asset.allowance(owner.address, spender.address);
      await expect(allowance).to.eq(expected);
    };

    await expectAllowanceRaw(MAX, usdt, threePoolStrategy, threePool);
    await expectAllowanceRaw(MAX, threePoolToken, threePoolStrategy, threePool);
    await expectAllowanceRaw(
      MAX,
      threePoolToken,
      threePoolStrategy,
      threePoolGauge
    );

    await deposit("150", usdt);
    await expectAllowanceRaw(
      MAX.sub((await units("150.0", usdt)).toString()),
      usdt,
      threePoolStrategy,
      threePool
    );

    await threePoolStrategy.safeApproveAllTokens();
    await expectAllowanceRaw(MAX, usdt, threePoolStrategy, threePool);
    await expectAllowanceRaw(MAX, threePoolToken, threePoolStrategy, threePool);
    await expectAllowanceRaw(
      MAX,
      threePoolToken,
      threePoolStrategy,
      threePoolGauge
    );
  });
});
