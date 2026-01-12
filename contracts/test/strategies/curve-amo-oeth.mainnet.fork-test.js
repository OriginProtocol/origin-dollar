const { expect } = require("chai");
const { formatUnits } = require("ethers/lib/utils");

const { ousdUnits } = require("../helpers");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../_fund");
const hre = require("hardhat");
const { advanceTime } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

const { loadDefaultFixture } = require("../_fixture");

const log = require("../../utils/logger")("test:fork:oeth:curve:amo");

describe("Curve AMO OETH strategy", function () {
  this.timeout(0);

  let fixture,
    oethVault,
    curveAMOStrategy,
    oeth,
    weth,
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

  let defaultDeposit = ousdUnits("100");

  beforeEach(async () => {
    fixture = await loadDefaultFixture();

    oethVault = fixture.oethVault;
    curveAMOStrategy = fixture.OETHCurveAMO;
    oeth = fixture.oeth;
    weth = fixture.weth;
    nick = fixture.daniel;
    rafael = fixture.franck;
    timelock = fixture.timelock;
    curvePool = fixture.curvePoolOETHWETH;
    curveGauge = fixture.curveGaugeOETHWETH;
    crv = fixture.crv;
    harvester = fixture.strategist;
    governor = await ethers.getSigner(addresses.mainnet.Timelock);

    defaultDepositor = rafael;

    impersonatedVaultSigner = await impersonateAndFund(oethVault.address);
    impersonatedStrategist = await impersonateAndFund(
      await oethVault.strategistAddr()
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
    await oethVault
      .connect(impersonatedTimelock)
      .setVaultBuffer(ousdUnits("1"));

    // Seed the pool
    await setERC20TokenBalance(nick.address, weth, ousdUnits("5000000"), hre);
    await weth.connect(nick).approve(oethVault.address, ousdUnits("0"));
    await weth.connect(nick).approve(oethVault.address, ousdUnits("5000000"));
    await oethVault.connect(nick).mint(weth.address, ousdUnits("2000000"), 0);
    await oeth
      .connect(nick)
      .approve(curvePool.address, ousdUnits("1000000000"));
    await weth
      .connect(nick)
      .approve(curvePool.address, ousdUnits("1000000000"));
    // prettier-ignore
    await curvePool
      .connect(nick)["add_liquidity(uint256[],uint256)"]([ousdUnits("1000"), ousdUnits("1000")], 0);
  });

  describe("Initial parameters", () => {
    it("Should have correct parameters after deployment", async () => {
      //const { curveAMOStrategy, oethVault, oeth, weth } = fixture;
      expect(await curveAMOStrategy.platformAddress()).to.equal(
        ethers.utils.getAddress(addresses.mainnet.curve.OETH_WETH.pool)
      );
      expect(await curveAMOStrategy.vaultAddress()).to.equal(oethVault.address);
      expect(await curveAMOStrategy.gauge()).to.equal(
        ethers.utils.getAddress(addresses.mainnet.curve.OETH_WETH.gauge)
      );
      expect(await curveAMOStrategy.curvePool()).to.equal(
        ethers.utils.getAddress(addresses.mainnet.curve.OETH_WETH.pool)
      );
      expect(await curveAMOStrategy.lpToken()).to.equal(
        ethers.utils.getAddress(addresses.mainnet.curve.OETH_WETH.pool)
      );

      expect(await curveAMOStrategy.oToken()).to.equal(oeth.address);
      expect(await curveAMOStrategy.hardAsset()).to.equal(weth.address);
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
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      expect(await oeth.balanceOf(defaultDepositor.address)).to.equal(0);
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
      expect(
        await oeth.balanceOf(defaultDepositor.address)
      ).to.approxEqualTolerance(defaultDeposit);
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
      if (balance < amount) {
        await setERC20TokenBalance(user.address, weth, amount + balance, hre);
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

    it("Should protect against attacker front-running a deposit by adding a lot of weth to the pool", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await oethVault.rebase();

      const user = defaultDepositor;
      const attackerwethBalanceBefore = await weth.balanceOf(user.address);
      const attackerOethBalanceBefore = await oeth.balanceOf(user.address);
      const attackerwethAmount = ousdUnits("1500000"); // 1.5M weth
      const depositwethAmount = ousdUnits("10000"); // 10k weth

      const dataBeforeAttack = await snapData();
      logSnapData(
        dataBeforeAttack,
        `\nBefore attacker adds ${formatUnits(
          attackerwethAmount,
          6
        )} weth to the pool`
      );

      await weth.connect(nick).approve(curvePool.address, attackerwethAmount);
      // Attacker adds a lot of weth into the pool
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, attackerwethAmount], 0);
      const attackerLpTokens = await curvePool.balanceOf(nick.address);
      log(
        `Attacker has ${formatUnits(
          attackerLpTokens
        )} Curve pool LP tokens after adding weth`
      );

      const dataBeforeDeposit = await snapData();
      logSnapData(
        dataBeforeDeposit,
        `\nBefore strategist deposits ${formatUnits(depositwethAmount, 6)} weth`
      );
      await logProfit(dataBeforeAttack);

      await weth
        .connect(impersonatedVaultSigner)
        .transfer(curveAMOStrategy.address, depositwethAmount);
      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .deposit(weth.address, depositwethAmount);

      const dataAfterDeposit = await snapData();
      logSnapData(
        dataAfterDeposit,
        `\nAfter deposit and before attacker removes ${formatUnits(
          attackerwethAmount,
          6
        )} weth from the pool`
      );
      await logProfit(dataBeforeAttack);

      // Attacked removes their weth from the pool
      // prettier-ignore
      await curvePool
        .connect(nick)["remove_liquidity(uint256,uint256[])"](attackerLpTokens, [0, 0]);

      const dataAfterRemoveweth = await snapData();
      logSnapData(
        dataAfterRemoveweth,
        "\nAfter attacker removes liquidity from the pool"
      );
      const profitAfterAttack = await logProfit(dataBeforeAttack);
      expect(profitAfterAttack).to.be.gt(0);

      const attackerwethBalanceAfter = await weth.balanceOf(user.address);
      const attackerOethBalanceAfter = await oeth.balanceOf(user.address);
      log(
        `Attacker's profit ${formatUnits(
          attackerwethBalanceAfter.sub(attackerwethBalanceBefore),
          6
        )} weth and ${formatUnits(
          attackerOethBalanceAfter.sub(attackerOethBalanceBefore)
        )} OUSD`
      );
      const attackerLpTokensAfter = await curvePool.balanceOf(nick.address);
      log(
        `Attacker has ${formatUnits(
          attackerLpTokensAfter
        )} Curve pool LP tokens`
      );

      // Rebase to lock in the profits
      await oethVault.rebase();

      const dataAfterRebase = await snapData();
      logSnapData(dataAfterRebase, "\nAfter rebase to lock in profits");
      await logProfit(dataBeforeAttack);

      // Remove all funds from the Curve AMO strategy
      const tx = await oethVault
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
        (e) => e.event === "Redeem" && e.address === oethVault.address
      );
      log(`OUSD burnt          : ${formatUnits(ousdWithdrawEvent.args[1])}`);
    });

    it("Should protect against an attacker front-running a deposit by adding a lot of OETH to the pool", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      const user = defaultDepositor;
      const attackerwethBalanceBefore = await weth.balanceOf(user.address);
      const attackerOethBalanceBefore = await oeth.balanceOf(user.address);
      const attackerOethAmount = ousdUnits("1500000"); // 150k OUSD
      const depositwethAmount = ousdUnits("10000"); // 10k weth

      const dataBeforeAttack = await snapData();
      logSnapData(
        dataBeforeAttack,
        `\nBefore attacker adds ${formatUnits(
          attackerOethAmount
        )} OUSD to the pool`
      );

      await oeth.connect(nick).approve(curvePool.address, attackerOethAmount);
      await weth.connect(nick).approve(curvePool.address, attackerOethAmount);
      // Attacker adds a lot of OUSD into the pool
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([attackerOethAmount, 0], 0);
      const attackerLpTokens = await curvePool.balanceOf(nick.address);

      const dataBeforeDeposit = await snapData();
      logSnapData(
        dataBeforeDeposit,
        `\nBefore strategist deposits ${formatUnits(depositwethAmount, 6)} weth`
      );

      await weth
        .connect(impersonatedVaultSigner)
        .transfer(curveAMOStrategy.address, depositwethAmount);
      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .deposit(weth.address, depositwethAmount);

      const dataAfterDeposit = await snapData();
      logSnapData(
        dataAfterDeposit,
        `\nBefore attacked removes ${formatUnits(
          attackerOethAmount
        )} OUSD from the pool`
      );
      await logProfit(dataBeforeAttack);

      // Attacked removes their OUSD from the pool
      // prettier-ignore
      await curvePool
        .connect(nick)["remove_liquidity(uint256,uint256[])"](attackerLpTokens, [0, 0]);

      const dataAfterRemoveweth = await snapData();
      logSnapData(
        dataAfterRemoveweth,
        "\nAfter attacker removes liquidity from the pool"
      );
      const profit = await logProfit(dataBeforeAttack);
      expect(profit).to.be.gt(0);

      const attackerwethBalanceAfter = await weth.balanceOf(user.address);
      const attackerOethBalanceAfter = await oeth.balanceOf(user.address);
      log(
        `Attacker's profit ${formatUnits(
          attackerwethBalanceAfter.sub(attackerwethBalanceBefore),
          6
        )} weth and ${formatUnits(
          attackerOethBalanceAfter.sub(attackerOethBalanceBefore)
        )} OUSD`
      );

      // Rebase to lock in the profits
      await oethVault.rebase();
      const dataAfterRebase = await snapData();
      logSnapData(dataAfterRebase, "\nAfter rebase to lock in profits");
      await logProfit(dataBeforeAttack);

      // Remove all funds from the Curve AMO strategy
      await oethVault
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
        oethVault.address
      );

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      const amountToWithdraw = defaultDeposit.mul(999).div(1000); // 1000 OUSD
      await curveAMOStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethVault.address, weth.address, amountToWithdraw);

      expect(
        checkBalanceBefore.sub(
          await curveAMOStrategy.checkBalance(weth.address)
        )
      ).to.approxEqualTolerance(amountToWithdraw.mul(2));
      expect(
        gaugeBalanceBefore.sub(
          await curveGauge.balanceOf(curveAMOStrategy.address)
        )
      ).to.approxEqualTolerance(amountToWithdraw.mul(2));
      expect(await oeth.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        ousdUnits("0")
      );
    });

    it("Should withdraw all from strategy", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      const balanceVault = await weth.balanceOf(oethVault.address);
      const gaugeBalance = await curveGauge.balanceOf(curveAMOStrategy.address);

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await oeth.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        ousdUnits("0")
      );
      expect(await weth.balanceOf(oethVault.address)).to.approxEqualTolerance(
        balanceVault.add(gaugeBalance.div(2e12))
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
        wethAmount: defaultDeposit,
      });

      const checkBalanceBefore = await curveAMOStrategy.checkBalance(
        weth.address
      );
      const gaugeBalanceBefore = await curveGauge.balanceOf(
        curveAMOStrategy.address
      );

      await curveAMOStrategy
        .connect(impersonatedStrategist)
        .mintAndAddOTokens(defaultDeposit.mul(9999).div(10000));

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
      expect(await oeth.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        ousdUnits("0")
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
        balancedBefore: false,
        ousdAmount: defaultDeposit.mul(2),
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
      expect(await oeth.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        ousdUnits("0")
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
        balancedBefore: false,
        wethAmount: defaultDeposit.mul(2),
      });

      const vaultETHBalanceBefore = await weth.balanceOf(oethVault.address);
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
      expect(await weth.balanceOf(oethVault.address)).to.approxEqualTolerance(
        vaultETHBalanceBefore.add(defaultDeposit)
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
      const gaugeBalance = await curveGauge.balanceOf(curveAMOStrategy.address);

      await mintAndDepositToStrategy();

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2).add(gaugeBalance));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(2).add(gaugeBalance));
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should deposit when pool is heavily unbalanced with weth", async () => {
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ wethAmount: defaultDeposit.mul(100) });
      const gaugeBalance = await curveGauge.balanceOf(curveAMOStrategy.address);
      await mintAndDepositToStrategy();

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(3).add(gaugeBalance));
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(defaultDeposit.mul(3).add(gaugeBalance));
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(0);
    });

    it("Should withdraw all when pool is heavily unbalanced with OUSD", async () => {
      defaultDeposit = ousdUnits("500");
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ ousdAmount: defaultDeposit.mul(100) });

      const balanceVault = await weth.balanceOf(oethVault.address);
      const gaugeBalance = await curveGauge.balanceOf(curveAMOStrategy.address);

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await oeth.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        ousdUnits("0")
      );
      expect(await weth.balanceOf(oethVault.address)).to.approxEqualTolerance(
        balanceVault.add(gaugeBalance.div(2e12))
      );
    });

    it("Should withdraw all when pool is heavily unbalanced with weth", async () => {
      defaultDeposit = ousdUnits("500");
      await balancePool();
      await mintAndDepositToStrategy();

      await unbalancePool({ wethAmount: defaultDeposit.mul(2) });
      const balanceVault = await weth.balanceOf(oethVault.address);
      const gaugeBalance = await curveGauge.balanceOf(curveAMOStrategy.address);

      await curveAMOStrategy.connect(impersonatedVaultSigner).withdrawAll();

      expect(
        await curveAMOStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(0);
      expect(
        await curveGauge.balanceOf(curveAMOStrategy.address)
      ).to.approxEqualTolerance(0);
      expect(await oeth.balanceOf(curveAMOStrategy.address)).to.equal(0);
      expect(await weth.balanceOf(curveAMOStrategy.address)).to.equal(
        ousdUnits("0")
      );
      expect(await weth.balanceOf(oethVault.address)).to.approxEqualTolerance(
        balanceVault.add(gaugeBalance.div(2))
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
          .deposit(weth.address, 0)
      ).to.be.revertedWith("Must deposit something");
    });
    it("Deposit: Unsupported asset", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .deposit(oeth.address, defaultDeposit)
      ).to.be.revertedWith("Unsupported asset");
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
      await oethVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](ousdUnits("1000000"));

      await expect(
        mintAndDepositToStrategy({ returnTransaction: true })
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Withdraw: Must withdraw something", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(oethVault.address, weth.address, 0)
      ).to.be.revertedWith("Must withdraw something");
    });
    it("Withdraw: Can only withdraw hard asset", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(oethVault.address, oeth.address, defaultDeposit)
      ).to.be.revertedWith("Can only withdraw hard asset");
    });
    it("Withdraw: Caller is not the vault", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .withdraw(oethVault.address, weth.address, defaultDeposit)
      ).to.be.revertedWith("Caller is not the Vault");
    });
    it("Withdraw: Amount is greater than balance", async () => {
      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(oethVault.address, weth.address, ousdUnits("1000000"))
      ).to.be.revertedWith("Insufficient LP tokens");
    });
    it("Withdraw: Protocol is insolvent", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        amount: defaultDeposit.mul(2),
      });

      // Make protocol insolvent by minting a lot of OETH and send them
      // Otherwise they will be burned and the protocol will not be insolvent.
      // This is a cheat.
      // prettier-ignore
      await oethVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](ousdUnits("1000000"));
      await oeth
        .connect(impersonatedCurveStrategy)
        .transfer(oethVault.address, ousdUnits("1000000"));

      await expect(
        curveAMOStrategy
          .connect(impersonatedVaultSigner)
          .withdraw(oethVault.address, weth.address, defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Mint OToken: Asset overshot peg", async () => {
      await balancePool();
      await mintAndDepositToStrategy();
      await unbalancePool({ wethAmount: defaultDeposit }); // +5 weth in the pool
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
      await oethVault
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
        amount: defaultDeposit.mul(2),
      });
      await unbalancePool({ wethAmount: defaultDeposit.mul(2) }); // +10 weth in the pool
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
      await oethVault
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
        amount: defaultDeposit.mul(2),
      });
      await unbalancePool({ wethAmount: defaultDeposit.mul(2) }); // +10 weth in the pool
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit.mul(3))
      ).to.be.revertedWith("Assets overshot peg");
    });
    it("Remove only assets: OTokens balance worse", async () => {
      await balancePool();
      await mintAndDepositToStrategy({
        amount: defaultDeposit.mul(2),
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
        amount: defaultDeposit.mul(2),
      });
      // prettier-ignore
      await oethVault
        .connect(impersonatedCurveStrategy)["mintForStrategy(uint256)"](ousdUnits("1000000"));
      await expect(
        curveAMOStrategy
          .connect(impersonatedStrategist)
          .removeOnlyAssets(defaultDeposit)
      ).to.be.revertedWith("Protocol insolvent");
    });
    it("Check balance: Unsupported asset", async () => {
      await expect(
        curveAMOStrategy.checkBalance(oeth.address)
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

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    // Contracts
    strategy: curveAMOStrategy,
    curveAMOStrategy: curveAMOStrategy,
    vault: oethVault,
    assets: [weth],
    timelock: timelock,
    governor: governor,
    strategist: rafael,
    harvester: harvester,

    beforeEach: async () => {
      await balancePool();
    },
  }));

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
    oeth: oeth,
    harvester: harvester,
    strategist: rafael,
  }));

  const mintAndDepositToStrategy = async ({
    userOverride,
    amount,
    returnTransaction,
  } = {}) => {
    const user = userOverride || defaultDepositor;
    amount = amount || defaultDeposit;

    const balance = await weth.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, weth, amount + balance, hre);
    }

    await weth.connect(user).approve(oethVault.address, 0);
    await weth.connect(user).approve(oethVault.address, amount);
    await oethVault.connect(user).mint(weth.address, amount, amount);

    const gov = await oethVault.governor();
    const tx = await oethVault
      .connect(await impersonateAndFund(gov))
      .depositToStrategy(curveAMOStrategy.address, [weth.address], [amount]);

    if (returnTransaction) {
      return tx;
    }

    await expect(tx).to.emit(curveAMOStrategy, "Deposit");
  };

  const balancePool = async () => {
    let balances = await curvePool.get_balances();

    const balanceOToken = balances[0];
    const balanceHardAsset = balances[1]; // Adjust decimals

    if (balanceHardAsset.sub(balanceOToken) > 0) {
      const amount = balanceHardAsset.sub(balanceOToken);
      const balance = weth.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, weth, amount + balance, hre);
      }
      await weth
        .connect(nick)
        .approve(oethVault.address, amount.mul(101).div(10));
      await oethVault
        .connect(nick)
        .mint(weth.address, amount.mul(101).div(10), amount);
      await oeth.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([amount, 0], 0);
    } else if (balanceHardAsset.sub(balanceOToken) < 0) {
      const amount = balanceOToken.sub(balanceHardAsset);
      const balance = weth.balanceOf(nick.address);
      if (balance < amount) {
        await setERC20TokenBalance(nick.address, weth, amount + balance, hre);
      }
      await weth.connect(nick).approve(curvePool.address, 0);
      await weth.connect(nick).approve(curvePool.address, amount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, amount], 0);
    }

    balances = await curvePool.get_balances();
    expect(balances[0]).to.approxEqualTolerance(balances[1]);
  };

  const unbalancePool = async ({
    balancedBefore,
    wethAmount,
    ousdAmount,
  } = {}) => {
    if (balancedBefore) {
      await balancePool();
    }

    if (wethAmount) {
      const balance = await weth.balanceOf(nick.address);
      if (balance < wethAmount) {
        await setERC20TokenBalance(
          nick.address,
          weth,
          wethAmount + balance,
          hre
        );
      }
      await weth.connect(nick).approve(curvePool.address, 0);
      await weth.connect(nick).approve(curvePool.address, wethAmount);
      // prettier-ignore
      await curvePool
        .connect(nick)["add_liquidity(uint256[],uint256)"]([0, wethAmount], 0);
    } else {
      const balance = await weth.balanceOf(nick.address);
      if (balance < ousdAmount) {
        await setERC20TokenBalance(
          nick.address,
          weth,
          ousdAmount.add(balance).mul(2),
          hre
        );
      }
      await weth.connect(nick).approve(oethVault.address, 0);
      await weth.connect(nick).approve(oethVault.address, ousdAmount.mul(2));
      await oethVault
        .connect(nick)
        .mint(weth.address, ousdAmount.mul(101).div(100), 0);
      await oeth.connect(nick).approve(curvePool.address, ousdAmount);
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
    const stratBalance = await curveAMOStrategy.checkBalance(weth.address);
    const ousdSupply = await oeth.totalSupply();
    const ousdNonRebasingSupply = await oeth.nonRebasingSupply();
    const ousdRebasingSupply = ousdSupply.sub(ousdNonRebasingSupply);
    const vaultAssets = await oethVault.totalValue();
    const poolSupply = await curvePool.totalSupply();
    const [poolOethBalance, poolwethBalance] = await curvePool.get_balances();
    const reserves = { oeth: poolOethBalance, weth: poolwethBalance };
    const virtualPrice = await curvePool.get_virtual_price();
    const stratGaugeBalance = await curveGauge.balanceOf(
      curveAMOStrategy.address
    );
    const gaugeSupply = await curveGauge.totalSupply();
    const vaultwethBalance = await weth.balanceOf(oethVault.address);
    const stratwethBalance = await weth.balanceOf(curveAMOStrategy.address);

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
      vaultwethBalance,
      stratwethBalance,
    };
  };

  const logSnapData = async (data, message) => {
    const scaledwethReserves = data.reserves.weth.mul("1000000000000");
    const totalReserves = data.reserves.oeth.add(scaledwethReserves);
    const reserversPercentage = {
      oeth: data.reserves.oeth.mul(10000).div(totalReserves),
      weth: scaledwethReserves.mul(10000).div(totalReserves),
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
      `Reserves OUSD       : ${formatUnits(data.reserves.oeth)} ${formatUnits(
        reserversPercentage.oeth,
        2
      )}%`
    );
    log(
      `Reserves weth       : ${formatUnits(
        data.reserves.weth,
        6
      )} ${formatUnits(reserversPercentage.weth, 2)}%`
    );
    log(`Virtual price       : ${formatUnits(data.virtualPrice)}`);
    log(
      `Strat gauge balance : ${formatUnits(
        data.stratGaugeBalance
      )} ${formatUnits(gaugePercentage, 2)}%`
    );
    log(`Gauge supply        : ${formatUnits(data.gaugeSupply)}`);
    log(`Vault OUSD balance    : ${formatUnits(data.vaultOethBalance)}`);
    log(`Strat weth balance    : ${formatUnits(data.stratwethBalance, 6)}`);
  };

  const logProfit = async (dataBefore) => {
    const stratBalanceAfter = await curveAMOStrategy.checkBalance(weth.address);
    const ousdSupplyAfter = await oeth.totalSupply();
    const ousdNonRebasingSupplyAfter = await oeth.nonRebasingSupply();
    const ousdRebasingSupplyAfter = ousdSupplyAfter.sub(
      ousdNonRebasingSupplyAfter
    );
    const vaultAssetsAfter = await oethVault.totalValue();
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
