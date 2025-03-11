const { expect } = require("chai");
const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../_fund");
const hre = require("hardhat");
const { advanceTime } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

const { loadDefaultFixture } = require("../_fixture");

describe("Curve AMO OUSD strategy", function () {
  let fixture,
    ousdVault,
    curveAMOStrategy,
    ousd,
    usdt,
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
    impersonatedAMOGovernor,
    impersonatedCurveStrategy,
    impersonatedTimelock,
    crv,
    harvester;

  let defaultDepositor;

  const defaultDeposit = oethUnits("5000");

  beforeEach(async () => {
    fixture = await loadDefaultFixture();

    ousdVault = fixture.vault;
    curveAMOStrategy = fixture.OUSDCurveAMO;
    ousd = fixture.ousd;
    usdt = fixture.usdt;
    nick = fixture.daniel;
    rafael = fixture.franck;
    clement = fixture.clement;
    governor = fixture.governor;
    timelock = fixture.timelock;
    curvePool = fixture.curvePoolOusdUsdt;
    curveGauge = fixture.curveGaugeOusdUsdt;
    crv = fixture.crv;
    harvester = fixture.harvester;

    defaultDepositor = rafael;

    impersonatedVaultSigner = await impersonateAndFund(ousdVault.address);
    impersonatedStrategist = await impersonateAndFund(
      await ousdVault.strategistAddr()
    );
    impersonatedHarvester = await impersonateAndFund(harvester.address);
    impersonatedAMOGovernor = await impersonateAndFund(
      await curveAMOStrategy.governor()
    );
    impersonatedTimelock = await impersonateAndFund(timelock.address);
    impersonatedCurveStrategy = await impersonateAndFund(
      curveAMOStrategy.address
    );

    // Set vaultBuffer to 100%
    await ousdVault
      .connect(impersonatedTimelock)
      .setVaultBuffer(oethUnits("1"));

    await curveAMOStrategy
      .connect(impersonatedAMOGovernor)
      .setHarvesterAddress(harvester.address);

    /*
    await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();
    */
  });

  describe("Initial paramaters", () => {
    it("Should have correct parameters after deployment", async () => {
      //const { curveAMOStrategy, ousdVault, ousd, usdt } = fixture;
      expect(await curveAMOStrategy.platformAddress()).to.equal(
        ethers.utils.getAddress(addresses.mainnet.CurveOUSDUSDTPool)
      );
      expect(await curveAMOStrategy.vaultAddress()).to.equal(ousdVault.address);
      expect(await curveAMOStrategy.gauge()).to.equal(
        ethers.utils.getAddress(addresses.mainnet.CurveOUSDUSDTGauge)
      );
      expect(await curveAMOStrategy.curvePool()).to.equal(
        ethers.utils.getAddress(addresses.mainnet.CurveOUSDUSDTPool)
      );
      expect(await curveAMOStrategy.lpToken()).to.equal(
        ethers.utils.getAddress(addresses.mainnet.CurveOUSDUSDTPool)
      );

      expect(await curveAMOStrategy.oToken()).to.equal(ousd.address);
      expect(await curveAMOStrategy.hardAsset()).to.equal(usdt.address);
      expect(await curveAMOStrategy.governor()).to.equal(
        addresses.mainnet.Timelock
      );
      expect(await curveAMOStrategy.rewardTokenAddresses(0)).to.equal(
        ethers.utils.getAddress(addresses.mainnet.CRV)
      );
      expect(await curveAMOStrategy.maxSlippage()).to.equal(oethUnits("0.002"));
    });

    it("Should deposit to strategy", async () => {
      await balancePool();

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        usdt.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      expect(await ousd.balanceOf(defaultDepositor.address)).to.equal(0);
      await mintAndDepositToStrategy();

      expect(
        (await curveAMOStrategy.checkBalance(usdt.address)).sub(
          checkBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        await ousd.balanceOf(defaultDepositor.address)
      ).to.approxEqualTolerance(defaultDeposit);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit all to strategy", async () => {
      await balancePool();

      const amount = defaultDeposit.div(1e12);
      const user = defaultDepositor;
      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        usdt.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      const balance = await usdt.balanceOf(user.address);
      if (balance < amount) {
        await setERC20TokenBalance(user.address, usdt, amount + balance, hre);
      }
      await usdt.connect(user).transfer(curveAMOStrategy.address, amount);

      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.gt(0);
      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        (await curveAMOStrategy.checkBalance(usdt.address)).sub(
          checkBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit all to strategy with no balance", async () => {
      await balancePool();
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(0);
      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        usdt.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        (await curveAMOStrategy.checkBalance(usdt.address)).sub(
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
        ousdVault.address
      );

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        usdt.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      const amountToWithdraw = defaultDeposit.div(5); // 1000 OUSD
      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(ousdVault.address, usdt.address, amountToWithdraw.div(1e12));

      console.log("balanceBefore", checkBalanceBefore.toString());
      console.log(
        "balanceAfter",
        (await curveAMOStrategy.checkBalance(usdt.address)).toString()
      );
      expect(
        checkBalanceBefore.sub(
          await curveAMOStrategy.checkBalance(usdt.address)
        )
      ).to.approxEqualTolerance(amountToWithdraw.mul(2));
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(amountToWithdraw.mul(2));
      expect(await ousd.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Should withdraw all from strategy", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      const balanceVault = await usdt.balanceOf(ousdVault.address);

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(usdt.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await ousd.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
      expect(await usdt.balanceOf(ousdVault.address)).to.approxEqualTolerance(
        balanceVault.add(defaultDeposit)
      );
    });

    it("Should mintAndAddOToken", async () => {
      await unbalancePool({
        balancedBefore: true,
        usdtbAmount: defaultDeposit,
      });

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        usdt.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .mintAndAddOTokens(defaultDeposit);

      expect(
        (await curveAMOStrategy.checkBalance(usdt.address)).sub(
          checkBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(await ousd.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(
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
        ousdAmount: defaultDeposit.mul(2),
      });

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        usdt.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .removeAndBurnOTokens(defaultDeposit);

      expect(
        checkBalanceBefore.sub(
          await curveAMOStrategy.checkBalance(usdt.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(await ousd.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(
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
        usdtbAmount: defaultDeposit.mul(2),
      });

      const vaultETHBalanceBefore = await usdt.balanceOf(ousdVault.address);
      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        usdt.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .removeOnlyAssets(defaultDeposit);

      expect(
        checkBalanceBefore.sub(
          await curveAMOStrategy.checkBalance(usdt.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(await usdt.balanceOf(ousdVault.address)).to.approxEqualTolerance(
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
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ ousdAmount: defaultDeposit.mul(1000) });

      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        await curveAMOStrategy.checkBalance(usdt.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit when pool is heavily unbalanced with usdt", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ usdtbAmount: defaultDeposit.mul(1000) });

      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        await curveAMOStrategy.checkBalance(usdt.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should withdraw all when pool is heavily unbalanced with OETH", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ ousdAmount: defaultDeposit.mul(1000) });

      const checkBalanceAMO = await curveAMOStrategy.checkBalance(usdt.address);
      const balanceVault = await usdt.balanceOf(ousdVault.address);

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(usdt.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await ousd.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
      expect(await usdt.balanceOf(ousdVault.address)).to.approxEqualTolerance(
        balanceVault.add(checkBalanceAMO)
      );
    });

    it("Should withdraw all when pool is heavily unbalanced with usdt", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ usdtbAmount: defaultDeposit.mul(1000) });
      const checkBalanceAMO = await curveAMOStrategy.checkBalance(usdt.address);
      const balanceVault = await usdt.balanceOf(ousdVault.address);

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(usdt.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await ousd.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(
        oethUnits("0")
      );
      expect(await usdt.balanceOf(ousdVault.address)).to.approxEqualTolerance(
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
          .deposit(usdt.address, 0)
      ).to.be.revertedWith("Must deposit something");
    });
    it("Deposit: Can only deposit usdt", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .deposit(ousd.address, defaultDeposit)
      ).to.be.revertedWith("Can only deposit usdt");
    });
    it("Deposit: Caller is not the Vault", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .deposit(usdt.address, defaultDeposit)
      ).to.be.revertedWith("Caller is not the Vault");
    });
    it("Deposit: Protocol is insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      // Make protocol insolvent by minting a lot of OETH
      // This is a cheat.
      // prettier-ignore
      await ousdVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));

      await expect(
        mintAndDepositToStrategy({ returnTransaction: true })
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Withdraw: Must withdraw something", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(ousdVault.address, usdt.address, 0)
      ).to.be.revertedWith("Must withdraw something");
    });
    it("Withdraw: Can only withdraw usdt", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(ousdVault.address, ousd.address, defaultDeposit)
      ).to.be.revertedWith("Can only withdraw usdt");
    });
    it("Withdraw: Caller is not the vault", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .withdraw(ousdVault.address, usdt.address, defaultDeposit)
      ).to.be.revertedWith("Caller is not the Vault");
    });
    it("Withdraw: Amount is greater than balance", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(ousdVault.address, usdt.address, oethUnits("1000000"))
      ).to.be.revertedWith("");
    });
    it("Withdraw: Protocol is insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy({ amount: defaultDeposit.mul(2) });

      // Make protocol insolvent by minting a lot of OETH and send them
      // Otherwise they will be burned and the protocol will not be insolvent.
      // This is a cheat.
      // prettier-ignore
      await ousdVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));
      await ousd
        .connect(impersonatedCurveStrategy)
        .transfer(ousdVault.address, oethUnits("1000000"));

      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(ousdVault.address, usdt.address, defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Mint OToken: Asset overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ usdtbAmount: defaultDeposit }); // +5 usdt in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .mintAndAddOTokens(defaultDeposit.mul(2))
      ).to.be.revertedWith("Assets overshot peg");
    });
    it("Mint OToken: OTokens balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ ousdAmount: defaultDeposit.mul(2) }); // +10 OETH in the pool
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
      await ousdVault
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
      await unbalancePool({ usdtbAmount: defaultDeposit.mul(2) }); // +10 usdt in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeAndBurnOTokens(defaultDeposit)
      ).to.be.revertedWith("Assets balance worse");
    });
    it("Burn OToken: OTokens overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ ousdAmount: defaultDeposit }); // +5 OETH in the pool
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
      await ousdVault
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
      await unbalancePool({ usdtbAmount: defaultDeposit.mul(2) }); // +10 usdt in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit.mul(3))
      ).to.be.revertedWith("Assets overshot peg");
    });
    it("Remove only assets: OTokens balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy({ amount: defaultDeposit.mul(2) });
      await unbalancePool({ ousdAmount: defaultDeposit.mul(2) }); // +10 OETH in the pool
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
      await ousdVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](oethUnits("1000000"));
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Check balance: Unsupported asset", async () => {
      await expect(
        curveAMOStrategy.checkBalance(ousd.address)
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
  }));

  shouldBehaveLikeHarvestable(() => ({
    ...fixture,
    anna: rafael,
    strategy: curveAMOStrategy,
    harvester: harvester,
    oeth: ousd,
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    // Contracts
    strategy: curveAMOStrategy,
    vault: ousdVault,
    assets: [usdt],
    timelock: timelock,
    governor: governor,
    strategist: rafael,
    harvester: harvester,
    // As we don't have this on base fixture, we use CRV
    usdt: crv,
    usdc: crv,
    dai: crv,
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
    amount = amount || defaultDeposit.div(1e12);

    const balance = await usdt.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, usdt, amount + balance, hre);
    }

    console.log("Amount to mint", amount.toString());
    await usdt.connect(user).approve(ousdVault.address, 0);
    await usdt.connect(user).approve(ousdVault.address, amount);
    await ousdVault.connect(user).mint(usdt.address, amount, amount);

    const gov = await ousdVault.governor();
    const tx = await ousdVault
      .connect(await impersonateAndFund(gov))
      .depositToStrategy(curveAMOStrategy.address, [usdt.address], [amount]);

    if (returnTransaction) {
      return tx;
    }

    await expect(tx).to.emit(curveAMOStrategy, "Deposit");
  };

  const balancePool = async () => {
    let balances = await curvePool.get_balances();
    const balanceOToken = balances[0];
    const balanceHardAsset = balances[1].mul(1e12); // Adjust decimals

    if (balanceHardAsset > balanceOToken) {
      const amount = balanceHardAsset.sub(balanceOToken).div(1e12);
      const balance = usdt.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, usdt, amount + balance, hre);
      }
      await usdt
        .connect(nick)
        .approve(ousdVault.address, amount.mul(101).div(10));
      await ousdVault
        .connect(nick)
        .mint(usdt.address, amount.mul(101).div(10), amount);
      await ousd.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([amount, 0], 0);
    } else if (balanceHardAsset < balanceOToken) {
      const amount = balanceOToken.sub(balanceHardAsset).div(1e12);
      console.log("USDT address", usdt.address);
      console.log("Nick Address", nick.address);
      const balance = usdt.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, usdt, amount + balance, hre);
      }
      await usdt.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, amount], 0);
    }

    balances = await curvePool.get_balances();
    expect(balances[0]).to.approxEqualTolerance(balances[1].mul(1e12));
  };

  const unbalancePool = async ({
    balancedBefore,
    usdtbAmount,
    ousdAmount,
  } = {}) => {
    if (balancedBefore) {
      await balancePool();
    }

    if (usdtbAmount) {
      const balance = usdt.balanceOf(nick.address);
      if (balance < usdtbAmount) {
        await setERC20TokenBalance(
          nick.address,
          usdt,
          usdtbAmount + balance,
          hre
        );
      }
      await usdt.connect(nick).approve(curvePool.address, usdtbAmount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([usdtbAmount, 0], 0);
    } else {
      const balance = usdt.balanceOf(nick.address);
      if (balance < ousdAmount) {
        await setERC20TokenBalance(
          nick.address,
          usdt,
          ousdAmount + balance,
          hre
        );
      }
      await usdt.connect(nick).approve(ousdVault.address, ousdAmount);
      await ousdVault.connect(nick).mint(usdt.address, ousdAmount, ousdAmount);
      await ousd.connect(nick).approve(curvePool.address, ousdAmount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, ousdAmount], 0);
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
      //  curveGauge
      //    .connect(impersonatedCurveGaugeFactory)
      //    .user_checkpoint(curveAMOStrategy.address);
    }
  };
});
