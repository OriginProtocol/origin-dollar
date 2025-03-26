const { expect } = require("chai");
const { formatUnits } = require("ethers/lib/utils");

const { usdtUnits, ousdUnits } = require("../helpers");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../_fund");
const hre = require("hardhat");
const { advanceTime } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

const { loadDefaultFixture } = require("../_fixture");

const log = require("../../utils/logger")("test:fork:ousd:curve:amo");

describe("Curve AMO OUSD strategy", function () {
  this.timeout(0);

  let fixture,
    ousdVault,
    curveAMOStrategy,
    ousd,
    usdt,
    nick,
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

  let defaultDeposit = ousdUnits("10000");

  beforeEach(async () => {
    fixture = await loadDefaultFixture();

    ousdVault = fixture.vault;
    curveAMOStrategy = fixture.OUSDCurveAMO;
    ousd = fixture.ousd;
    usdt = fixture.usdt;
    nick = fixture.daniel;
    rafael = fixture.franck;
    timelock = fixture.timelock;
    curvePool = fixture.curvePoolOusdUsdt;
    curveGauge = fixture.curveGaugeOusdUsdt;
    crv = fixture.crv;
    harvester = fixture.harvester;
    governor = await ethers.getSigner(addresses.mainnet.Timelock);

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
      .setVaultBuffer(ousdUnits("1"));

    await curveAMOStrategy
      .connect(impersonatedAMOGovernor)
      .setHarvesterAddress(harvester.address);

    // Seed the pool
    await setERC20TokenBalance(nick.address, usdt, "5000000", hre);
    await usdt.connect(nick).approve(ousdVault.address, usdtUnits("0"));
    await usdt.connect(nick).approve(ousdVault.address, usdtUnits("5000000"));
    await ousdVault.connect(nick).mint(usdt.address, usdtUnits("2000000"), 0);
    await ousd.connect(nick).approve(curvePool.address, ousdUnits("2000000"));
    await usdt.connect(nick).approve(curvePool.address, usdtUnits("2000000"));
    // prettier-ignore
    await curvePool
      .connect(nick)["add_liquidity(uint256[],uint256)"]([ousdUnits("10000"), usdtUnits("10000")], 0);
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
      expect(await curveAMOStrategy.maxSlippage()).to.equal(ousdUnits("0.002"));
      expect(await curveAMOStrategy.otokenCoinIndex()).to.equal(0);
      expect(await curveAMOStrategy.hardAssetCoinIndex()).to.equal(1);
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
      ).to.approxEqualTolerance(defaultDeposit.mul(2).div(1e12));
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
      ).to.approxEqualTolerance(defaultDeposit.mul(2).div(1e12));
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

    it("Should protect against attacker front-running a deposit by adding a lot of USDT to the pool", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await ousdVault.rebase();

      const user = defaultDepositor;
      const attackerUsdtBalanceBefore = await usdt.balanceOf(user.address);
      const attackerOusdBalanceBefore = await ousd.balanceOf(user.address);
      const attackerUsdtAmount = usdtUnits("1500000"); // 1.5M USDT
      const depositUsdtAmount = usdtUnits("10000"); // 10k USDT

      const dataBeforeAttack = await snapData();
      logSnapData(
        dataBeforeAttack,
        `\nBefore attacker adds ${formatUnits(
          attackerUsdtAmount,
          6
        )} USDT to the pool`
      );

      // Attacker adds a lot of USDT into the pool
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, attackerUsdtAmount], 0);
      const attackerLpTokens = await curvePool.balanceOf(nick.address);
      log(
        `Attacker has ${formatUnits(
          attackerLpTokens
        )} Curve pool LP tokens after adding USDT`
      );

      const dataBeforeDeposit = await snapData();
      logSnapData(
        dataBeforeDeposit,
        `\nBefore strategist deposits ${formatUnits(depositUsdtAmount, 6)} USDT`
      );
      await logProfit(dataBeforeAttack);

      await usdt
        .connect(impersonatedVaultSigner)
        .transfer(curveAMOStrategy.address, depositUsdtAmount);
      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .deposit(usdt.address, depositUsdtAmount);

      const dataAfterDeposit = await snapData();
      logSnapData(
        dataAfterDeposit,
        `\nAfter deposit and before attacker removes ${formatUnits(
          attackerUsdtAmount,
          6
        )} USDT from the pool`
      );
      await logProfit(dataBeforeAttack);

      // Attacked removes their USDT from the pool
      // prettier-ignore
      await curvePool
        .connect(nick)["remove_liquidity(uint256,uint256[])"](attackerLpTokens, [0, 0]);

      const dataAfterRemoveUsdt = await snapData();
      logSnapData(
        dataAfterRemoveUsdt,
        "\nAfter attacker removes liquidity from the pool"
      );
      const profitAfterAttack = await logProfit(dataBeforeAttack);
      expect(profitAfterAttack).to.be.gt(0);

      const attackerUsdtBalanceAfter = await usdt.balanceOf(user.address);
      const attackerOusdBalanceAfter = await ousd.balanceOf(user.address);
      log(
        `Attacker's profit ${formatUnits(
          attackerUsdtBalanceAfter.sub(attackerUsdtBalanceBefore),
          6
        )} USDT and ${formatUnits(
          attackerOusdBalanceAfter.sub(attackerOusdBalanceBefore)
        )} OUSD`
      );
      const attackerLpTokensAfter = await curvePool.balanceOf(nick.address);
      log(
        `Attacker has ${formatUnits(
          attackerLpTokensAfter
        )} Curve pool LP tokens`
      );

      // Rebase to lock in the profits
      await ousdVault.rebase();

      const dataAfterRebase = await snapData();
      logSnapData(dataAfterRebase, "\nAfter rebase to lock in profits");
      await logProfit(dataBeforeAttack);

      // Remove all funds from the Curve AMO strategy
      const tx = await ousdVault
        .connect(impersonatedAMOGovernor)
        .withdrawAllFromStrategy(curveAMOStrategy.address);
      const dataAfterStratWithdrawAll = await snapData();
      logSnapData(
        dataAfterStratWithdrawAll,
        "\nAfter withdraw all from strategy"
      );
      const finalProfit = await logProfit(dataAfterRebase);
      expect(finalProfit).to.be.gte(0);

      // Get the OUSD burnt from the Vault's Redeem event
      const receipt = await tx.wait();
      const ousdWithdrawEvent = receipt.events.find(
        (e) => e.event === "Redeem" && e.address === ousdVault.address
      );
      log(`OUSD burnt          : ${formatUnits(ousdWithdrawEvent.args[1])}`);
    });

    it("Should protect against an attacker front-running a deposit by adding a lot of OUSD to the pool", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      const user = defaultDepositor;
      const attackerUsdtBalanceBefore = await usdt.balanceOf(user.address);
      const attackerOusdBalanceBefore = await ousd.balanceOf(user.address);
      const attackerOusdAmount = ousdUnits("1500000"); // 150k OUSD
      const depositUsdtAmount = usdtUnits("10000"); // 10k USDT

      const dataBeforeAttack = await snapData();
      logSnapData(
        dataBeforeAttack,
        `\nBefore attacker adds ${formatUnits(
          attackerOusdAmount
        )} OUSD to the pool`
      );

      // Attacker adds a lot of OUSD into the pool
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([attackerOusdAmount, 0], 0);
      const attackerLpTokens = await curvePool.balanceOf(nick.address);

      const dataBeforeDeposit = await snapData();
      logSnapData(
        dataBeforeDeposit,
        `\nBefore strategist deposits ${formatUnits(depositUsdtAmount, 6)} USDT`
      );

      await usdt
        .connect(impersonatedVaultSigner)
        .transfer(curveAMOStrategy.address, depositUsdtAmount);
      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .deposit(usdt.address, depositUsdtAmount);

      const dataAfterDeposit = await snapData();
      logSnapData(
        dataAfterDeposit,
        `\nBefore attacked removes ${formatUnits(
          attackerOusdAmount
        )} OUSD from the pool`
      );
      await logProfit(dataBeforeAttack);

      // Attacked removes their OUSD from the pool
      // prettier-ignore
      await curvePool
        .connect(nick)["remove_liquidity(uint256,uint256[])"](attackerLpTokens, [0, 0]);

      const dataAfterRemoveUsdt = await snapData();
      logSnapData(
        dataAfterRemoveUsdt,
        "\nAfter attacker removes liquidity from the pool"
      );
      const profit = await logProfit(dataBeforeAttack);
      expect(profit).to.be.gt(0);

      const attackerUsdtBalanceAfter = await usdt.balanceOf(user.address);
      const attackerOusdBalanceAfter = await ousd.balanceOf(user.address);
      log(
        `Attacker's profit ${formatUnits(
          attackerUsdtBalanceAfter.sub(attackerUsdtBalanceBefore),
          6
        )} USDT and ${formatUnits(
          attackerOusdBalanceAfter.sub(attackerOusdBalanceBefore)
        )} OUSD`
      );

      // Rebase to lock in the profits
      await ousdVault.rebase();
      const dataAfterRebase = await snapData();
      logSnapData(dataAfterRebase, "\nAfter rebase to lock in profits");
      await logProfit(dataBeforeAttack);

      // Remove all funds from the Curve AMO strategy
      await ousdVault
        .connect(impersonatedAMOGovernor)
        .withdrawAllFromStrategy(curveAMOStrategy.address);
      const dataAfterStratWithdrawAll = await snapData();
      logSnapData(
        dataAfterStratWithdrawAll,
        "\nAfter withdraw all from strategy"
      );
      const finalProfit = await logProfit(dataAfterRebase);
      expect(finalProfit).to.be.gte(0);
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

      const amountToWithdraw = defaultDeposit.mul(999).div(1000); // 1000 OUSD
      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(ousdVault.address, usdt.address, amountToWithdraw.div(1e12));

      expect(
        checkBalanceBefore.sub(
          await curveAMOStrategy.checkBalance(usdt.address)
        )
      ).to.approxEqualTolerance(amountToWithdraw.mul(2).div(1e12));
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(amountToWithdraw.mul(2));
      expect(await ousd.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(
        ousdUnits("0")
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
        ousdUnits("0")
      );
      expect(await usdt.balanceOf(ousdVault.address)).to.approxEqualTolerance(
        balanceVault.add(defaultDeposit.div(1e12))
      );

      // Add a second withdrawAll to test that withrawAll can be
      // called when strategy is empty
      expect(
        await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll()
      ).to.not.be.reverted;
    });

    it("Should mintAndAddOToken", async () => {
      await unbalancePool({
        balancedBefore: true,
        usdtAmount: defaultDeposit.div(1e12),
      });

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        usdt.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .mintAndAddOTokens(defaultDeposit.mul(9999).div(10000));

      expect(
        (await curveAMOStrategy.checkBalance(usdt.address)).sub(
          checkBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit.div(1e12));
      expect(
        (await curveGauge.balanceOf(curveAMOStrategy.address)).sub(
          gaugeBalanceBefore
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(await ousd.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(
        ousdUnits("0")
      );
    });

    it("Should removeAndBurnOToken", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        userOverride: false,
        amount: defaultDeposit.mul(2).div(1e12),
        returnTransaction: false,
      });
      await unbalancePool({
        balancedBefore: false,
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
      ).to.approxEqualTolerance(defaultDeposit.div(1e12));
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(await ousd.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(
        ousdUnits("0")
      );
    });

    it("Should removeOnlyAssets", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        userOverride: false,
        amount: defaultDeposit.mul(2).div(1e12),
        returnTransaction: false,
      });
      await unbalancePool({
        balancedBefore: false,
        usdtAmount: defaultDeposit.mul(2).div(1e12),
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
      ).to.approxEqualTolerance(defaultDeposit.div(1e12));
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(defaultDeposit);
      expect(await usdt.balanceOf(ousdVault.address)).to.approxEqualTolerance(
        vaultETHBalanceBefore.add(defaultDeposit.div(1e12))
      );
    });

    it("Should collectRewardTokens", async () => {
      await mintAndDepositToStrategy();
      await simulateCRVInflation({
        amount: ousdUnits("0"),
        timejump: 60,
        checkpoint: false,
      });

      // First checkpoint to update the gauge
      await curveGauge
        .connect(impersonatedCurveStrategy)
        .user_checkpoint(curveAMOStrategy.address);
      // Then check if the strategy has any crv to collect
      const integrate_fraction = await curveGauge.integrate_fraction(
        curveAMOStrategy.address
      );
      const alreadyMinted = await fixture.crvMinter.minted(
        curveAMOStrategy.address,
        curveGauge.address
      );

      const balanceCRVHarvesterBefore = await crv.balanceOf(harvester.address);
      await curveAMOStrategy
        .connect(impersonatedHarvester)
        .collectRewardTokens();
      const balanceCRVHarvesterAfter = await crv.balanceOf(harvester.address);

      if (integrate_fraction - alreadyMinted > 0)
        expect(balanceCRVHarvesterAfter).to.be.gt(balanceCRVHarvesterBefore);
      expect(await crv.balanceOf(curveGauge.address)).to.equal(0);
      expect(await crv.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit when pool is heavily unbalanced with OUSD", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ ousdAmount: defaultDeposit.mul(10) });

      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        await curveAMOStrategy.checkBalance(usdt.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2).div(1e12));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit when pool is heavily unbalanced with usdt", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ usdtAmount: defaultDeposit.mul(10).div(1e12) });

      await curveAMOStrategy.connect(impersonatedVaultSigner).depositAll();

      expect(
        await curveAMOStrategy.checkBalance(usdt.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2).div(1e12));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2));
      expect(await usdt.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should withdraw all when pool is heavily unbalanced with OUSD", async () => {
      defaultDeposit = ousdUnits("500");
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
        ousdUnits("0")
      );
      expect(await usdt.balanceOf(ousdVault.address)).to.approxEqualTolerance(
        balanceVault.add(checkBalanceAMO)
      );
    });

    it("Should withdraw all when pool is heavily unbalanced with usdt", async () => {
      defaultDeposit = ousdUnits("500");
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ usdtAmount: defaultDeposit.mul(1000).div(1e12) });
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
        ousdUnits("0")
      );
      expect(await usdt.balanceOf(ousdVault.address)).to.approxEqualTolerance(
        balanceVault.add(checkBalanceAMO)
      );
    });

    it("Should set max slippage", async () => {
      await curveAMOStrategy
        .connect(impersonatedAMOGovernor)
        .setMaxSlippage(ousdUnits("0.01456"));

      expect(await curveAMOStrategy.maxSlippage()).to.equal(
        ousdUnits("0.01456")
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
    it("Deposit: Unsupported asset", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .deposit(ousd.address, defaultDeposit)
      ).to.be.revertedWith("Unsupported asset");
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
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](ousdUnits("1000000"));

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
    it("Withdraw: Can only withdraw hard asset", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(ousdVault.address, ousd.address, defaultDeposit)
      ).to.be.revertedWith("Can only withdraw hard asset");
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
          .withdraw(ousdVault.address, usdt.address, ousdUnits("1000000"))
      ).to.be.revertedWith("Insufficient LP tokens");
    });
    it("Withdraw: Protocol is insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        amount: defaultDeposit.mul(2).div(1e12),
      });

      // Make protocol insolvent by minting a lot of OETH and send them
      // Otherwise they will be burned and the protocol will not be insolvent.
      // This is a cheat.
      // prettier-ignore
      await ousdVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](ousdUnits("1000000"));
      await ousd
        .connect(impersonatedCurveStrategy)
        .transfer(ousdVault.address, ousdUnits("1000000"));

      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(ousdVault.address, usdt.address, defaultDeposit.div(1e12))
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Mint OToken: Asset overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ usdtAmount: defaultDeposit.div(1e12) }); // +5 usdt in the pool
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
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](ousdUnits("1000000"));
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .mintAndAddOTokens(defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Burn OToken: Asset balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        amount: defaultDeposit.mul(2).div(1e12),
      });
      await unbalancePool({ usdtAmount: defaultDeposit.mul(2).div(1e12) }); // +10 usdt in the pool
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
          .removeAndBurnOTokens(defaultDeposit.mul(110).div(100))
      ).to.be.revertedWith("OTokens overshot peg");
    });
    it("Burn OToken: Protocol insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      // prettier-ignore
      await ousdVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](ousdUnits("1000000"));
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeAndBurnOTokens(defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Remove only assets: Asset overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        amount: defaultDeposit.mul(2).div(1e12),
      });
      await unbalancePool({ usdtAmount: defaultDeposit.mul(2).div(1e12) }); // +10 usdt in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit.mul(3))
      ).to.be.revertedWith("Assets overshot peg");
    });
    it("Remove only assets: OTokens balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        amount: defaultDeposit.mul(2).div(1e12),
      });
      await unbalancePool({ ousdAmount: defaultDeposit.mul(2) }); // +10 OETH in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit)
      ).to.be.revertedWith("OTokens balance worse");
    });
    it("Remove only assets: Protocol insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        amount: defaultDeposit.mul(2).div(1e12),
      });
      // prettier-ignore
      await ousdVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](ousdUnits("1000000"));
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
          .setMaxSlippage(ousdUnits("0.51"))
      ).to.be.revertedWith("Slippage must be less than 100%");
    });
  });

  describe("Behaviour", () => {
    it("Should behave like a Strategy", async () => {
      balancePool();
      shouldBehaveLikeStrategy(() => ({
        ...fixture,
        // Contracts
        strategy: curveAMOStrategy,
        curveAMOStrategy: curveAMOStrategy,
        vault: ousdVault,
        assets: [usdt],
        timelock: timelock,
        governor: governor,
        strategist: rafael,
        harvester: harvester,
      }));
    });

    shouldBehaveLikeGovernable(() => ({
      ...fixture,
      strategist: rafael,
      governor: governor,
      strategy: curveAMOStrategy,
    }));

    shouldBehaveLikeHarvestable(() => ({
      ...fixture,
      strategy: curveAMOStrategy,
      governor: governor,
      oeth: ousd,
    }));
  });

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

    if (balanceHardAsset.sub(balanceOToken) > 0) {
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
    } else if (balanceHardAsset.sub(balanceOToken) < 0) {
      const amount = balanceOToken.sub(balanceHardAsset).div(1e12);
      const balance = usdt.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, usdt, amount + balance, hre);
      }
      await usdt.connect(nick).approve(curvePool.address, 0);
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
    usdtAmount,
    ousdAmount,
  } = {}) => {
    if (balancedBefore) {
      await balancePool();
    }

    if (usdtAmount) {
      const balance = await usdt.balanceOf(nick.address);
      if (balance < usdtAmount) {
        await setERC20TokenBalance(
          nick.address,
          usdt,
          usdtAmount + balance,
          hre
        );
      }
      await usdt.connect(nick).approve(curvePool.address, 0);
      await usdt.connect(nick).approve(curvePool.address, usdtAmount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, usdtAmount], 0);
    } else {
      const balance = await usdt.balanceOf(nick.address);
      if (balance < ousdAmount.div(1e12)) {
        await setERC20TokenBalance(
          nick.address,
          usdt,
          ousdAmount.div(1e12).add(balance).mul(2),
          hre
        );
      }
      await usdt.connect(nick).approve(ousdVault.address, 0);
      await usdt.connect(nick).approve(ousdVault.address, ousdAmount.mul(2));
      await ousdVault
        .connect(nick)
        .mint(usdt.address, ousdAmount.mul(101).div(100).div(1e12), 0);
      await ousd.connect(nick).approve(curvePool.address, ousdAmount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([ousdAmount, 0], 0);
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
      // Checkpoint to update the gauge
    }
  };

  const snapData = async () => {
    const stratBalance = await curveAMOStrategy.checkBalance(usdt.address);
    const ousdSupply = await ousd.totalSupply();
    const ousdNonRebasingSupply = await ousd.nonRebasingSupply();
    const ousdRebasingSupply = ousdSupply.sub(ousdNonRebasingSupply);
    const vaultAssets = await ousdVault.totalValue();
    const poolSupply = await curvePool.totalSupply();
    const [poolOusdBalance, poolUsdtBalance] = await curvePool.get_balances();
    const reserves = { ousd: poolOusdBalance, usdt: poolUsdtBalance };
    const virtualPrice = await curvePool.get_virtual_price();
    const stratGaugeBalance = await curveGauge.balanceOf(
      curveAMOStrategy.address
    );
    const gaugeSupply = await curveGauge.totalSupply();
    const vaultUsdtBalance = await usdt.balanceOf(ousdVault.address);
    const stratUsdtBalance = await usdt.balanceOf(curveAMOStrategy.address);

    return {
      stratBalance,
      ousdSupply,
      ousdNonRebasingSupply,
      ousdRebasingSupply,
      vaultAssets,
      poolSupply,
      reserves,
      virtualPrice,
      stratGaugeBalance,
      gaugeSupply,
      vaultUsdtBalance,
      stratUsdtBalance,
    };
  };

  const logSnapData = async (data, message) => {
    const scaledUsdtReserves = data.reserves.usdt.mul("1000000000000");
    const totalReserves = data.reserves.ousd.add(scaledUsdtReserves);
    const reserversPercentage = {
      ousd: data.reserves.ousd.mul(10000).div(totalReserves),
      usdt: scaledUsdtReserves.mul(10000).div(totalReserves),
    };
    const gaugePercentage = data.gaugeSupply.eq(0)
      ? 0
      : data.stratGaugeBalance.mul(10000).div(data.gaugeSupply);
    if (message) {
      log(message);
    }
    log(`Strategy balance    : ${formatUnits(data.stratBalance, 6)}`);
    log(`OUSD supply         : ${formatUnits(data.ousdSupply)}`);
    log(`OUSD rebasing supply: ${formatUnits(data.ousdRebasingSupply)}`);
    log(`Vault assets        : ${formatUnits(data.vaultAssets)}`);
    log(
      `Solvency            : ${formatUnits(
        data.vaultAssets.sub(data.ousdSupply)
      )}`
    );
    log(`Pool supply         : ${formatUnits(data.poolSupply)}`);
    log(
      `Reserves OUSD       : ${formatUnits(data.reserves.ousd)} ${formatUnits(
        reserversPercentage.ousd,
        2
      )}%`
    );
    log(
      `Reserves USDT       : ${formatUnits(
        data.reserves.usdt,
        6
      )} ${formatUnits(reserversPercentage.usdt, 2)}%`
    );
    log(`Virtual price       : ${formatUnits(data.virtualPrice)}`);
    log(
      `Strat gauge balance : ${formatUnits(
        data.stratGaugeBalance
      )} ${formatUnits(gaugePercentage, 2)}%`
    );
    log(`Gauge supply        : ${formatUnits(data.gaugeSupply)}`);
    log(`Vault OUSD balance    : ${formatUnits(data.vaultOusdBalance)}`);
    log(`Strat USDT balance    : ${formatUnits(data.stratUsdtBalance, 6)}`);
  };

  const logProfit = async (dataBefore) => {
    const stratBalanceAfter = await curveAMOStrategy.checkBalance(usdt.address);
    const ousdSupplyAfter = await ousd.totalSupply();
    const ousdNonRebasingSupplyAfter = await ousd.nonRebasingSupply();
    const ousdRebasingSupplyAfter = ousdSupplyAfter.sub(
      ousdNonRebasingSupplyAfter
    );
    const vaultAssetsAfter = await ousdVault.totalValue();
    const profit = vaultAssetsAfter
      .sub(dataBefore.vaultAssets)
      .sub(ousdSupplyAfter.sub(dataBefore.ousdSupply));
    const rebasingProfit = vaultAssetsAfter
      .sub(dataBefore.vaultAssets)
      .sub(ousdRebasingSupplyAfter.sub(dataBefore.ousdRebasingSupply));

    log(
      `Change strat balance: ${formatUnits(
        stratBalanceAfter.sub(dataBefore.stratBalance),
        6
      )}`
    );
    log(
      `Change vault assets : ${formatUnits(
        vaultAssetsAfter.sub(dataBefore.vaultAssets)
      )}`
    );
    log(
      `Change OUSD supply  : ${formatUnits(
        ousdSupplyAfter.sub(dataBefore.ousdSupply)
      )}`
    );
    log(
      `Change rebase supply: ${formatUnits(
        ousdRebasingSupplyAfter.sub(dataBefore.ousdRebasingSupply)
      )}`
    );
    log(`Profit              : ${formatUnits(profit)}`);
    log(`Rebasing profit     : ${formatUnits(rebasingProfit)}`);

    return profit;
  };
});
