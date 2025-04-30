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
    governor,
    strategist,
    rafael;

  beforeEach(async () => {
    fixture = await plumeFixture();
    weth = fixture.weth;
    oethp = fixture.oethp;
    oethpVault = fixture.oethpVault;
    roosterAmoStrategy = fixture.roosterAmoStrategy;
    governor = fixture.governor;
    strategist = fixture.strategist;
    rafael = fixture.rafael;
    oethpVaultSigner = await impersonateAndFund(oethpVault.address);

    // await setup();
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
        oethUnits("0.20")
      );

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
      expect(await roosterAmoStrategy.getPoolX96Price()).to.eq(poolPrice);

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
  });

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