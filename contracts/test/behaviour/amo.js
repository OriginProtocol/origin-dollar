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
 * - assetDivisor: 3 for the OUSD AMO strategy that uses the 3Pool. Others are 1
 * - curvePool: The Curve pool contract else undefined
 * - balancerPool: The Balancer pool contract else undefined
 * - vault: Vault or OETHVault contract
 * - convexPID: Convex Pool Identifier. eg 56 for OUSD/3Crv
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
    convexPID: convex_frxETH_WETH_PID,
    }));
 */
const shouldBehaveLikeAmo = (context) => {
  /*****************************************
            Assert Deposit
   *****************************************/

  const assertDeposit = async (
    tx,
    assetAmount,
    oTokenAmount,
    checkBalanceBefore = BigNumber.from(0)
  ) => {
    const { assetDivisor, curvePool, oToken, strategy, vaultAsset } = context();
    // strategy Deposit event for the vault asset
    await expect(tx)
      .to.emit(strategy, "Deposit")
      .withArgs(vaultAsset.address, curvePool.address, assetAmount);
    // There is no asset transfer to the strategy as that happens before the vault calls deposit

    // strategy Deposit event for the OToken
    await expect(tx)
      .to.emit(strategy, "Deposit")
      .withArgs(oToken.address, curvePool.address, oTokenAmount);
    // OToken is minted to the the strategy
    await expect(tx)
      .to.emit(oToken, "Transfer")
      .withArgs(addresses.zero, strategy.address, oTokenAmount);

    // Strategy balance has to be 2x the deposit amount
    // for the OUSD AMO using the 3Pool, the balance is
    // split across DAI, USDC and USDT so is divided by 3
    const vaultAssetDecimals = await vaultAsset.decimals();
    const assetMultiplier = BigNumber.from(10).pow(18 - vaultAssetDecimals);
    // scale up to 18 decimals
    const assetAmountScaled = assetAmount.mul(assetMultiplier);
    const checkBalanceIncreaseScaled = assetAmountScaled
      .add(oTokenAmount)
      .div(assetDivisor);
    // scale back down to the asset decimals
    const checkBalanceIncreaseExpected =
      checkBalanceIncreaseScaled.div(assetMultiplier);
    expect(
      await strategy.checkBalance(vaultAsset.address)
    ).to.be.approxEqualTolerance(
      checkBalanceBefore.add(checkBalanceIncreaseExpected),
      0.01 // 1 basis point tolerance
    );
  };

  /*****************************************
            Assert Withdraw
   *****************************************/

  const assertWithdraw = async (tx, withdrawAmount, oTokenAmount) => {
    const { curvePool, oToken, strategy, vaultAsset } = context();

    // strategy Withdrawal event for the vault asset
    await expect(tx).to.emit(strategy, "Withdrawal").withNamedArgs({
      _asset: vaultAsset.address,
      _pToken: curvePool.address,
    });
    // .withArgs(vaultAsset.address, curvePool.address, withdrawAmount);

    // strategy Withdrawal event for the OToken
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
  };

  /*****************************************
            Assert Rebalancing
   *****************************************/

  const assertMintOTokens = async (oTokenAmount) => {
    const { curvePool, oToken, strategist, strategy } = context();
    const tx = strategy.connect(strategist).mintAndAddOTokens(oTokenAmount);

    await expect(tx)
      .to.emit(strategy, "Deposit")
      .withArgs(oToken.address, curvePool.address, oTokenAmount);
    // OToken is minted to the the strategy
    await expect(tx)
      .to.emit(oToken, "Transfer")
      .withArgs(addresses.zero, strategy.address, oTokenAmount);
    // OToken is transferred to the Curve pool
    await expect(tx)
      .to.emit(oToken, "Transfer")
      .withArgs(strategy.address, curvePool.address, oTokenAmount);
  };
  const assertRemoveOTokens = async (oTokenAmount) => {
    const { curvePool, oToken, strategist, strategy } = context();

    const tx = await strategy
      .connect(strategist)
      .removeAndBurnOTokens(oTokenAmount);

    await expect(tx)
      .to.emit(strategy, "Withdrawal")
      .withArgs(oToken.address, curvePool.address, oTokenAmount);
    // OToken is removed from the pool to the strategy
    await expect(tx)
      .to.emit(oToken, "Transfer")
      .withArgs(curvePool.address, strategy.address, oTokenAmount);
    // OToken is burned from the strategy
    await expect(tx)
      .to.emit(oToken, "Transfer")
      .withArgs(strategy.address, addresses.zero, oTokenAmount);
  };
  const assertRemoveAssets = async (lpTokens) => {
    const {
      assetDivisor,
      curvePool,
      poolAssetAddress,
      strategist,
      strategy,
      vaultAsset,
    } = context();

    const tx = await strategy.connect(strategist).removeOnlyAssets(lpTokens);

    const vaultAssetDecimals = await vaultAsset.decimals();
    const assetMultiplier = BigNumber.from(10).pow(18 - vaultAssetDecimals);
    // scale down to the asset's decimals
    const assetAmount = lpTokens.div(assetMultiplier).div(assetDivisor);

    // TODO need to loop over all 3 assets (DAI/USDT/USDC) for OUSD AMO
    await expect(tx).to.emit(strategy, "Withdrawal").withNamedArgs({
      _asset: vaultAsset.address,
      _pToken: curvePool.address,
    });

    // TODO Ignore for now if OUSD AMO as assetAmount depends on the 3Pool balances
    const threePoolToken = await ethers.getContract("Mock3CRV");
    if (poolAssetAddress !== threePoolToken.address) {
      const receipt = await tx.wait();
      const WithdrawEvent = receipt.events.find(
        (e) => e.event === "Withdrawal" && e.args[0] === vaultAsset.address
      );
      expect(WithdrawEvent).to.not.be.undefined;
      expect(WithdrawEvent.args[2]).to.eq(assetAmount);

      // Asset token is removed from the pool to the strategy
      // ETH transfer from pool will not emit a Transfer event
      if (poolAssetAddress !== addresses.ETH) {
        await expect(tx)
          .to.emit(vaultAsset, "Transfer")
          .withArgs(curvePool.address, strategy.address, assetAmount);
        // The transfer to the vault can go via another contract. eg WETH or 3Pool
      }
    }
  };

  /*****************************************
          Assert Failed Rebalancing
   *****************************************/

  const assertMintOTokensFail = async (oTokenAmount, errorMsg) => {
    const { strategist, strategy } = context();
    const tx = strategy.connect(strategist).mintAndAddOTokens(oTokenAmount);
    await expect(tx).to.revertedWith(errorMsg);
  };
  const assertRemoveOTokensFail = async (oTokenAmount, errorMsg) => {
    const { strategist, strategy } = context();
    const tx = strategy.connect(strategist).removeAndBurnOTokens(oTokenAmount);
    await expect(tx).to.revertedWith(errorMsg);
  };
  const assertRemoveAssetsFail = async (lpTokens, errorMsg) => {
    const { strategist, strategy } = context();
    const tx = strategy.connect(strategist).removeOnlyAssets(lpTokens);
    await expect(tx).to.revertedWith(errorMsg);
  };

  /*****************************************
              Unit Tests
   *****************************************/

  describe("AMO behaviour", () => {
    const littleOTokens = parseUnits("1");
    const lotOTokens = parseUnits("25");
    const littleLpTokens = littleOTokens;
    const lotLpTokens = lotOTokens;
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
        it("Should deposit vault assets. OTokens == assets", async () => {
          const { strategy, vault, vaultAsset } = context();

          const depositAmountStr = "1000";
          const assetAmount = await units(depositAmountStr, vaultAsset);
          const oTokenAmount = parseUnits(depositAmountStr);

          await fundStrategy(context(), assetAmount);
          const vaultSigner = await impersonateAndFund(vault.address);

          // prettier-ignore
          const tx = await strategy
              .connect(vaultSigner)["deposit(address,uint256)"](vaultAsset.address, assetAmount);

          await assertDeposit(tx, assetAmount, oTokenAmount);
        });
        it("Should deposit vault assets using depositAll. OTokens == assets", async () => {
          const { strategy, vault, vaultAsset } = context();

          const depositAmountStr = "1000";
          const assetAmount = await units(depositAmountStr, vaultAsset);
          const oTokenAmount = parseUnits(depositAmountStr);

          await fundStrategy(context(), assetAmount);
          const vaultSigner = await impersonateAndFund(vault.address);

          const tx = await strategy.connect(vaultSigner).depositAll();

          await assertDeposit(tx, assetAmount, oTokenAmount);
        });
      });
    });
    describe("with assets in the strategy", () => {
      const initialDepositAmount = "800";
      beforeEach(async () => {
        const { strategy, vault } = context();
        await fundStrategy(context(), initialDepositAmount);
        const vaultSigner = await impersonateAndFund(vault.address);
        await strategy.connect(vaultSigner).depositAll();
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
          const { vaultAsset, strategy, vault } = context();

          const depositAmountStr = "1000";
          const assetAmount = await units(depositAmountStr, vaultAsset);
          const oTokenAmount = parseUnits(depositAmountStr);

          const checkBalanceBefore = await strategy.checkBalance(
            vaultAsset.address
          );

          await fundStrategy(context(), assetAmount);
          const vaultSigner = await impersonateAndFund(vault.address);

          const tx = await strategy.connect(vaultSigner).depositAll();

          await assertDeposit(
            tx,
            assetAmount,
            oTokenAmount,
            checkBalanceBefore
          );
        });
        it("Should withdraw vault assets. OTokens == assets", async () => {
          const { vault, vaultAsset, strategy } = context();

          const vaultSigner = await impersonateAndFund(vault.address);
          // TODO remove the -10
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

          await assertWithdraw(tx, withdrawAmount, oTokenAmount);
        });
        it("Should withdraw all assets. OTokens == assets", async () => {
          const { vault, vaultAsset, strategy } = context();

          const vaultSigner = await impersonateAndFund(vault.address);
          const withdrawAmount = await units(initialDepositAmount, vaultAsset);
          const oTokenAmount = parseUnits(initialDepositAmount);

          // prettier-ignore
          const tx = await strategy
            .connect(vaultSigner).withdrawAll();

          await assertWithdraw(tx, withdrawAmount, oTokenAmount);
        });
        it("Should not mint a little OTokens", async () => {
          // diffBefore == 0 and diffAfter < 0
          // diffBefore > diffAfter
          await assertMintOTokensFail(littleOTokens, "OTokens balance worse");
        });
        it("Should not remove a little OTokens", async () => {
          // diffBefore == 0 and diffAfter > 0
          await assertRemoveOTokensFail(littleOTokens, "OTokens overshot peg");
        });
        it("Should not remove a little pool assets", async () => {
          // diffBefore == 0 and diffAfter < 0
          // diffAfter > diffBefore
          await assertRemoveAssetsFail(littleLpTokens, "OTokens balance worse");
        });
        it("Should not allow non-strategist to rebalance", async () => {
          const { strategy, josh, harvester, timelock, governor, vault } =
            context();

          const vaultSigner = await impersonateAndFund(vault.address);
          const harvesterSigner = await impersonateAndFund(harvester.address);

          for (const signer of [
            josh,
            harvesterSigner,
            timelock,
            governor,
            vaultSigner,
          ]) {
            await expect(
              strategy.connect(signer).mintAndAddOTokens(1000)
            ).to.revertedWith("Caller is not the Strategist");
            await expect(
              strategy.connect(signer).removeAndBurnOTokens(1000)
            ).to.revertedWith("Caller is not the Strategist");
            await expect(
              strategy.connect(signer).removeOnlyAssets(1000)
            ).to.revertedWith("Caller is not the Strategist");
          }
        });
      });
      describe("with a little more OTokens in the pool", () => {
        beforeEach(async () => {
          // Add 1/5 of the liquidity not owned by the strategy
          await curveAddLiquidity({
            ...context(),
            poolAssetAmount: "200",
            oTokenAmount: "220",
          });
        });
        it("Should deposit vault assets. OTokens == assets", async () => {
          const { curvePool, vaultAsset, oToken, strategy, vault } = context();
          const depositAmountStr = "1000";
          const depositAmount = await units(depositAmountStr, vaultAsset);
          const oTokenAmount = parseUnits(depositAmountStr);

          await fundStrategy(context(), depositAmount);
          const vaultSigner = await impersonateAndFund(vault.address);
          const tx = await strategy.connect(vaultSigner).depositAll();

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
            oTokenAmount.add(littleOTokens)
          );
          expect(oTokenWithdrawEvent.args[2]).to.lt(oTokenAmount.mul(2));
        });
        it("Should not mint a little OTokens", async () => {
          // diffBefore < 0 and diffBefore > diffAfter
          await assertMintOTokensFail(littleOTokens, "OTokens balance worse");
        });
        it("Should remove a little OTokens", async () => {
          // diffBefore < 0 and diffBefore < diffAfter < 0
          await assertRemoveOTokens(littleOTokens);
        });
        it("Should not remove a lot of OTokens", async () => {
          // diffBefore < 0 and diffBefore < diffAfter and diffAfter > 0
          await assertRemoveOTokensFail(lotOTokens, "OTokens overshot peg");
        });
        it("Should not remove a little pool assets", async () => {
          // diffBefore < 0, diffAfter < 0 and diffAfter > diffBefore
          // diffAfter > diffBefore
          await assertRemoveAssetsFail(littleLpTokens, "OTokens balance worse");
        });
      });
      describe("with a lot more OTokens in the pool", () => {
        beforeEach(async () => {
          await curveAddLiquidity({
            ...context(),
            poolAssetAmount: "0",
            oTokenAmount: "900",
          });
        });
        it("Should deposit vault assets. OTokens == assets", async () => {
          const { vaultAsset, strategy, vault } = context();

          const checkBalanceBefore = await strategy.checkBalance(
            vaultAsset.address
          );

          const depositAmountStr = "300";
          const assetAmount = await units(depositAmountStr, vaultAsset);
          let oTokenAmount = parseUnits(depositAmountStr);

          await fundStrategy(context(), assetAmount);
          const vaultSigner = await impersonateAndFund(vault.address);

          const tx = await strategy.connect(vaultSigner).depositAll();

          await assertDeposit(
            tx,
            assetAmount,
            oTokenAmount,
            checkBalanceBefore
          );
        });
        // TODO fix for OUSD AMO
        it.skip("Should withdraw vault assets. OTokens > assets", async () => {
          const { vault, vaultAsset, strategy } = context();

          const vaultSigner = await impersonateAndFund(vault.address);
          const { assetAmount, oTokenAmount } = await calcWithdrawAmounts(
            context()
          );
          const assetAmountAdjusted = assetAmount.sub(10);
          const oTokenAmountAdjusted = oTokenAmount.sub(10);

          // prettier-ignore
          const tx = await strategy
            .connect(vaultSigner)["withdraw(address,address,uint256)"](
              vault.address,
              vaultAsset.address,
              assetAmountAdjusted
            );

          await assertWithdraw(tx, assetAmountAdjusted, oTokenAmountAdjusted);
        });
        it("Should withdraw all assets. OTokens > assets", async () => {
          const { vault, strategy } = context();

          const vaultSigner = await impersonateAndFund(vault.address);
          const { assetAmount, oTokenAmount } = await calcWithdrawAmounts(
            context()
          );

          const tx = await strategy.connect(vaultSigner).withdrawAll();

          await assertWithdraw(tx, assetAmount, oTokenAmount);
        });
      });
      describe("with a little more pool assets in the pool", () => {
        beforeEach(async () => {
          await curveAddLiquidity({
            ...context(),
            poolAssetAmount: "210",
            oTokenAmount: "200",
          });
        });
        it("Should deposit vault assets. OTokens > assets", async () => {
          const { assetIndex, curvePool, vaultAsset, strategy, vault } =
            context();

          const checkBalanceBefore = await strategy.checkBalance(
            vaultAsset.address
          );

          const depositAmountStr = "300";
          const assetAmount = await units(depositAmountStr, vaultAsset);
          const balances = await curvePool.get_balances();
          let oTokenAmount = calcOTokensMinted(
            depositAmountStr,
            balances,
            assetIndex
          );

          await fundStrategy(context(), assetAmount);
          const vaultSigner = await impersonateAndFund(vault.address);

          const tx = await strategy.connect(vaultSigner).depositAll();

          await assertDeposit(
            tx,
            assetAmount,
            oTokenAmount,
            checkBalanceBefore
          );
        });
        // Should withdraw remove assets. OTokens < assets
        it("Should mint a little OTokens", async () => {
          // diffBefore > 0, diffBefore > diffAfter > 0
          await assertMintOTokens(littleOTokens);
        });
        it("Should not mint a lot of OTokens", async () => {
          // diffBefore > 0, diffBefore > diffAfter < 0
          await assertMintOTokensFail(lotOTokens, "Assets overshot peg");
        });
        it("Should not remove a little OTokens", async () => {
          // diffBefore > 0 and diffAfter > diffBefore
          await assertRemoveOTokensFail(littleOTokens, "Assets balance worse");
        });
        it("Should remove a little pool assets", async () => {
          // diffBefore > 0 and diffAfter < diffBefore
          await assertRemoveAssets(littleLpTokens);
        });
        it("Should not remove a lot pool assets", async () => {
          // diffBefore > 0 and diffAfter < 0
          await assertRemoveAssetsFail(lotLpTokens, "Assets overshot peg");
        });
      });
      describe("with a lot more pool assets in the pool", () => {
        beforeEach(async () => {
          await curveAddLiquidity({
            ...context(),
            poolAssetAmount: "700",
            oTokenAmount: "0",
          });
        });
        it("Should deposit vault assets. OTokens == 2x assets", async () => {
          const { vaultAsset, strategy, vault } = context();

          const checkBalanceBefore = await strategy.checkBalance(
            vaultAsset.address
          );

          const depositAmountStr = "300";
          const assetAmount = await units(depositAmountStr, vaultAsset);
          // Max OTokens minted is 2x the deposit amount
          let oTokenAmount = parseUnits(depositAmountStr).mul(2);

          await fundStrategy(context(), assetAmount);
          const vaultSigner = await impersonateAndFund(vault.address);

          const tx = await strategy.connect(vaultSigner).depositAll();

          await assertDeposit(
            tx,
            assetAmount,
            oTokenAmount,
            checkBalanceBefore
          );
        });
        // TODO fix for OUSD AMO
        it.skip("Should withdraw vault assets. OTokens < assets", async () => {
          const { vault, vaultAsset, strategy } = context();

          const vaultSigner = await impersonateAndFund(vault.address);

          const { assetAmount, oTokenAmount } = await calcWithdrawAmounts(
            context()
          );
          const assetAmountAdjusted = assetAmount.sub(20);
          const oTokenAmountAdjusted = oTokenAmount.sub(20);

          // prettier-ignore
          const tx = await strategy
            .connect(vaultSigner)["withdraw(address,address,uint256)"](
              vault.address,
              vaultAsset.address,
              assetAmountAdjusted
            );

          await assertWithdraw(tx, assetAmountAdjusted, oTokenAmountAdjusted);
        });
        it("Should withdraw all assets. OTokens < assets", async () => {
          const { vault, strategy } = context();

          const vaultSigner = await impersonateAndFund(vault.address);
          const { assetAmount, oTokenAmount } = await calcWithdrawAmounts(
            context()
          );

          const tx = await strategy.connect(vaultSigner).withdrawAll();

          await assertWithdraw(tx, assetAmount, oTokenAmount);
        });
      });
    });
  });
};

const fundStrategy = async (fixture, amount = "1000") => {
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
    // Note for 3Crv this will not increase the total supply of the 3Pool
    await poolAsset.connect(josh).mint(parseUnits(poolAssetAmount ?? "0"));
    // Approve the Curve pool to transfer the pool assets
    await poolAsset.connect(josh).approve(curvePool.address, MAX_UINT256);
  }

  // Give Josh some OTokens by minting them
  if (oTokenAmount && oTokenAmount !== "0") {
    const mintAmount = await units(oTokenAmount ?? "0", vaultAsset);
    await vaultAsset.connect(josh).mint(mintAmount);
    await vaultAsset.connect(josh).approve(vault.address, MAX_UINT256);
    await vault.connect(josh).mint(vaultAsset.address, mintAmount, 0);
    // Approve the Curve pool to transfer OTokens
    await oToken.connect(josh).approve(curvePool.address, MAX_UINT256);
  }

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

const calcOTokensMinted = (depositAmountStr, balances, assetIndex) => {
  let oTokenAmount = parseUnits(depositAmountStr);

  const assetBalance = balances[assetIndex];
  const oTokenBalance = balances[(assetIndex + 1) % 2];
  const balanceDiff = assetBalance.sub(oTokenBalance);

  // If more assets than OTokens
  if (balanceDiff.gt(0)) {
    oTokenAmount = balanceDiff.gt(oTokenAmount.mul(2))
      ? oTokenAmount.mul(2)
      : oTokenAmount.add(balanceDiff);
  }

  return oTokenAmount;
};

const calcWithdrawAmounts = async (fixture) => {
  const { curvePool, convexPID, strategy, assetIndex } = fixture;

  // get balances from the Curve pool
  const balances = await curvePool.get_balances();
  const totalLpSupply = await curvePool.totalSupply();

  // get the strategy's Curve LP tokens from Convex pool
  // Get the Convex rewards pool contract
  const mockBooster = await ethers.getContract("MockBooster");
  const poolInfo = await mockBooster.poolInfo(convexPID);
  const convexRewardPool = await ethers.getContractAt(
    "MockRewardPool",
    poolInfo.crvRewards
  );
  const strategyLpTokens = await convexRewardPool.balanceOf(strategy.address);

  const withdrawBalances = balances.map((bal) =>
    bal.mul(strategyLpTokens).div(totalLpSupply)
  );

  const assetAmount = withdrawBalances[assetIndex];
  const oTokenAmount = withdrawBalances[(assetIndex + 1) % 2];

  return {
    assetAmount,
    oTokenAmount,
  };
};

module.exports = {
  shouldBehaveLikeAmo,
};
