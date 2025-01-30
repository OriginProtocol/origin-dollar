const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const addresses = require("../../../utils/addresses");
const { impersonateAndFund } = require("../../../utils/signers");
const { setERC20TokenBalance } = require("../../_fund");
const hre = require("hardhat");
const { advanceTime } = require("../../helpers");
const { shouldBehaveLikeGovernable } = require("../../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../../behaviour/strategy");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("Curve AMO strategy", function () {
  let fixture,
    oethbVault,
    curveAMOStrategy,
    oethb,
    weth,
    nick,
    clement,
    rafael,
    governor,
    timelock;

  let curvePool,
    curveGauge,
    impersonatedVaultSigner,
    impersonatedStrategist,
    impersonatedHarvester,
    impersonatedCurveGaugeFactory,
    impersonatedAMOGovernor,
    curveChildLiquidityGaugeFactory,
    impersonatedTimelock,
    crv,
    harvester;

  let defaultDepositor;

  const defaultDeposit = oethUnits("5");

  beforeEach(async () => {
    fixture = await baseFixture();
    oethbVault = fixture.oethbVault;
    curveAMOStrategy = fixture.curveAMOStrategy;
    oethb = fixture.oethb;
    weth = fixture.weth;
    nick = fixture.nick;
    rafael = fixture.rafael;
    clement = fixture.clement;
    governor = fixture.governor;
    timelock = fixture.timelock;
    curvePool = fixture.curvePoolOEthbWeth;
    curveGauge = fixture.curveGaugeOETHbWETH;
    curveChildLiquidityGaugeFactory = fixture.curveChildLiquidityGaugeFactory;
    crv = fixture.crv;
    harvester = fixture.harvester;

    defaultDepositor = rafael;

    impersonatedVaultSigner = await impersonateAndFund(oethbVault.address);
    impersonatedStrategist = await impersonateAndFund(
      await oethbVault.strategistAddr()
    );
    impersonatedHarvester = await impersonateAndFund(harvester.address);
    impersonatedCurveGaugeFactory = await impersonateAndFund(
      curveChildLiquidityGaugeFactory.address
    );
    impersonatedAMOGovernor = await impersonateAndFund(
      await curveAMOStrategy.governor()
    );
    impersonatedTimelock = await impersonateAndFund(timelock.address);

    // Set vaultBuffer to 100%
    await oethbVault
      .connect(impersonatedTimelock)
      .setVaultBuffer(oethUnits("1"));

    await curveAMOStrategy
      .connect(impersonatedAMOGovernor)
      .setHarvesterAddress(harvester.address);
  });

  describe("Initial paramaters", () => {
    it("Should have correct parameters after deployment", async () => {
      const { curveAMOStrategy, oethbVault, oethb, weth } = fixture;
      expect(await curveAMOStrategy.platformAddress()).to.equal(
        addresses.base.OETHb_WETH.pool
      );
      expect(await curveAMOStrategy.vaultAddress()).to.equal(
        oethbVault.address
      );
      expect(await curveAMOStrategy.gauge()).to.equal(
        addresses.base.OETHb_WETH.gauge
      );
      expect(await curveAMOStrategy.curvePool()).to.equal(
        addresses.base.OETHb_WETH.pool
      );
      expect(await curveAMOStrategy.lpToken()).to.equal(
        addresses.base.OETHb_WETH.pool
      );
      expect(await curveAMOStrategy.oeth()).to.equal(oethb.address);
      expect(await curveAMOStrategy.weth()).to.equal(weth.address);
      expect(await curveAMOStrategy.governor()).to.equal(
        addresses.base.timelock
      );
      expect(await curveAMOStrategy.rewardTokenAddresses(0)).to.equal(
        addresses.base.CRV
      );
    });

    it("Should deposit to strategy", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await oethb.balanceOf(defaultDepositor.address)).to.equal(
        defaultDeposit
      );
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should withdraw from strategy", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      const impersonatedVaultSigner = await impersonateAndFund(
        oethbVault.address
      );

      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethbVault.address, weth.address, oethUnits("1"));

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(defaultDeposit.sub(oethUnits("1")).mul(2));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.sub(oethUnits("1")).mul(2));
      expect(await oethb.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Should withdraw all from strategy", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await oethb.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Should mintAndAddOToken", async () => {
      await unbalancePool({
        balancedBefore: true,
        wethbAmount: defaultDeposit,
      });

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .mintAndAddOTokens(defaultDeposit);

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(defaultDeposit);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit);
      expect(await oethb.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Should removeAndBurnOToken", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        userOverride: false,
        amount: defaultDeposit.mul(2),
        returnTransaction: false,
      });
      await unbalancePool({
        balancedBefore: true,
        oethbAmount: defaultDeposit.mul(2),
      });

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .removeAndBurnOTokens(defaultDeposit);

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(4).sub(defaultDeposit));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(4).sub(defaultDeposit));
      expect(await oethb.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Should removeOnlyAssets", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        userOverride: false,
        amount: defaultDeposit.mul(2),
        returnTransaction: false,
      });
      await unbalancePool({
        balancedBefore: true,
        wethbAmount: defaultDeposit.mul(2),
      });

      const vaultETHBalanceBefore = await weth.balanceOf(oethbVault.address);

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .removeOnlyAssets(defaultDeposit);

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(4).sub(defaultDeposit));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(4).sub(defaultDeposit));
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(
        vaultETHBalanceBefore.add(defaultDeposit)
      );
    });

    it("Should collectRewardTokens", async () => {
      await mintAndDepositToStrategy();
      await simulateCRVInflation({
        amount: oethUnits("1000000"),
        timejump: 60,
        checkpoint: true,
      });

      const balanceCRVHarvesterBefore = await crv.balanceOf(harvester.address);
      await curveAMOStrategy
        .connect(impersonatedHarvester)
        .collectRewardTokens();
      const balanceCRVHarvesterAfter = await crv.balanceOf(harvester.address);

      expect(balanceCRVHarvesterAfter).to.be.gt(balanceCRVHarvesterBefore);
      expect(await crv.balanceOf(curveGauge.address)).to.equal(0);
    });
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    anna: rafael,
    josh: nick,
    matt: clement,
    dai: crv,
    strategy: curveAMOStrategy,
  }));

  shouldBehaveLikeHarvestable(() => ({
    ...fixture,
    anna: rafael,
    strategy: curveAMOStrategy,
    harvester: harvester,
    oeth: oethb,
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    // Contracts
    strategy: curveAMOStrategy,
    vault: oethbVault,
    assets: [weth],
    timelock: timelock,
    governor: governor,
    strategist: rafael,
    harvester: harvester,
    // As we don't have this on base fixture, we use CRV
    usdt: crv,
    usdc: crv,
    dai: crv,
    weth: weth,
    reth: crv,
    stETH: crv,
    frxETH: crv,
    cvx: crv,
    comp: crv,
    bal: crv,
    // Users
    anna: rafael,
    matt: clement,
    josh: nick,
  }));

  const mintAndDepositToStrategy = async ({
    userOverride,
    amount,
    returnTransaction,
  } = {}) => {
    const user = userOverride || defaultDepositor;
    amount = amount || defaultDeposit;

    const balance = weth.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, weth, amount + balance, hre);
    }
    await weth.connect(user).approve(oethbVault.address, amount);
    await oethbVault.connect(user).mint(weth.address, amount, amount);

    const gov = await oethbVault.governor();
    const tx = await oethbVault
      .connect(await impersonateAndFund(gov))
      .depositToStrategy(curveAMOStrategy.address, [weth.address], [amount]);

    if (returnTransaction) {
      return tx;
    }

    await expect(tx).to.emit(curveAMOStrategy, "Deposit");
  };

  const balancePool = async () => {
    let balances = await curvePool.get_balances();
    const balanceWETH = balances[0];
    const balanceOETH = balances[1];

    if (balanceWETH > balanceOETH) {
      const amount = balanceWETH.sub(balanceOETH);
      const balance = weth.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, weth, amount + balance, hre);
      }
      await weth.connect(nick).approve(oethbVault.address, amount);
      await oethbVault.connect(nick).mint(weth.address, amount, amount);
      await oethb.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, amount], 0);
    } else if (balanceWETH < balanceOETH) {
      const amount = balanceOETH.sub(balanceWETH);
      const balance = weth.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, weth, amount + balance, hre);
      }
      await weth.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([amount, 0], 0);
    }

    balances = await curvePool.get_balances();
    expect(balances[0]).to.approxEqualTolerance(balances[1]);
  };

  const unbalancePool = async ({
    balancedBefore,
    wethbAmount,
    oethbAmount,
  } = {}) => {
    if (balancedBefore) {
      await balancePool();
    }

    if (wethbAmount) {
      const balance = weth.balanceOf(nick.address);
      if (balance < wethbAmount) {
        await setERC20TokenBalance(
          nick.address,
          weth,
          wethbAmount + balance,
          hre
        );
      }
      await weth.connect(nick).approve(curvePool.address, wethbAmount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([wethbAmount, 0], 0);
    } else {
      const balance = weth.balanceOf(nick.address);
      if (balance < oethbAmount) {
        await setERC20TokenBalance(
          nick.address,
          weth,
          oethbAmount + balance,
          hre
        );
      }
      await weth.connect(nick).approve(oethbVault.address, oethbAmount);
      await oethbVault
        .connect(nick)
        .mint(weth.address, oethbAmount, oethbAmount);
      await oethb.connect(nick).approve(curvePool.address, oethbAmount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, oethbAmount], 0);
    }
  };

  const simulateCRVInflation = async ({
    amount,
    timejump,
    checkpoint,
  } = {}) => {
    await setERC20TokenBalance(curveGauge.address, crv, amount, hre);
    await advanceTime(timejump);
    if (checkpoint) {
      curveGauge
        .connect(impersonatedCurveGaugeFactory)
        .user_checkpoint(curveAMOStrategy.address);
    }
  };
});
