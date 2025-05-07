const hre = require("hardhat");
const {
  createFixtureLoader,
  nodeRevert,
  nodeSnapshot,
} = require("../../_fixture");

const addresses = require("../../../utils/addresses");
const {
  defaultPlumeFixture,
} = require("../../_fixture-plume");
const { expect } = require("chai");
const { oethUnits } = require("../../helpers");
const ethers = require("ethers");
const { impersonateAndFund } = require("../../../utils/signers");
const { BigNumber } = ethers;

const plumeFixture = createFixtureLoader(defaultPlumeFixture);
const { setERC20TokenBalance } = require("../../_fund");

describe.only("ForkTest: Rooster AMO Strategy (Plume)", async function () {
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
    fixture = await plumeFixture();
    weth = fixture.weth;
    oethp = fixture.oethp;
    oethpVault = fixture.oethpVault;
    roosterAmoStrategy = fixture.roosterAmoStrategy;
    roosterOETHpWETHpool = fixture.roosterOETHpWETHpool;
    governor = fixture.governor;
    strategist = fixture.strategist;
    rafael = fixture.rafael;
    oethpVaultSigner = await impersonateAndFund(oethpVault.address);

    await setup();
    // await weth
    //   .connect(rafael)
    //   .approve(aeroSwapRouter.address, oethUnits("1000000000"));
    // await oethb
    //   .connect(rafael)
    //   .approve(aeroSwapRouter.address, oethUnits("1000000000"));
  });

  // const configureAutomaticDepositOnMint = async (vaultBuffer) => {
  //   await oethpVault.connect(governor).setVaultBuffer(vaultBuffer);

  //   const totalValue = await oethpVault.totalValue();

  //   // min mint to trigger deposits
  //   return totalValue.mul(vaultBuffer).div(oethUnits("1"));
  // };

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

      // There may remain some WETH left on the strategy contract because:
      // When calculating `shareOfWetToRemove` on `withdraw` function in `roosterAmoStrategy.sol`, the result is rounded up.
      // This leads to a maximum of 1wei error of the `shareOfWetToRemove` value.
      // Then this value is multiplied by the `_getLiquidity()` value which multiplies the previous error.
      // The value of `_getLiquidity()` is expressed in ethers, for example at block 19670000 it was approx 18_000_000 ethers.
      // This leads to a maximum of 18_000_000 wei error in this situation (due to `mulTruncate()` function).
      // At the end, the bigger the `_getLiquidity()` value the bigger the error.
      // However, during test the error values remains most of the time below 1e6wei.
      expect(await weth.balanceOf(roosterAmoStrategy.address)).to.lte(
        BigNumber.from("1000000")
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

      console.log("OETHp in position before withdrawal", amountOETHpBefore.toString());
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

      // TODO: address this
      // await assetLpNOTStakedInGauge();
    });

    it("Should withdraw when there's little WETH in the pool", async () => {
      const { oethpVault, roosterAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethpVault.address
      );

      // Drain out most of WETH
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("3.5"),
        swapWeth: false,
      });

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

      // There may remain some WETH left on the strategy contract because:
      // When calculating `shareOfWetToRemove` on `withdraw` function in `roosterAmoStrategy.sol`, the result is rounded up.
      // This leads to a maximum of 1wei error of the `shareOfWetToRemove` value.
      // Then this value is multiplied by the `_getLiquidity()` value which multiplies the previous error.
      // The value of `_getLiquidity()` is expressed in ethers, for example at block 19670000 it was approx 18_000_000 ethers.
      // This leads to a maximum of 18_000_000 wei error in this situation (due to `mulTruncate()` function).
      // At the end, the bigger the `_getLiquidity()` value the bigger the error.
      // However, during test the error values remains most of the time below 1e6wei.
      expect(await weth.balanceOf(roosterAmoStrategy.address)).to.lte(
        BigNumber.from("1000000")
      );

      await verifyEndConditions();
    });

    it.only("Should withdrawAll when there's little WETH in the pool", async () => {
      const { oethpVault, roosterAmoStrategy, weth } = fixture;

      const impersonatedVaultSigner = await impersonateAndFund(
        oethpVault.address
      );

      // setup() moves the pool closer to 80:20

      // Drain out most of WETH
      await swap({
        // Pool has 5 WETH
        amount: oethUnits("3.5"),
        swapWeth: false,
      });

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

      await verifyEndConditions(false);
    });
  });
  
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
      await oethp.connect(rafael).transfer(roosterOETHpWETHpool.address, amount);
    }

    await roosterOETHpWETHpool
      .connect(rafael)
      .swap(
        rafael.address,
        {
          amount: amount,
          tokenAIn: swapWeth,
          exactOutput: false,
          tickLimit: swapWeth ? 2147483647 : -2147483648
        },
        "0x"
      );
  };

  const setup = async () => {
    await mintAndDepositToStrategy({
      amount: oethUnits("5"),
      returnTransaction: true,
    });

    await oethpVault.connect(rafael).rebase();

    // TODO: figure out how to get a good quote for the amount swapped required in order 
    // to reach a targeted desired amount
    // const { value, direction } = await quoteAmountToSwapBeforeRebalance({
    //   lowValue: oethUnits("0"),
    //   highValue: oethUnits("0"),
    // });

    // move the price close to pre-configured 20% value
    await rebalance(
      oethUnits("0"),
      false, // _swapWETH
      0
    );
  };

  const rebalance = async (amountToSwap, swapWETH, minTokenReceived) => {
    return await roosterAmoStrategy
      .connect(strategist)
      .rebalance(amountToSwap, swapWETH, minTokenReceived);
  };

  const mintAndDepositToStrategy = async ({
    userOverride,
    amount,
    returnTransaction,
  } = {}) => {
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
      .depositToStrategy(
        roosterAmoStrategy.address,
        [weth.address],
        [amount]
      );

    if (returnTransaction) {
      return tx;
    }

    await expect(tx).to.emit(roosterAmoStrategy, "PoolRebalanced");
  };

  /** When tests finish:
   * - nft LP token should remain staked
   * - there should be no substantial amount of WETH / OETHb left on the strategy contract
   */
  const verifyEndConditions = async (lpStaked = true) => {
    if (lpStaked) {
      //await assetLpStakedInGauge();
    } else {
      //await assetLpNOTStakedInGauge();
    }

    // await expect(await weth.balanceOf(roosterAmoStrategy.address)).to.lte(
    //   oethUnits("0.00001")
    // );
    // await expect(await oethb.balanceOf(roosterAmoStrategy.address)).to.equal(
    //   oethUnits("0")
    // );
  };
});