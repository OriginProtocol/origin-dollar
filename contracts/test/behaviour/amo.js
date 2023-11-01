const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");
const { BigNumber } = require("ethers");

const { units } = require("../helpers");
const { MAX_UINT256 } = require("../../utils/constants");
const { impersonateAndFund } = require("../../utils/signers");
const addresses = require("../../utils/addresses");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * - oToken: the OToken. eg OETH or USDD
 * - vaultAsset: the token of the vault collateral asset. eg WETH, frxETH, DAI/USDC/USDT
 * - poolAsset: the token of the Curve or Balancer asset. eg ETH, frxETH, 3Crv
 * - curvePool: The Curve pool contract else undefined
 * - balancerPool: The Balancer pool contract else undefined
 * - vault: Vault or OETHVault contract
 * - assetDivisor: 3 for the OUSD AMO strategy that uses the 3Pool. Others are 1
 * @example
    shouldBehaveLikeStrategy(() => ({
      ...fixture,
    strategy: fixture.convexEthMetaStrategy,
    oToken: fixture.OETH,
    vaultAsset: fixture.weth,
    poolAssetAddress: addresses.ETH,
    assetIndex: 0,
    assetDivisor: 1
    curvePool: fixture.CurveOethEthPool,
    vault: fixture.oethVault,
    }));
 */
const shouldBehaveLikeAmo = (context) => {
  describe("AMO behaviour", () => {
    const littleOTokenAmount = parseUnits("1");
    const lotOTokenAmount = parseUnits("25");
    let littleAssetAmount;
    beforeEach(async () => {
      const { vaultAsset } = context();
      littleAssetAmount = await units("1", vaultAsset);
    });
    it("Should have AMO configured", async () => {
      const {
        curvePool,
        balancerPool,
        oToken,
        poolAssetAddress,
        vaultAsset,
        strategy,
      } = context();
      expect(await strategy.lpToken()).to.equal(
        curvePool.address || balancerPool.address
      );
      expect(await strategy.vaultAsset()).to.equal(vaultAsset.address);
      expect(await strategy.poolAsset()).to.equal(poolAssetAddress);
      expect(await strategy.oToken()).to.equal(oToken.address);
    });
    describe("with no assets in the strategy", () => {
      describe("with no assets in the pool", () => {
        it("Should be able to deposit each asset", async () => {
          const { assetDivisor, oToken, strategy, vault, vaultAsset } =
            context();

          const vaultSigner = await impersonateAndFund(vault.address);

          const depositAmountStr = "1000";
          const depositAmount = await units(depositAmountStr, vaultAsset);
          // mint some test assets to the vault
          await vaultAsset.connect(vaultSigner).mint(depositAmount);
          // and then transfer to the strategy
          await vaultAsset
            .connect(vaultSigner)
            .transfer(strategy.address, depositAmount);

          // prettier-ignore
          const tx = await strategy
              .connect(vaultSigner)["deposit(address,uint256)"](vaultAsset.address, depositAmount);

          const platformAddress = await strategy.assetToPToken(
            vaultAsset.address
          );
          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(vaultAsset.address, platformAddress, depositAmount);
          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(
              oToken.address,
              platformAddress,
              parseUnits(depositAmountStr)
            );

          // Has to be 2x the deposit amount
          expect(await strategy.checkBalance(vaultAsset.address)).to.be.eq(
            depositAmount.mul(2).div(assetDivisor)
          );
        });
        it("Should be able to deposit all asset together", async () => {
          const { assetDivisor, oToken, strategy, vault, vaultAsset } =
            context();

          const vaultSigner = await impersonateAndFund(vault.address);

          const depositAmountStr = "1000";
          const depositAmount = await units(depositAmountStr, vaultAsset);
          // mint some test assets to the vault
          await vaultAsset.connect(vaultSigner).mint(depositAmount);
          // and then transfer to the strategy
          await vaultAsset
            .connect(vaultSigner)
            .transfer(strategy.address, depositAmount);

          const tx = await strategy.connect(vaultSigner).depositAll();

          const platformAddress = await strategy.assetToPToken(
            vaultAsset.address
          );
          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(vaultAsset.address, platformAddress, depositAmount);
          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(
              oToken.address,
              platformAddress,
              parseUnits(depositAmountStr)
            );

          // Has to be 2x the deposit amount
          expect(await strategy.checkBalance(vaultAsset.address)).to.be.eq(
            depositAmount.mul(2).div(assetDivisor)
          );
        });
      });
    });
    describe("with assets in the strategy", () => {
      const initialDepositAmount = "800";
      beforeEach(async () => {
        await depositAsset(context(), initialDepositAmount);
      });
      describe("with a balanced pool of OTokens and vault assets", () => {
        beforeEach(async () => {
          // Add 1/5 of the liquidity not owned by the strategy
          curveAddLiquidity({
            ...context(),
            assetAmount: "200",
            oTokenAmount: "200",
          });
        });
        it("Should deposit vault assets. OTokens == assets", async () => {
          const { curvePool, vaultAsset, oToken, strategy } = context();
          const depositAmountStr = "1000";
          const depositAmount = await units(depositAmountStr, vaultAsset);
          const oTokenAmount = parseUnits(depositAmountStr);

          const tx = await depositAsset(context(), depositAmount);

          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(vaultAsset.address, curvePool.address, depositAmount);
          // OToken amount == deposit amount scaled up to 18 decimals
          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(oToken.address, curvePool.address, oTokenAmount);
        });
        it("Should withdraw vault assets. OTokens == assets", async () => {
          const { curvePool, vault, vaultAsset, oToken, strategy } = context();

          const vaultSigner = await impersonateAndFund(vault.address);
          const withdrawAmount = (
            await units(initialDepositAmount, vaultAsset)
          ).sub(10);
          const oTokenAmount = parseUnits(initialDepositAmount);

          // prettier-ignore
          const tx = await strategy
            .connect(vaultSigner)["withdraw(address,address,uint256)"](
              vault.address,
              vaultAsset.address,
              withdrawAmount
            );

          await expect(tx)
            .to.emit(strategy, "Withdrawal")
            .withArgs(vaultAsset.address, curvePool.address, withdrawAmount);
          await expect(tx).to.emit(strategy, "Withdrawal").withNamedArgs({
            _asset: oToken.address,
            _pToken: curvePool.address,
          });
          const receipt = await tx.wait();
          const oTokenWithdrawEvent = receipt.events.find(
            (e) => e.event === "Withdrawal" && e.args[0] === oToken.address
          );
          expect(oTokenWithdrawEvent).to.not.be.undefined;
          expect(oTokenWithdrawEvent.args[0]).to.eq(oToken.address);
          // OToken amount == deposit amount scaled up to 18 decimals
          expect(oTokenWithdrawEvent.args[2]).to.approxEqualTolerance(
            oTokenAmount,
            0.01
          );
        });
        it("Should not mint a little OTokens", async () => {
          const { strategist, strategy } = context();

          const tx = strategy
            .connect(strategist)
            .mintAndAddOTokens(littleOTokenAmount);
          await expect(tx).to.revertedWith("OTokens balance worse");
        });
        it("Should not remove a little OTokens", async () => {
          const { strategist, strategy } = context();

          const tx = strategy
            .connect(strategist)
            .removeAndBurnOTokens(littleOTokenAmount);
          await expect(tx).to.revertedWith("OTokens overshot peg");
        });
        it("Should not remove a little pool assets", async () => {
          const { strategist, strategy } = context();

          // diffBefore == 0 and diffAfter > diffBefore so is "OTokens balance worse"
          const tx = strategy
            .connect(strategist)
            .removeOnlyAssets(littleAssetAmount);
          await expect(tx).to.revertedWith("OTokens balance worse");
        });
      });
      describe("with the pool tilted a little to OTokens", () => {
        beforeEach(async () => {
          // Add 1/5 of the liquidity not owned by the strategy
          await curveAddLiquidity({
            ...context(),
            poolAssetAmount: "200",
            oTokenAmount: "220",
          });
        });
        it("Should deposit vault assets. OTokens == assets", async () => {
          const { curvePool, vaultAsset, oToken, strategy } = context();
          const depositAmountStr = "1000";
          const depositAmount = await units(depositAmountStr, vaultAsset);
          const oTokenAmount = parseUnits(depositAmountStr);

          const tx = await depositAsset(context(), depositAmount);

          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(vaultAsset.address, curvePool.address, depositAmount);
          // OToken amount == deposit amount scaled up to 18 decimals
          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(oToken.address, curvePool.address, oTokenAmount);
        });
        it("Should withdraw vault assets. OTokens > assets", async () => {
          const { curvePool, vault, vaultAsset, oToken, strategy } = context();

          const vaultSigner = await impersonateAndFund(vault.address);
          // For OUSD, this is scaled to 6 decimals
          const initialDepositAmountScaled = await units(
            initialDepositAmount,
            vaultAsset
          );
          // Withdraw 1% less than the initial deposit amount
          const withdrawAssetAmount = initialDepositAmountScaled
            .mul(99)
            .div(100);
          const oTokenAmount = parseUnits(initialDepositAmount)
            .mul(99)
            .div(100);

          // prettier-ignore
          const tx = await strategy
            .connect(vaultSigner)["withdraw(address,address,uint256)"](
              vault.address,
              vaultAsset.address,
              withdrawAssetAmount
            );

          await expect(tx)
            .to.emit(strategy, "Withdrawal")
            .withArgs(
              vaultAsset.address,
              curvePool.address,
              withdrawAssetAmount
            );
          await expect(tx).to.emit(strategy, "Withdrawal").withNamedArgs({
            _asset: oToken.address,
            _pToken: curvePool.address,
          });
          const receipt = await tx.wait();
          const oTokenWithdrawEvent = receipt.events.find(
            (e) => e.event === "Withdrawal" && e.args[0] === oToken.address
          );
          expect(oTokenWithdrawEvent).to.not.be.undefined;
          expect(oTokenWithdrawEvent.args[0]).to.eq(oToken.address);
          // OToken amount > deposit amount scaled up to 18 decimals
          expect(oTokenWithdrawEvent.args[2]).to.gt(
            oTokenAmount.add(littleOTokenAmount)
          );
          expect(oTokenWithdrawEvent.args[2]).to.lt(oTokenAmount.mul(2));
        });
        it("Should not mint a little OTokens", async () => {
          const { strategist, strategy } = context();

          const tx = strategy
            .connect(strategist)
            .mintAndAddOTokens(littleOTokenAmount);
          await expect(tx).to.revertedWith("OTokens balance worse");
        });
        it("Should remove a little OTokens", async () => {
          const { curvePool, oToken, strategist, strategy } = context();

          const tx = await strategy
            .connect(strategist)
            .removeAndBurnOTokens(littleOTokenAmount);

          await expect(tx)
            .to.emit(strategy, "Withdrawal")
            .withArgs(oToken.address, curvePool.address, littleOTokenAmount);
          // OToken is removed from the pool to the strategy
          await expect(tx)
            .to.emit(oToken, "Transfer")
            .withArgs(curvePool.address, strategy.address, littleOTokenAmount);
          // OToken is burned from the strategy
          await expect(tx)
            .to.emit(oToken, "Transfer")
            .withArgs(strategy.address, addresses.zero, littleOTokenAmount);
        });
        it("Should not remove a lot of OTokens", async () => {
          const { strategist, strategy } = context();

          const tx = strategy
            .connect(strategist)
            .removeAndBurnOTokens(lotOTokenAmount);
          await expect(tx).to.revertedWith("OTokens overshot peg");
        });
        it("Should not remove a little pool assets", async () => {
          const { strategist, strategy } = context();

          // diffBefore < 0 and diffAfter > diffBefore so is "OTokens balance worse"
          const tx = strategy
            .connect(strategist)
            .removeOnlyAssets(littleOTokenAmount);
          await expect(tx).to.revertedWith("OTokens balance worse");
        });
      });
      describe("with the pool tilted a lot to OTokens", () => {
        // Should deposit assets. OTokens == assets
        // Should withdraw remove assets. OTokens > assets
        // Should not mintAndAddOTokens
        // Should removeAndBurnOTokens
        // Should not removeAndBurnOTokens a lot of OTokens
        // Should not removeOnlyAssets
      });
      describe("with the pool tilted a little to vault assets", () => {
        // Should deposit assets. OTokens > assets
        // Should withdraw remove assets. OTokens < assets
        // Should mintAndAddOTokens
        // Should not mintAndAddOTokens a lot of OTokens
        // Should not removeAndBurnOTokens
        // Should removeOnlyAssets
        // Should not removeOnlyAssets a lot of assets
      });
      describe("with the pool tilted a lot to vault assets", () => {
        // Should deposit assets. OTokens == 2x assets
        // Should withdraw remove assets. OTokens < assets
        // Should mintAndAddOTokens
        // Should not mintAndAddOTokens a lot of OTokens
        // Should not removeAndBurnOTokens
        // Should removeOnlyAssets
        // Should not removeOnlyAssets a lot of assets
      });
    });
  });
};

const depositAsset = async (fixture, amount = "1000") => {
  const { strategy, vaultAsset, vault } = fixture;

  const vaultSigner = await impersonateAndFund(vault.address);

  // deposit some assets into the strategy so we can withdraw them
  const depositAmount = BigNumber.isBigNumber(amount)
    ? amount
    : await units(amount, vaultAsset);
  // mint some test assets to the vault
  // can't mint directly to strategy as that requires ETH and with throw the OETH AMO tests
  await vaultAsset.connect(vaultSigner).mint(depositAmount);
  // transfer test assets to the strategy
  await vaultAsset
    .connect(vaultSigner)
    .transfer(strategy.address, depositAmount);
  return await strategy.connect(vaultSigner).depositAll();
};

const curveAddLiquidity = async (fixture) => {
  const {
    poolAssetAmount,
    curvePool,
    josh,
    oToken,
    oTokenAmount,
    poolAssetAddress,
    vault,
    vaultAsset,
  } = fixture;

  // Give Josh some pool assets if not ETH. eg 3Crv, WETH or frxETH
  if (poolAssetAddress !== addresses.ETH) {
    const poolAsset = await ethers.getContractAt(
      "MintableERC20",
      poolAssetAddress
    );
    // Mint some Curve pool assets
    await poolAsset.connect(josh).mint(parseUnits(poolAssetAmount ?? "0"));
    // Approve the Curve pool to transfer the pool assets
    await poolAsset.connect(josh).approve(curvePool.address, MAX_UINT256);
  }

  // Give Josh some OTokens by minting them
  const mintAmount = await units(oTokenAmount ?? "0", vaultAsset);
  await vaultAsset.connect(josh).mint(mintAmount);
  await vaultAsset.connect(josh).approve(vault.address, MAX_UINT256);
  await vault.connect(josh).mint(vaultAsset.address, mintAmount, 0);
  // Approve the Curve pool to transfer OTokens
  await oToken.connect(josh).approve(curvePool.address, MAX_UINT256);

  const amounts = poolAmounts(fixture);

  const value =
    poolAssetAddress === addresses.ETH ? parseUnits(poolAssetAmount ?? "0") : 0;

  // prettier-ignore
  await curvePool
      .connect(josh)["add_liquidity(uint256[2],uint256)"](amounts, 0, {value});
};

/// Returns the pool amounts in the order of the Curve pool
const poolAmounts = (fixture) => {
  const { assetIndex, poolAssetAmount, oTokenAmount } = fixture;

  if (assetIndex !== 0 && assetIndex !== 1) {
    throw Error("Missing assetIndex of the pool");
  }

  const poolAssetAmountScaled = parseUnits(poolAssetAmount ?? "0");
  const oTokenAmountScaled = parseUnits(oTokenAmount ?? "0");
  return assetIndex === 0
    ? [poolAssetAmountScaled, oTokenAmountScaled]
    : [oTokenAmountScaled, poolAssetAmountScaled];
};

module.exports = {
  shouldBehaveLikeAmo,
};
