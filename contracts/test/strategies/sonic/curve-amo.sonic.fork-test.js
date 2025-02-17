const { createFixtureLoader } = require("../../_fixture");
const { defaultSonicFixture } = require("../../_fixture-sonic");
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

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("Sonic Fork Test: Curve AMO strategy", function () {
  let fixture, vault, curveAMOStrategy, os, ws, nick, clement, rafael, timelock;

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
    fixture = await sonicFixture();
    vault = fixture.oSonicVault;
    curveAMOStrategy = fixture.curveAMOStrategy;
    os = fixture.oSonic;
    ws = fixture.wS;
    nick = fixture.nick;
    rafael = fixture.rafael;
    clement = fixture.clement;
    timelock = fixture.timelock;
    curvePool = fixture.curvePool;
    curveGauge = fixture.curveGauge;
    curveChildLiquidityGaugeFactory = fixture.curveChildLiquidityGaugeFactory;
    crv = fixture.crv;
    harvester = fixture.harvester;

    defaultDepositor = rafael;

    impersonatedVaultSigner = await impersonateAndFund(vault.address);
    impersonatedStrategist = await impersonateAndFund(
      await vault.strategistAddr()
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
    await vault.connect(impersonatedTimelock).setVaultBuffer(oethUnits("1"));
  });

  it("Should have correct parameters after deployment", async () => {
    const { curveAMOStrategy } = fixture;
    expect(await curveAMOStrategy.platformAddress()).to.equal(
      addresses.sonic.WS_OS.pool
    );
    expect(await curveAMOStrategy.vaultAddress()).to.equal(vault.address);
    expect(await curveAMOStrategy.gauge()).to.equal(
      addresses.sonic.WS_OS.gauge
    );
    expect(await curveAMOStrategy.curvePool()).to.equal(
      addresses.sonic.WS_OS.pool
    );
    expect(await curveAMOStrategy.lpToken()).to.equal(
      addresses.sonic.WS_OS.pool
    );
    expect(await curveAMOStrategy.oeth()).to.equal(os.address);
    expect(await curveAMOStrategy.weth()).to.equal(ws.address);
    expect(await curveAMOStrategy.governor()).to.equal(
      addresses.sonic.timelock
    );
    expect(await curveAMOStrategy.rewardTokenAddresses(0)).to.equal(
      addresses.sonic.CRV
    );
    expect(await curveAMOStrategy.maxSlippage()).to.equal(oethUnits("0.002"));
  });

  describe("Operational functions", () => {
    it("Should deposit to strategy", async () => {
      await balancePool();

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        ws.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );
      await mintAndDepositToStrategy();

      expect(
        (await curveAMOStrategy.checkBalance(ws.address)).sub(
          checkBalanceBefore
        )
      ).to.approxEqual(defaultDeposit.mul(2));
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await os.balanceOf(defaultDepositor.address)).to.equal(
        defaultDeposit
      );
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit all to strategy", async () => {
      await balancePool();

      const amount = defaultDeposit;
      const user = defaultDepositor;
      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        ws.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      const balance = await ws.balanceOf(user.address);
      if (balance < amount) {
        await setERC20TokenBalance(user.address, ws, amount + balance, hre);
      }
      await ws.connect(user).transfer(curveAMOStrategy.address, amount);

      expect(await ws.balanceOf(curveAMOStrategy.address)).to.gt(0);
      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        (await curveAMOStrategy.checkBalance(ws.address)).sub(
          checkBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit all to strategy with no balance", async () => {
      await balancePool();
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(0);

      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(await curveAMOStrategy.checkBalance(ws.address)).to.eq(0);
      expect(await curveGauge.balanceOf(curveAMOStrategy.address)).to.eq(0);
    });

    it("Should withdraw from strategy", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      const impersonatedVaultSigner = await impersonateAndFund(vault.address);

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        ws.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(vault.address, ws.address, oethUnits("1"));

      expect(
        checkBalanceBefore.sub(await curveAMOStrategy.checkBalance(ws.address))
      ).to.approxEqualTolerance(oethUnits("1").mul(2));
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(oethUnits("1").mul(2));
      expect(await os.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Should withdraw all from strategy", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      const balanceVault = await ws.balanceOf(vault.address);

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(ws.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await os.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
      expect(await ws.balanceOf(vault.address)).to.approxEqualTolerance(
        balanceVault.add(defaultDeposit)
      );
    });

    it("Should mintAndAddOToken", async () => {
      await unbalancePool({
        balancedBefore: true,
        wsAmount: defaultDeposit,
      });

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .mintAndAddOTokens(defaultDeposit);

      expect(
        await curveAMOStrategy.checkBalance(ws.address)
      ).to.approxEqualTolerance(defaultDeposit);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit);
      expect(await os.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(
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
        osAmount: defaultDeposit.mul(2),
      });

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .removeAndBurnOTokens(defaultDeposit);

      expect(
        await curveAMOStrategy.checkBalance(ws.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(4).sub(defaultDeposit));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(4).sub(defaultDeposit));
      expect(await os.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(
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
        wsAmount: defaultDeposit.mul(2),
      });

      const vaultETHBalanceBefore = await ws.balanceOf(vault.address);

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .removeOnlyAssets(defaultDeposit);

      expect(
        await curveAMOStrategy.checkBalance(ws.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(4).sub(defaultDeposit));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(4).sub(defaultDeposit));
      expect(await ws.balanceOf(vault.address)).to.approxEqualTolerance(
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

  describe("when pool is heavily unbalanced", () => {
    it("Should deposit with OS", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ osAmount: defaultDeposit.mul(1000) });

      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        await curveAMOStrategy.checkBalance(ws.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit with wS", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ wsAmount: defaultDeposit.mul(1000) });

      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        await curveAMOStrategy.checkBalance(ws.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should withdraw all with OS", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ osAmount: defaultDeposit.mul(1000) });

      const checkBalanceAMO = await curveAMOStrategy.checkBalance(ws.address);
      const balanceVault = await ws.balanceOf(vault.address);

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(ws.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await os.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
      expect(await ws.balanceOf(vault.address)).to.approxEqualTolerance(
        balanceVault.add(checkBalanceAMO)
      );
    });

    it("Should withdraw all with wS", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ wsAmount: defaultDeposit.mul(1000) });
      const checkBalanceAMO = await curveAMOStrategy.checkBalance(ws.address);
      const balanceVault = await ws.balanceOf(vault.address);

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(ws.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await os.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await ws.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
      expect(await ws.balanceOf(vault.address)).to.approxEqualTolerance(
        balanceVault.add(checkBalanceAMO)
      );
    });
  });

  describe("admin functions", () => {
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
        curveAMOStrategy.connect(impersonatedVaultSigner).deposit(ws.address, 0)
      ).to.be.revertedWith("Must deposit something");
    });
    it("Deposit: Can only deposit wS", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .deposit(os.address, defaultDeposit)
      ).to.be.revertedWith("Can only deposit WETH");
    });
    it("Deposit: Caller is not the Vault", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .deposit(ws.address, defaultDeposit)
      ).to.be.revertedWith("Caller is not the Vault");
    });
    it("Deposit: Protocol is insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      // Make protocol insolvent by minting a lot of OETH
      // This is a cheat.
      // prettier-ignore
      await vault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));

      await expect(
        mintAndDepositToStrategy({ returnTransaction: true })
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Withdraw: Must withdraw something", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(vault.address, ws.address, 0)
      ).to.be.revertedWith("Must withdraw something");
    });
    it("Withdraw: Can only withdraw WETH", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(vault.address, os.address, defaultDeposit)
      ).to.be.revertedWith("Can only withdraw WETH");
    });
    it("Withdraw: Caller is not the vault", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .withdraw(vault.address, ws.address, defaultDeposit)
      ).to.be.revertedWith("Caller is not the Vault");
    });
    it("Withdraw: Amount is greater than balance", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(vault.address, ws.address, oethUnits("1000000"))
      ).to.be.revertedWith("");
    });
    it("Withdraw: Protocol is insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy({ amount: defaultDeposit.mul(2) });

      // Make protocol insolvent by minting a lot of OETH and send them
      // Otherwise they will be burned and the protocol will not be insolvent.
      // This is a cheat.
      // prettier-ignore
      await vault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));
      await os
        .connect(impersonatedCurveStrategy)
        .transfer(vault.address, oethUnits("1000000"));

      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(vault.address, ws.address, defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Mint OToken: Asset overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ wsAmount: defaultDeposit }); // +5 WETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .mintAndAddOTokens(defaultDeposit.mul(2))
      ).to.be.revertedWith("Assets overshot peg");
    });
    it("Mint OToken: OTokens balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ osAmount: defaultDeposit.mul(2) }); // +10 OETH in the pool
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
      await vault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .mintAndAddOTokens(defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Burn OToken: Asset balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ wsAmount: defaultDeposit.mul(2) }); // +10 WETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeAndBurnOTokens(defaultDeposit)
      ).to.be.revertedWith("Assets balance worse");
    });
    it("Burn OToken: OTokens overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ osAmount: defaultDeposit }); // +5 OETH in the pool
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
      await vault
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
      await unbalancePool({ wsAmount: defaultDeposit.mul(2) }); // +10 WETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit.mul(3))
      ).to.be.revertedWith("Assets overshot peg");
    });
    it("Remove only assets: OTokens balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy({ amount: defaultDeposit.mul(2) });
      await unbalancePool({ osAmount: defaultDeposit.mul(2) }); // +10 OETH in the pool
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
      await vault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Check balance: Unsupported asset", async () => {
      await expect(
        curveAMOStrategy.checkBalance(os.address)
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
    dai: crv,
    strategy: curveAMOStrategy,
    governor: timelock,
  }));

  shouldBehaveLikeHarvestable(() => ({
    ...fixture,
    anna: rafael,
    strategy: curveAMOStrategy,
    harvester,
    oeth: os,
    governor: timelock,
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    // Contracts
    strategy: curveAMOStrategy,
    checkWithdrawAmounts: false,
    vault: vault,
    assets: [ws],
    governor: timelock,
    strategist: rafael,
    harvester,
    crv,
    // As we don't have this on base fixture, we use CRV
    usdt: crv,
    usdc: crv,
    dai: crv,
    weth: ws,
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

    const balance = await ws.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, ws, amount + balance, hre);
    }
    await ws.connect(user).approve(vault.address, amount);
    await vault.connect(user).mint(ws.address, amount, amount);

    const gov = await vault.governor();
    const tx = await vault
      .connect(await impersonateAndFund(gov))
      .depositToStrategy(curveAMOStrategy.address, [ws.address], [amount]);

    if (returnTransaction) {
      return tx;
    }

    await expect(tx).to.emit(curveAMOStrategy, "Deposit");
  };

  const balancePool = async () => {
    let balances = await curvePool.get_balances();
    const balanceOS = balances[0];
    const balanceWS = balances[1];

    if (balanceWS > balanceOS) {
      const amount = balanceWS.sub(balanceOS);
      const balance = ws.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, ws, amount + balance, hre);
      }
      await ws.connect(nick).approve(vault.address, amount.mul(101).div(10));
      await vault
        .connect(nick)
        .mint(ws.address, amount.mul(101).div(10), amount);
      await os.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([amount, 0], 0);
    } else if (balanceWS < balanceOS) {
      const amount = balanceOS.sub(balanceWS);
      const balance = ws.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, ws, amount + balance, hre);
      }
      await ws.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, amount], 0);
    }

    balances = await curvePool.get_balances();
    expect(balances[0]).to.approxEqualTolerance(balances[1]);
  };

  const unbalancePool = async ({ balancedBefore, wsAmount, osAmount } = {}) => {
    if (balancedBefore) {
      await balancePool();
    }

    if (wsAmount) {
      const balance = ws.balanceOf(nick.address);
      if (balance < wsAmount) {
        await setERC20TokenBalance(nick.address, ws, wsAmount + balance, hre);
      }
      await ws.connect(nick).approve(curvePool.address, wsAmount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, wsAmount], 0);
    } else {
      const balance = ws.balanceOf(nick.address);
      if (balance < osAmount) {
        await setERC20TokenBalance(nick.address, ws, osAmount + balance, hre);
      }
      await ws.connect(nick).approve(vault.address, osAmount);
      await vault.connect(nick).mint(ws.address, osAmount, osAmount);
      await os.connect(nick).approve(curvePool.address, osAmount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([osAmount, 0], 0);
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
