const hre = require("hardhat");
const { createFixtureLoader } = require("../../_fixture");

const addresses = require("../../../utils/addresses");
const { plumeFixtureWithMockedVaultAdmin } = require("../../_fixture-plume");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const ethers = hre.ethers;
const { impersonateAndFund } = require("../../../utils/signers");
const { BigNumber } = ethers;

const plumeFixtureWithMockedVault = createFixtureLoader(
  plumeFixtureWithMockedVaultAdmin
);

const { setERC20TokenBalance } = require("../../_fund");

describe("ForkTest: Rooster AMO Strategy (Plume)", async function () {
  let fixture,
    oethpVault,
    oethVaultSigner,
    oethp,
    weth,
    roosterAmoStrategy,
    roosterOETHpWETHpool,
    governor,
    strategist,
    rafael;

  beforeEach(async () => {
    fixture = await plumeFixtureWithMockedVault();
    weth = fixture.weth;
    oethp = fixture.oethp;
    oethpVault = fixture.oethpVault;
    roosterAmoStrategy = fixture.roosterAmoStrategy;
    roosterOETHpWETHpool = fixture.roosterOETHpWETHpool;
    governor = fixture.governor;
    strategist = fixture.strategist;
    rafael = fixture.rafael;
    oethVaultSigner = await impersonateAndFund(oethpVault.address);

    await setup();
  });

  const configureAutomaticDepositOnMint = async (vaultBuffer) => {
    await oethpVault.connect(governor).setVaultBuffer(vaultBuffer);

    const totalValue = await oethpVault.totalValue();

    // min mint to trigger deposits
    return totalValue.mul(vaultBuffer).div(oethUnits("1"));
  };

  describe("ForkTest: Initial state (Plume)", function () {
    it("Should have the correct initial state", async function () {
      // correct pool weth share interval
      expect(await roosterAmoStrategy.allowedWethShareStart()).to.equal(
        oethUnits("0.10")
      );

      expect(await roosterAmoStrategy.allowedWethShareEnd()).to.equal(
        oethUnits("0.25")
      );

      expect(await roosterAmoStrategy.tickDominance()).to.gt(0);
      expect(await roosterAmoStrategy.tickDominance()).to.lte(oethUnits("1"));

      await verifyEndConditions();
    });

    it("Should revert setting ptoken address", async function () {
      await expect(
        roosterAmoStrategy
          .connect(governor)
          .setPTokenAddress(weth.address, weth.address)
      ).to.be.revertedWith("Unsupported method");
    });

    it("Should revert setting ptoken address", async function () {
      await expect(
        roosterAmoStrategy.connect(governor).removePToken(weth.address)
      ).to.be.revertedWith("Unsupported method");
    });

    it("Should revert calling safe approve all tokens", async function () {
      await expect(
        roosterAmoStrategy.connect(governor).safeApproveAllTokens()
      ).to.be.revertedWith("Unsupported method");
    });

    it("Should allow calling getWethShare", async function () {
      await expect(
        await roosterAmoStrategy.connect(governor).getWETHShare()
      ).to.be.lte(oethUnits("1"));
    });

    it("Should support WETH", async function () {
      await expect(
        await roosterAmoStrategy.supportsAsset(weth.address)
      ).to.equal(true);

      await expect(
        await roosterAmoStrategy.supportsAsset(oethp.address)
      ).to.equal(false);
    });

    it("Should not revert calling public views", async function () {
      await roosterAmoStrategy.getPoolSqrtPrice();
      await roosterAmoStrategy.getCurrentTradingTick();
      await roosterAmoStrategy.getPositionPrincipal();
      await roosterAmoStrategy.tickDominance();
    });
  });

  describe("Configuration", function () {
    it("Governor can set the allowed pool weth share interval", async () => {
      const { roosterAmoStrategy } = fixture;
      const gov = await roosterAmoStrategy.governor();

      await roosterAmoStrategy
        .connect(await impersonateAndFund(gov))
        .setAllowedPoolWethShareInterval(oethUnits("0.19"), oethUnits("0.23"));

      expect(await roosterAmoStrategy.allowedWethShareStart()).to.equal(
        oethUnits("0.19")
      );

      expect(await roosterAmoStrategy.allowedWethShareEnd()).to.equal(
        oethUnits("0.23")
      );
    });

    it("Only the governor can set the pool weth share", async () => {
      const { rafael, roosterAmoStrategy } = fixture;

      await expect(
        roosterAmoStrategy
          .connect(rafael)
          .setAllowedPoolWethShareInterval(oethUnits("0.19"), oethUnits("0.23"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Can not mint initial position twice", async () => {
      const { governor, roosterAmoStrategy } = fixture;

      await expect(
        roosterAmoStrategy.connect(governor).mintInitialPosition()
      ).to.be.revertedWith("Initial position already minted");
    });

    it("Only the governor can mint the initial position", async () => {
      const { rafael, roosterAmoStrategy } = fixture;

      await expect(
        roosterAmoStrategy.connect(rafael).mintInitialPosition()
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Can not set incorrect pool WETH share intervals", async () => {
      const { roosterAmoStrategy } = fixture;
      const gov = await roosterAmoStrategy.governor();

      await expect(
        roosterAmoStrategy
          .connect(await impersonateAndFund(gov))
          .setAllowedPoolWethShareInterval(oethUnits("0.5"), oethUnits("0.4"))
      ).to.be.revertedWith("Invalid interval");

      await expect(
        roosterAmoStrategy
          .connect(await impersonateAndFund(gov))
          .setAllowedPoolWethShareInterval(
            oethUnits("0.0001"),
            oethUnits("0.5")
          )
      ).to.be.revertedWith("Invalid interval start");

      await expect(
        roosterAmoStrategy
          .connect(await impersonateAndFund(gov))
          .setAllowedPoolWethShareInterval(oethUnits("0.2"), oethUnits("0.96"))
      ).to.be.revertedWith("Invalid interval end");
    });
  });

  describe("Withdraw", function () {
    it("Should allow withdraw when the pool is 80:20 balanced", async () => {
      const { oethpVault, roosterAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethpVault.address
      );

      const balanceBefore = await weth.balanceOf(oethpVault.address);

      const poolPrice = await roosterAmoStrategy.getPoolSqrtPrice();

      // setup() moves the pool closer to 80:20
      const [amountWETH, amountOETHb] =
        await roosterAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await roosterAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethpVault.address, weth.address, oethUnits("1"));

      // Make sure that 1 WETH and 4 OETHb were burned
      const [amountWETHAfter, amountOETHbAfter] =
        await roosterAmoStrategy.getPositionPrincipal();

      expect(amountWETHAfter).to.approxEqualTolerance(
        amountWETH.sub(oethUnits("1"))
      );

      expect(amountOETHbAfter).to.approxEqualTolerance(
        amountOETHb.sub(oethUnits("4")),
        3
      );

      // Make sure there's no price movement
      expect(await roosterAmoStrategy.getPoolSqrtPrice()).to.eq(poolPrice);

      // And recipient has got it
      expect(await weth.balanceOf(oethpVault.address)).to.eq(
        balanceBefore.add(oethUnits("1"))
      );

      // There may remain some WETH left on the strategy contract because of the rounding when
      // removing the liquidity
      expect(await weth.balanceOf(roosterAmoStrategy.address)).to.lte(
        BigNumber.from("1000")
      );

      await verifyEndConditions();
    });

    it("Should allow withdrawAll when the pool is 80:20 balanced", async () => {
      const { oethpVault, roosterAmoStrategy, weth, oethp } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethpVault.address
      );

      const balanceBefore = await weth.balanceOf(oethpVault.address);
      const supplyBefore = await oethp.totalSupply();

      // setup() moves the pool closer to 80:20
      const [amountWETHBefore, amountOETHpBefore] =
        await roosterAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await roosterAmoStrategy.connect(impersonatedVaultSigner).withdrawAll();

      // // Make sure pool is empty
      const [amountWETH, amountOETHb] =
        await roosterAmoStrategy.getPositionPrincipal();
      expect(amountOETHb).to.eq(0);
      expect(amountWETH).to.eq(0);

      // And recipient has got it
      expect(await weth.balanceOf(oethpVault.address)).to.approxEqualTolerance(
        balanceBefore.add(amountWETHBefore)
      );

      // And supply has gone down
      expect(await oethp.totalSupply()).to.eq(
        supplyBefore.sub(amountOETHpBefore)
      );

      // There should be no WETH on the strategy contract
      expect(await weth.balanceOf(roosterAmoStrategy.address)).to.eq(
        oethUnits("0")
      );
    });

    it("Should allow double withdrawAll", async () => {
      const { oethpVault, roosterAmoStrategy } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethpVault.address
      );

      // Try withdrawing an amount
      await roosterAmoStrategy.connect(impersonatedVaultSigner).withdrawAll();
      await roosterAmoStrategy.connect(impersonatedVaultSigner).withdrawAll();
    });

    it("Should withdraw when there's little WETH in the pool", async () => {
      const { oethpVault, roosterAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethpVault.address
      );

      // Drain out most of WETH
      await rebalanceThePoolToWETHRatio("0.01");

      const balanceBefore = await weth.balanceOf(oethpVault.address);

      const [amountWETH, amountOETHb] =
        await roosterAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await roosterAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethpVault.address, weth.address, oethUnits("0.01"));

      // Make sure that 1 WETH was burned and pool composition remains the same
      const [amountWETHAfter, amountOETHbAfter] =
        await roosterAmoStrategy.getPositionPrincipal();
      expect(amountWETHAfter).to.approxEqualTolerance(
        amountWETH.sub(oethUnits("0.01"))
      );
      expect(amountOETHbAfter.div(amountWETHAfter)).to.approxEqualTolerance(
        amountOETHb.div(amountWETH)
      );

      // And recipient has got it
      expect(await weth.balanceOf(oethpVault.address)).to.approxEqualTolerance(
        balanceBefore.add(oethUnits("0.01"))
      );

      // There may remain some WETH left on the strategy contract because of the rounding
      // when removing the liquidity
      expect(await weth.balanceOf(roosterAmoStrategy.address)).to.lte(
        BigNumber.from("1000")
      );

      await verifyEndConditions();
    });

    it("Should withdrawAll when there's little WETH in the pool", async () => {
      const { oethpVault, roosterAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethpVault.address
      );

      // setup() moves the pool closer to 80:20

      // Drain out most of WETH
      await rebalanceThePoolToWETHRatio("0.01");

      const balanceBefore = await weth.balanceOf(oethpVault.address);

      const [amountWETH] = await roosterAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await roosterAmoStrategy.connect(impersonatedVaultSigner).withdrawAll();

      // And recipient has got it
      expect(await weth.balanceOf(oethpVault.address)).to.approxEqualTolerance(
        balanceBefore.add(amountWETH)
      );

      // There should be no WETH on the strategy contract
      expect(await weth.balanceOf(roosterAmoStrategy.address)).to.eq(
        oethUnits("0")
      );

      await verifyEndConditions();
    });

    it("Should withdraw when there's little OETHp in the pool", async () => {
      const { oethpVault, roosterAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethpVault.address
      );

      // setup() moves the pool closer to 80:20
      await rebalanceThePoolToWETHRatio("0.97");

      const balanceBefore = await weth.balanceOf(oethpVault.address);

      const [amountWETH, amountOETHb] =
        await roosterAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await roosterAmoStrategy
        .connect(impersonatedVaultSigner)
        .withdraw(oethpVault.address, weth.address, oethUnits("1"));

      // Make sure that 1 WETH was burned and pool composition remains the same
      const [amountWETHAfter, amountOETHbAfter] =
        await roosterAmoStrategy.getPositionPrincipal();
      expect(amountWETHAfter).to.approxEqualTolerance(
        amountWETH.sub(oethUnits("1"))
      );
      expect(amountOETHbAfter.div(amountWETHAfter)).to.approxEqualTolerance(
        amountOETHb.div(amountWETH)
      );

      // And recipient has got it
      expect(await weth.balanceOf(oethpVault.address)).to.approxEqualTolerance(
        balanceBefore.add(oethUnits("1"))
      );

      // There may remain some WETH left on the strategy contract because of the rounding
      // when removing the liquidity
      expect(await weth.balanceOf(roosterAmoStrategy.address)).to.lte(
        BigNumber.from("10000")
      );

      await verifyEndConditions();
    });

    it("Should withdrawAll when there's little OETHp in the pool", async () => {
      const { oethpVault, roosterAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethpVault.address
      );

      // setup() moves the pool closer to 80:20
      await rebalanceThePoolToWETHRatio("0.97");

      const balanceBefore = await weth.balanceOf(oethpVault.address);

      const [amountWETH] = await roosterAmoStrategy.getPositionPrincipal();

      // Try withdrawing an amount
      await roosterAmoStrategy.connect(impersonatedVaultSigner).withdrawAll();

      // And recipient has got it
      expect(await weth.balanceOf(oethpVault.address)).to.approxEqualTolerance(
        balanceBefore.add(amountWETH)
      );

      // There should be no WETH on the strategy contract
      expect(await weth.balanceOf(roosterAmoStrategy.address)).to.eq(
        oethUnits("0")
      );

      await verifyEndConditions();
    });
  });

  describe("Deposit and rebalance", function () {
    it("Should be able to deposit to the strategy", async () => {
      await mintAndDepositToStrategy();

      await verifyEndConditions();
    });

    it("Should revert when not depositing WETH or amount is 0, or withdrawing WETH", async () => {
      await expect(
        roosterAmoStrategy
          .connect(oethVaultSigner)
          .deposit(oethp.address, BigNumber.from("1"))
      ).to.be.revertedWith("Unsupported asset");

      await expect(
        roosterAmoStrategy
          .connect(oethVaultSigner)
          .withdraw(oethpVault.address, oethp.address, oethUnits("1"))
      ).to.be.revertedWith("Unsupported asset");

      await expect(
        roosterAmoStrategy
          .connect(oethVaultSigner)
          .withdraw(oethpVault.address, weth.address, 0)
      ).to.be.revertedWith("Must withdraw something");

      await expect(
        roosterAmoStrategy
          .connect(oethVaultSigner)
          .withdraw(weth.address, weth.address, oethUnits("1"))
      ).to.be.revertedWith("Only withdraw to vault allowed");

      await expect(
        roosterAmoStrategy
          .connect(oethVaultSigner)
          .deposit(weth.address, BigNumber.from("0"))
      ).to.be.revertedWith("Must deposit something");
    });

    it("Should check that add liquidity in difference cases leaves little weth on the contract", async () => {
      const amount = oethUnits("5");

      await weth.connect(rafael).approve(oethpVault.address, amount);
      await oethpVault.connect(rafael).mint(weth.address, amount, amount);

      const gov = await roosterAmoStrategy.governor();
      await oethpVault
        .connect(await impersonateAndFund(gov))
        .depositToStrategy(
          roosterAmoStrategy.address,
          [weth.address],
          [amount]
        );

      // Rooster LENS contracts have issues where they over-calculate the amount of tokens that need to be
      // deposited
      expect(await weth.balanceOf(roosterAmoStrategy.address)).to.lte(
        oethUnits("10000000000")
      );

      await verifyEndConditions();
    });

    it("Should revert when there is not enough WETH to perform a swap", async () => {
      await rebalanceThePoolToWETHRatio("0.02");
      await expect(
        rebalance(
          oethUnits("1000000000"),
          true, // _swapWETH
          oethUnits("0.009")
        )
      ).to.be.revertedWithCustomError(
        "NotEnoughWethLiquidity(uint256,uint256)"
      );
    });

    it("Should have the correct balance within some tolerance", async () => {
      const balance = await roosterAmoStrategy.checkBalance(weth.address);
      const amountToDeposit = oethUnits("6");
      await mintAndDepositToStrategy({ amount: amountToDeposit });

      // just add liquidity don't move the active trading position
      await rebalance(BigNumber.from("0"), true, BigNumber.from("0"));

      const wethShare = await roosterAmoStrategy.getCurrentWethShare();

      await expect(
        await roosterAmoStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(
        balance.add(amountToDeposit.div(wethShare).mul(oethUnits("1"))),
        1.5
      );

      await verifyEndConditions();
    });

    it("Current trading price shouldn't affect checkBalance", async () => {
      const amountToDeposit = oethUnits("6");
      await mintAndDepositToStrategy({ amount: amountToDeposit });
      const balanceBefore = await roosterAmoStrategy.checkBalance(weth.address);

      // perform a swap
      await swap({
        amount: oethUnits("1"),
        swapWeth: false,
      });

      expect(await roosterAmoStrategy.checkBalance(weth.address)).to.equal(
        balanceBefore
      );

      await verifyEndConditions();
    });

    it("Should be able to rebalance removing half of liquidity", async () => {
      const balance = await roosterAmoStrategy.checkBalance(weth.address);
      const amountToDeposit = oethUnits("6");
      await mintAndDepositToStrategy({ amount: amountToDeposit });

      // just add liquidity don't move the active trading position
      await rebalance(BigNumber.from("0"), true, BigNumber.from("0"), "0.5");

      const wethShare = await roosterAmoStrategy.getCurrentWethShare();

      await expect(
        await roosterAmoStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(
        balance.add(amountToDeposit.div(wethShare).mul(oethUnits("1"))),
        1.5
      );

      await verifyEndConditions();
    });

    it("Should be able to rebalance removing all of liquidity", async () => {
      const balance = await roosterAmoStrategy.checkBalance(weth.address);
      const amountToDeposit = oethUnits("6");
      await mintAndDepositToStrategy({ amount: amountToDeposit });

      // just add liquidity don't move the active trading position
      await rebalance(BigNumber.from("0"), true, BigNumber.from("0"), "1");

      const wethShare = await roosterAmoStrategy.getCurrentWethShare();

      await expect(
        await roosterAmoStrategy.checkBalance(weth.address)
      ).to.approxEqualTolerance(
        balance.add(amountToDeposit.div(wethShare).mul(oethUnits("1"))),
        1.5
      );

      await verifyEndConditions();
    });

    it("Should revert when it fails the slippage check", async () => {
      const amountToDeposit = oethUnits("6");
      await mintAndDepositToStrategy({ amount: amountToDeposit });

      await expect(
        rebalance(oethUnits("1"), true, oethUnits("1.1"))
      ).to.be.revertedWithCustomError("SlippageCheck(uint256)");

      await verifyEndConditions();
    });

    it("Should revert on non WETH balance", async () => {
      await expect(
        roosterAmoStrategy.checkBalance(oethp.address)
      ).to.be.revertedWith("Only WETH supported");
    });

    it("Should throw an exception if not enough WETH on rebalance to perform a swap", async () => {
      // swap out most of the weth
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("4.99"),
        swapWeth: false,
      });

      await expect(
        rebalance(
          (await weth.balanceOf(await roosterAmoStrategy.mPool())).mul("2"),
          true,
          oethUnits("4")
        )
      ).to.be.revertedWithCustomError(
        "NotEnoughWethLiquidity(uint256,uint256)"
      );

      await verifyEndConditions();
    });

    it("Should not be able to rebalance when protocol is insolvent", async () => {
      await mintAndDepositToStrategy({ amount: oethUnits("1000") });
      await roosterAmoStrategy.connect(oethVaultSigner).withdrawAll();

      // ensure there is a LP position
      await mintAndDepositToStrategy({ amount: oethUnits("1") });

      // transfer WETH out making the protocol insolvent
      const swapBal = oethUnits("0.00001");
      const addLiquidityBal = oethUnits("1");
      const balRemaining = (await weth.balanceOf(oethpVault.address))
        .sub(swapBal)
        .sub(addLiquidityBal);

      await weth
        .connect(oethVaultSigner)
        .transfer(roosterAmoStrategy.address, swapBal.add(addLiquidityBal));
      await weth
        .connect(oethVaultSigner)
        .transfer(addresses.dead, balRemaining);

      await expect(
        rebalance(
          swapBal,
          true, // _swapWETHs
          oethUnits("0.000009"),
          "0"
        )
      ).to.be.revertedWith("Protocol insolvent");
    });
  });

  describe("Perform multiple actions", function () {
    it("LP token should stay staked with multiple deposit/withdraw actions", async () => {
      // deposit into pool once
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx = await rebalance(
        oethUnits("0.00001"),
        true, // _swapWETHs
        oethUnits("0.000009")
      );
      await expect(tx).to.emit(roosterAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();

      // deposit into pool again
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx1 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );
      await expect(tx1).to.emit(roosterAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();

      // Withdraw from the pool
      await roosterAmoStrategy
        .connect(oethVaultSigner)
        .withdraw(oethpVault.address, weth.address, oethUnits("1"));
      await verifyEndConditions();

      // deposit into pool again
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx2 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );
      await expect(tx2).to.emit(roosterAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();

      // Withdraw from the pool
      await roosterAmoStrategy
        .connect(oethVaultSigner)
        .withdraw(oethpVault.address, weth.address, oethUnits("1"));
      await verifyEndConditions();

      // Withdraw from the pool
      await roosterAmoStrategy.connect(oethVaultSigner).withdrawAll();

      // deposit into pool again
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      // prettier-ignore
      const tx3 = await rebalance(
        oethUnits("0"),
        true, // _swapWETHs
        oethUnits("0")
      );
      await expect(tx3).to.emit(roosterAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();
    });
  });

  describe("Deposit and rebalance with mocked Vault", async () => {
    beforeEach(async () => {
      fixture = await plumeFixtureWithMockedVault();
      weth = fixture.weth;
      oethpVault = fixture.oethpVault;
      roosterAmoStrategy = fixture.roosterAmoStrategy;
      governor = fixture.governor;
      strategist = fixture.strategist;

      await setup();
    });

    const depositAllVaultWeth = async ({ returnTransaction } = {}) => {
      const wethAvailable = await oethpVault.wethAvailable();
      const gov = await oethpVault.governor();
      const tx = await oethpVault
        .connect(await impersonateAndFund(gov))
        .depositToStrategy(
          roosterAmoStrategy.address,
          [weth.address],
          [wethAvailable]
        );

      if (returnTransaction) {
        return tx;
      }

      await expect(tx).to.emit(roosterAmoStrategy, "PoolRebalanced");
    };

    const depositAllWethAndConfigure1pct = async () => {
      // configure to leave no WETH on the vault
      await configureAutomaticDepositOnMint(oethUnits("0"));
      const outstandingWeth = await oethpVault.outstandingWithdrawalsAmount();

      // send WETH to the vault that is outstanding to be claimed
      await weth
        .connect(fixture.clement)
        .transfer(oethpVault.address, outstandingWeth);

      await depositAllVaultWeth();

      // configure to only keep 1bp of the Vault's totalValue in the Vault;
      const minAmountReserved = await configureAutomaticDepositOnMint(
        oethUnits("0.01")
      );

      return minAmountReserved;
    };

    it("Should not automatically deposit to strategy when below vault buffer threshold", async () => {
      const minAmountReserved = await depositAllWethAndConfigure1pct();

      const amountBelowThreshold = minAmountReserved.div(BigNumber.from("2"));

      await mint({ amount: amountBelowThreshold });
      // There is some WETH usually on the strategy contract because liquidity manager doesn't consume all.
      // Also the strategy contract adjusts WETH supplied to pool down, to mitigate the PoolLens liquidity
      // calculation.
      await expect(await weth.balanceOf(roosterAmoStrategy.address)).to.lte(
        BigNumber.from("1000")
      );

      await expect(await oethpVault.wethAvailable()).to.approxEqualTolerance(
        amountBelowThreshold
      );

      await verifyEndConditions();
    });

    it("Should revert when pool rebalance is off target", async () => {
      const { amount, swapWeth } = await estimateSwapAmountsToReachWethRatio(
        oethUnits("0.91")
      );
      await swap({ amount, swapWeth });
      await mintAndDepositToStrategy({ amount: oethUnits("1000") }, false);
      const { amount: amount2, swapWeth: swapWeth2 } =
        await estimateSwapAmountsToReachWethRatio(oethUnits("0.91"));

      await expect(
        rebalance(amount2, swapWeth2, 0, "0")
      ).to.be.revertedWithCustomError(
        "PoolRebalanceOutOfBounds(uint256,uint256,uint256)"
      );

      await expect(
        rebalance(amount.add(amount), swapWeth2, 0, "0")
      ).to.be.revertedWithCustomError("OutsideExpectedTickRange()");
    });

    it("Should be able to rebalance the pool when price pushed very close to 1:1", async () => {
      const { amount: amountToSwap, swapWeth: swapWethToSwap } =
        await estimateSwapAmountsToReachWethRatio(oethUnits("0.99"));
      await swap({
        amount: amountToSwap,
        swapWeth: swapWethToSwap,
      });

      const { amount, swapWeth } =
        await estimateSwapAmountsToGetToConfiguredInterval();

      await rebalance(amount, swapWeth, 0, "0");
      await verifyEndConditions();
    });

    it("Should be able to rebalance the pool when price pushed very close to OETHb costing 0.9999 WETH", async () => {
      const { amount: amountToSwap, swapWeth: swapWethToSwap } =
        await estimateSwapAmountsToReachWethRatio(oethUnits("0.01"));
      await swap({
        amount: amountToSwap,
        swapWeth: swapWethToSwap,
      });

      const { amount, swapWeth } =
        await estimateSwapAmountsToGetToConfiguredInterval();
      await mintAndDepositToStrategy({ amount: oethUnits("1000") }, false);

      await rebalance(amount, swapWeth, 0, "0");
      await verifyEndConditions();
    });

    it("Should be able to deposit to the pool & rebalance", async () => {
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      let { amount, swapWeth } =
        await estimateSwapAmountsToGetToConfiguredInterval();

      const tx = await rebalance(amount, swapWeth, 0, "0");

      await expect(tx).to.emit(roosterAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();
    });

    it("Should be able to rebalance when small amount of WETH needs to be removed as swap liquidity", async () => {
      await mintAndDepositToStrategy({ amount: oethUnits("5") });

      const { amount, swapWeth } =
        await estimateSwapAmountsToGetToConfiguredInterval();
      // rebalance to use up any WETH liquidity on the contract
      await rebalance(amount, swapWeth, 0, "0");
      // rebalance requiring small amount of WETH (increasing)
      await rebalance(BigNumber.from("100"), true, 0, "0");
      await rebalance(BigNumber.from("10000"), true, 0, "0");
      await rebalance(BigNumber.from("1000000"), true, 0, "0");
      await rebalance(BigNumber.from("100000000"), true, 0, "0");
      await rebalance(BigNumber.from("10000000000"), true, 0, "0");
      await rebalance(BigNumber.from("1000000000000"), true, 0, "0");

      await verifyEndConditions();
    });

    it("Should be able to deposit to the pool & rebalance multiple times", async () => {
      await mintAndDepositToStrategy({ amount: oethUnits("5") });
      let { amount, swapWeth } =
        await estimateSwapAmountsToGetToConfiguredInterval();
      const tx = await rebalance(amount, swapWeth, 0, "0");
      await expect(tx).to.emit(roosterAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();

      await mintAndDepositToStrategy({ amount: oethUnits("5") });

      let { amount: amount1, swapWeth: swapWeth1 } =
        await estimateSwapAmountsToGetToConfiguredInterval();
      const tx1 = await rebalance(amount1, swapWeth1, 0, "0");
      await expect(tx1).to.emit(roosterAmoStrategy, "PoolRebalanced");
      await verifyEndConditions();
    });

    const depositValues = [
      "0.5",
      "2.5",
      "3.5",
      "5",
      "9",
      "50",
      "250",
      "500",
      "1500",
      "2500",
    ];
    for (const depositValue of depositValues) {
      it(`Should be able to deposit to the pool & rebalance multiple times with ${depositValue} deposit`, async () => {
        await mintAndDepositToStrategy({ amount: oethUnits("5") });
        let { amount, swapWeth } =
          await estimateSwapAmountsToGetToConfiguredInterval();
        const tx = await rebalance(amount, swapWeth, 0, "0");
        await expect(tx).to.emit(roosterAmoStrategy, "PoolRebalanced");
        await verifyEndConditions();

        await mintAndDepositToStrategy({ amount: oethUnits("5") });

        let { amount: amount1, swapWeth: swapWeth1 } =
          await estimateSwapAmountsToGetToConfiguredInterval();
        const tx1 = await rebalance(amount1, swapWeth1, 0, "0");
        await expect(tx1).to.emit(roosterAmoStrategy, "PoolRebalanced");
        await verifyEndConditions();
      });
    }
  });

  describe("Rewards", function () {
    it("Should be able to claim rewards when available", async () => {
      // Make sure the strategy has something
      await mintAndDepositToStrategy({ amount: oethUnits("5") });

      const wPlume = await ethers.getContractAt(
        "IWETH9",
        addresses.plume.WPLUME
      );
      const balanceBefore = await wPlume.balanceOf(strategist.address);
      await roosterAmoStrategy.connect(strategist).collectRewardTokens();
      const balanceAfter = await wPlume.balanceOf(strategist.address);

      const balanceDiff = balanceAfter.sub(balanceBefore);
      expect(balanceDiff).to.eq(oethUnits("1"));
    });
  });

  const setup = async () => {
    await mintAndDepositToStrategy({
      amount: oethUnits("100"),
      returnTransaction: true,
    });

    await oethpVault.connect(rafael).rebase();

    let { amount, swapWeth } =
      await estimateSwapAmountsToGetToConfiguredInterval();

    await rebalance(amount, swapWeth, 0, "0");
  };

  const swap = async ({ amount, swapWeth }) => {
    // Check if rafael as enough token to perform swap
    // If not, mint some
    const balanceOETHp = await oethp.balanceOf(rafael.address);
    if (!swapWeth && balanceOETHp.lt(amount)) {
      await weth.connect(rafael).approve(oethpVault.address, amount);
      await oethpVault.connect(rafael).mint(weth.address, amount, amount);
    }

    if (swapWeth) {
      await weth.connect(rafael).transfer(roosterOETHpWETHpool.address, amount);
    } else {
      await oethp
        .connect(rafael)
        .transfer(roosterOETHpWETHpool.address, amount);
    }

    await roosterOETHpWETHpool.connect(rafael).swap(
      rafael.address,
      {
        amount: amount,
        tokenAIn: swapWeth,
        exactOutput: false,
        tickLimit: swapWeth ? 2147483647 : -2147483648,
      },
      "0x"
    );
  };

  // get the middle point of configured weth share interval
  const getConfiguredWethShare = async () => {
    const wethShareStart = await roosterAmoStrategy.allowedWethShareStart();
    const wethShareEnd = await roosterAmoStrategy.allowedWethShareEnd();

    return wethShareStart.add(wethShareEnd).div(BigNumber.from("2"));
  };

  const rebalanceThePoolToWETHRatio = async (wethRatio) => {
    const { amount, swapWeth } = await estimateSwapAmountsToReachWethRatio(
      oethUnits(wethRatio)
    );
    await swap({ amount, swapWeth });
  };

  const estimateSwapAmountsToGetToConfiguredInterval = async () => {
    const configuredWethShare = await getConfiguredWethShare();
    return await estimateSwapAmountsToReachWethRatio(configuredWethShare);
  };

  // the amount to swap (and token type) to reach desired WETH ratio
  // Notice: this only works if the pools is already in the tick -1 where
  // all the liquidity is deployed
  const estimateSwapAmountsToReachWethRatio = async (wethRatio) => {
    let currentTradingTick = parseInt(
      (await roosterAmoStrategy.getCurrentTradingTick()).toString()
    );
    let totalAmount = BigNumber.from("0");

    while (currentTradingTick < -1) {
      totalAmount = totalAmount.add(await _getOETHInTick(currentTradingTick));
      currentTradingTick += 1;
    }

    while (currentTradingTick > -1) {
      totalAmount = totalAmount.add(await _getWETHInTick(currentTradingTick));
      currentTradingTick -= 1;
    }

    let { amount, swapWeth } = await _estimateAmountsWithinTheAMOTick(
      wethRatio
    );
    amount = amount.add(totalAmount);
    return {
      amount,
      swapWeth,
    };
  };

  const _getWETHInTick = async (tradingTick) => {
    const tickState = await roosterOETHpWETHpool.getTick(tradingTick);
    return tickState.reserveA;
  };

  const _getOETHInTick = async (tradingTick) => {
    const tickState = await roosterOETHpWETHpool.getTick(tradingTick);
    return tickState.reserveB;
  };

  const _estimateAmountsWithinTheAMOTick = async (wethRatio) => {
    const tickState = await roosterOETHpWETHpool.getTick(-1);

    const wethAmount = tickState.reserveA;
    const oethAmount = tickState.reserveB;

    const total = wethAmount.add(oethAmount);
    // 1e18 denominated
    const currentWethRatio = wethAmount.mul(oethUnits("1")).div(total);

    let diff, swapWeth;
    if (wethRatio.gt(currentWethRatio)) {
      diff = wethRatio.sub(currentWethRatio);
      swapWeth = true;
    } else {
      diff = currentWethRatio.sub(wethRatio);
      swapWeth = false;
    }

    return {
      amount: diff.mul(total).div(oethUnits("1")),
      swapWeth,
    };
  };

  const rebalance = async (
    amountToSwap,
    swapWETH,
    minTokenReceived,
    liquidityToRemove = "1"
  ) => {
    return await roosterAmoStrategy
      .connect(strategist)
      .rebalance(
        amountToSwap,
        swapWETH,
        minTokenReceived,
        oethUnits(liquidityToRemove)
      );
  };

  const mint = async ({ userOverride, amount } = {}) => {
    const user = userOverride || rafael;
    amount = amount || oethUnits("5");

    const balance = weth.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, weth, amount + balance, hre);
    }
    await weth.connect(user).approve(oethpVault.address, amount);
    const tx = await oethpVault
      .connect(user)
      .mint(weth.address, amount, amount);
    return tx;
  };

  const mintAndDepositToStrategy = async (
    { userOverride, amount, returnTransaction } = {},
    expectPoolRebalanced = true
  ) => {
    const user = userOverride || rafael;
    amount = amount || oethUnits("5");

    const balance = weth.balanceOf(user.address);
    if (balance < amount) {
      await setERC20TokenBalance(user.address, weth, amount + balance, hre);
    }
    await weth.connect(user).approve(oethpVault.address, amount);
    await oethpVault.connect(user).mint(weth.address, amount, amount);

    const gov = await oethpVault.governor();
    const tx = await oethpVault
      .connect(await impersonateAndFund(gov))
      .depositToStrategy(roosterAmoStrategy.address, [weth.address], [amount]);

    if (returnTransaction) {
      return tx;
    }

    if (expectPoolRebalanced) {
      await expect(tx).to.emit(roosterAmoStrategy, "PoolRebalanced");
    }
  };

  /** When tests finish:
   * - there should be no substantial amount of WETH / OETHp left on the strategy contract
   */
  const verifyEndConditions = async () => {
    await expect(await weth.balanceOf(roosterAmoStrategy.address)).to.lte(
      oethUnits("0.00001")
    );
    await expect(await oethp.balanceOf(roosterAmoStrategy.address)).to.lte(
      oethUnits("0.000001")
    );
  };
});
