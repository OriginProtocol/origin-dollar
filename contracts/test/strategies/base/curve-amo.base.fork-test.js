const { expect } = require("chai");
const { formatUnits } = require("ethers/lib/utils");
const hre = require("hardhat");

const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { oethUnits } = require("../../helpers");
const addresses = require("../../../utils/addresses");
const { impersonateAndFund } = require("../../../utils/signers");
const { setERC20TokenBalance } = require("../../_fund");
const { advanceTime } = require("../../helpers");
const { shouldBehaveLikeGovernable } = require("../../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../../behaviour/strategy");

const log = require("../../../utils/logger")("test:fork:sonic:curve-amo");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("Base Fork Test: Curve AMO strategy", function () {
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
    impersonatedCurveStrategy,
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
    impersonatedCurveStrategy = await impersonateAndFund(
      curveAMOStrategy.address
    );

    // Set vaultBuffer to 100%
    await oethbVault
      .connect(impersonatedTimelock)
      .setVaultBuffer(oethUnits("1"));

    await curveAMOStrategy
      .connect(impersonatedAMOGovernor)
      .setHarvesterAddress(harvester.address);

    await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();
  });

  describe("Initial parameters", () => {
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
      expect(await curveAMOStrategy.maxSlippage()).to.equal(oethUnits("0.002"));
    });

    it("Should deposit to strategy", async () => {
      await balancePool();

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );
      await mintAndDepositToStrategy();

      expect(
        (await curveAMOStrategy.checkBalance(weth.address)).sub(
          checkBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await oethb.balanceOf(defaultDepositor.address)).to.equal(
        defaultDeposit
      );
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit all to strategy", async () => {
      await balancePool();

      const amount = defaultDeposit;
      const user = defaultDepositor;
      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      const balance = await weth.balanceOf(user.address);
      if (balance.lt(amount)) {
        await setERC20TokenBalance(
          user.address,
          weth,
          amount.add(balance),
          hre
        );
      }
      await weth.connect(user).transfer(curveAMOStrategy.address, amount);

      expect(await weth.balanceOf(curveAMOStrategy.address)).to.gt(0);
      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        (await curveAMOStrategy.checkBalance(weth.address)).sub(
          checkBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit all to strategy with no balance", async () => {
      await balancePool();
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(0);
      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        (await curveAMOStrategy.checkBalance(weth.address)).sub(
          checkBalanceBefore
        )
      ).to.eq(0);
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
      ).to.eq(0);
    });

    it("Should withdraw from strategy", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      const impersonatedVaultSigner = await impersonateAndFund(
        oethbVault.address
      );

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethbVault.address, weth.address, oethUnits("1"));

      expect(
        checkBalanceBefore.sub(
          await curveAMOStrategy.checkBalance(weth.address)
        )
      ).to.approxEqualTolerance(oethUnits("1").mul(2));
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(oethUnits("1").mul(2));
      expect(await oethb.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Should withdraw all from strategy", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      const balanceVault = await weth.balanceOf(oethbVault.address);

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
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(
        balanceVault.add(defaultDeposit)
      );
    });

    it("Should mintAndAddOToken", async () => {
      await unbalancePool({
        balancedBefore: true,
        wethbAmount: defaultDeposit.mul(2),
      });

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .mintAndAddOTokens(defaultDeposit);

      expect(
        (await curveAMOStrategy.checkBalance(weth.address)).sub(
          checkBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
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

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .removeAndBurnOTokens(defaultDeposit);

      expect(
        checkBalanceBefore.sub(
          await curveAMOStrategy.checkBalance(weth.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
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
      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .removeOnlyAssets(defaultDeposit);

      expect(
        checkBalanceBefore.sub(
          await curveAMOStrategy.checkBalance(weth.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
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

    it("Should deposit when pool is heavily unbalanced with OETH", async () => {
      await unbalancePool({ oethbAmount: defaultDeposit.mul(3) });

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      log(`AMO checkBalance before deposit ${formatUnits(checkBalanceBefore)}`);
      const gaugeTokensBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await mintAndDepositToStrategy();

      const checkBalanceAfter = await curveAMOStrategy.checkBalance(
        weth.address
      );
      log(`AMO checkBalance after deposit ${formatUnits(checkBalanceAfter)}`);
      log(
        `AMO checkBalance diff ${formatUnits(
          checkBalanceAfter.sub(checkBalanceBefore)
        )}`
      );

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2).add(checkBalanceBefore));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2).add(gaugeTokensBefore));
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit when pool is heavily unbalanced with WETH", async () => {
      // No need to make it further unbalanced as WETH is already high
      // await unbalancePool({ wethbAmount: defaultDeposit.mul(2) });

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeTokensBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await mintAndDepositToStrategy();

      const checkBalanceAfter = await curveAMOStrategy.checkBalance(
        weth.address
      );
      log(`AMO checkBalance after deposit ${formatUnits(checkBalanceAfter)}`);
      log(
        `AMO checkBalance diff ${formatUnits(
          checkBalanceAfter.sub(checkBalanceBefore)
        )}`
      );

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(3).add(checkBalanceBefore));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(3).add(gaugeTokensBefore));
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should withdraw all when pool is heavily unbalanced with OETH", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ oethbAmount: defaultDeposit.mul(1000) });

      const checkBalanceAMO = await curveAMOStrategy.checkBalance(weth.address);
      const balanceVault = await weth.balanceOf(oethbVault.address);

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
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(
        balanceVault.add(checkBalanceAMO)
      );
    });

    it("Should withdraw all when pool is heavily unbalanced with WETH", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ wethbAmount: defaultDeposit.mul(1000) });
      const checkBalanceAMO = await curveAMOStrategy.checkBalance(weth.address);
      const balanceVault = await weth.balanceOf(oethbVault.address);

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
      expect(await weth.balanceOf(oethbVault.address)).to.approxEqualTolerance(
        balanceVault.add(checkBalanceAMO)
      );
    });

    it("Should set max slippage", async () => {
      await curveAMOStrategy
        .connect(impersonatedAMOGovernor)
        .setMaxSlippage(oethUnits("0.01456"));

      expect(await curveAMOStrategy.maxSlippage()).to.equal(
        oethUnits("0.01456")
      );
    });
  });

  describe("Should revert when", () => {
    it("Deposit: Must deposit something", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .deposit(weth.address, 0)
      ).to.be.revertedWith("Must deposit something");
    });
    it("Deposit: Can only deposit WETH", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .deposit(oethb.address, defaultDeposit)
      ).to.be.revertedWith("Can only deposit WETH");
    });
    it("Deposit: Caller is not the Vault", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .deposit(weth.address, defaultDeposit)
      ).to.be.revertedWith("Caller is not the Vault");
    });
    it("Deposit: Protocol is insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      // Make protocol insolvent by minting a lot of OETH
      // This is a cheat.
      // prettier-ignore
      await oethbVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));

      await expect(
        mintAndDepositToStrategy({ returnTransaction: true })
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Withdraw: Must withdraw something", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(oethbVault.address, weth.address, 0)
      ).to.be.revertedWith("Must withdraw something");
    });
    it("Withdraw: Can only withdraw WETH", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(oethbVault.address, oethb.address, defaultDeposit)
      ).to.be.revertedWith("Can only withdraw WETH");
    });
    it("Withdraw: Caller is not the vault", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .withdraw(oethbVault.address, weth.address, defaultDeposit)
      ).to.be.revertedWith("Caller is not the Vault");
    });
    it("Withdraw: Amount is greater than balance", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(oethbVault.address, weth.address, oethUnits("1000000"))
      ).to.be.revertedWith("");
    });
    it("Withdraw: Protocol is insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy({ amount: defaultDeposit.mul(2) });

      // Make protocol insolvent by minting a lot of OETH and send them
      // Otherwise they will be burned and the protocol will not be insolvent.
      // This is a cheat.
      // prettier-ignore
      await oethbVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));
      await oethb
        .connect(impersonatedCurveStrategy)
        .transfer(oethbVault.address, oethUnits("1000000"));

      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(oethbVault.address, weth.address, defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Mint OToken: Asset overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ wethbAmount: defaultDeposit }); // +5 WETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .mintAndAddOTokens(defaultDeposit.mul(2))
      ).to.be.revertedWith("Assets overshot peg");
    });
    it("Mint OToken: OTokens balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ oethbAmount: defaultDeposit.mul(2) }); // +10 OETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .mintAndAddOTokens(defaultDeposit)
      ).to.be.revertedWith("OTokens balance worse");
    });
    it("Mint OToken: Protocol insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      // prettier-ignore
      await oethbVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .mintAndAddOTokens(defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Burn OToken: Asset balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy({ amount: defaultDeposit.mul(2) });
      await unbalancePool({ wethbAmount: defaultDeposit.mul(2) }); // +10 WETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeAndBurnOTokens(defaultDeposit)
      ).to.be.revertedWith("Assets balance worse");
    });
    it("Burn OToken: OTokens overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ oethbAmount: defaultDeposit }); // +5 OETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeAndBurnOTokens(defaultDeposit)
      ).to.be.revertedWith("OTokens overshot peg");
    });
    it("Burn OToken: Protocol insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      // prettier-ignore
      await oethbVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeAndBurnOTokens(defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Remove only assets: Asset overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy({ amount: defaultDeposit.mul(2) });
      await unbalancePool({ wethbAmount: defaultDeposit.mul(2) }); // +10 WETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit.mul(3))
      ).to.be.revertedWith("Assets overshot peg");
    });
    it("Remove only assets: OTokens balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy({ amount: defaultDeposit.mul(2) });
      await unbalancePool({ oethbAmount: defaultDeposit.mul(2) }); // +10 OETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit)
      ).to.be.revertedWith("OTokens balance worse");
    });
    it("Remove only assets: Protocol insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy({ amount: defaultDeposit.mul(2) });
      // prettier-ignore
      await oethbVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Check balance: Unsupported asset", async () => {
      await expect(
        curveAMOStrategy.checkBalance(oethb.address)
      ).to.be.revertedWith("Unsupported asset");
    });
    it("Max slippage is too high", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedAMOGovernor)
          .setMaxSlippage(oethUnits("0.51"))
      ).to.be.revertedWith("Slippage must be less than 100%");
    });
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    anna: rafael,
    josh: nick,
    matt: clement,
    usds: crv,
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
    checkWithdrawAmounts: false,
    vault: oethbVault,
    assets: [weth],
    timelock: timelock,
    governor: governor,
    strategist: rafael,
    harvester: harvester,
    // As we don't have this on base fixture, we use CRV
    usdt: crv,
    usdc: crv,
    usds: crv,
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

    const balance = await weth.balanceOf(user.address);
    if (balance.lt(amount)) {
      await setERC20TokenBalance(user.address, weth, amount.add(balance), hre);
    }
    await weth.connect(user).approve(oethbVault.address, amount);
    await oethbVault.connect(user).mint(weth.address, amount, amount);

    const gov = await oethbVault.governor();
    log(`Depositing ${formatUnits(amount)} WETH to AMO strategy`);
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

    if (balanceWETH.gt(balanceOETH)) {
      const amount = balanceWETH.sub(balanceOETH);
      const balance = await weth.balanceOf(nick.address);
      if (balance.lt(amount)) {
        await setERC20TokenBalance(
          nick.address,
          weth,
          amount.add(balance),
          hre
        );
      }
      await weth
        .connect(nick)
        .approve(oethbVault.address, amount.mul(101).div(10));
      await oethbVault
        .connect(nick)
        .mint(weth.address, amount.mul(101).div(10), amount);
      await oethb.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, amount], 0);
    } else if (balanceWETH.lt(balanceOETH)) {
      const amount = balanceOETH.sub(balanceWETH);
      const balance = await weth.balanceOf(nick.address);
      if (balance.lt(amount)) {
        await setERC20TokenBalance(
          nick.address,
          weth,
          amount.add(balance),
          hre
        );
      }
      await weth.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([amount, 0], 0);
    }

    balances = await curvePool.get_balances();
    log(`Balanced Curve pool`);
    log(`WETH balance: ${formatUnits(balances[0])}`);
    log(`OETH balance: ${formatUnits(balances[1])}`);
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
      const balance = await weth.balanceOf(nick.address);
      if (balance.lt(wethbAmount)) {
        await setERC20TokenBalance(
          nick.address,
          weth,
          wethbAmount.add(balance),
          hre
        );
      }
      await weth.connect(nick).approve(curvePool.address, wethbAmount);
      log(
        `Adding ${formatUnits(
          wethbAmount
        )} WETH to Curve pool to make it unbalanced`
      );
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([wethbAmount, 0], 0);
    } else {
      const balance = await weth.balanceOf(nick.address);
      if (balance.lt(oethbAmount)) {
        await setERC20TokenBalance(
          nick.address,
          weth,
          oethbAmount.add(balance),
          hre
        );
      }
      await weth.connect(nick).approve(oethbVault.address, oethbAmount);
      await oethbVault
        .connect(nick)
        .mint(weth.address, oethbAmount, oethbAmount);
      await oethb.connect(nick).approve(curvePool.address, oethbAmount);
      log(
        `Adding ${formatUnits(
          oethbAmount
        )} OETH to Curve pool to make it unbalanced`
      );
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, oethbAmount], 0);
    }

    const balances = await curvePool.get_balances();
    log(`Curve pool balances:`);
    log(`WETH: ${formatUnits(balances[0])}`);
    log(`OETH: ${formatUnits(balances[1])}`);
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
