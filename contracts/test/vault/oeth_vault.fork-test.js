const { expect } = require("chai");

const { defaultFixture } = require("./../_fixture");
const addresses = require("../../utils/addresses");
const { getIInchSwapData, recodeSwapData } = require("../../utils/1Inch");
const { loadFixture, forkOnlyDescribe } = require("./../helpers");
const { parseUnits } = require("ethers/lib/utils");

forkOnlyDescribe("ForkTest: OETH Vault", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  // this.retries(3);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture(defaultFixture);
  });

  describe("OETH Vault", () => {
    describe("post deployment", () => {
      it("Should have the correct governor address set", async () => {
        const {
          oethVault,
          oethDripper,
          ConvexEthMetaStrategy,
          fraxEthStrategy,
          oeth,
          woeth,
          oethHarvester,
        } = fixture;

        const oethContracts = [
          oethVault,
          oethDripper,
          ConvexEthMetaStrategy,
          fraxEthStrategy,
          oeth,
          woeth,
          oethHarvester,
        ];

        for (let i = 0; i < oethContracts.length; i++) {
          expect(await oethContracts[i].governor()).to.equal(
            addresses.mainnet.OldTimelock
          );
        }
      });
      it("shold have swapper set", async () => {
        const { oethVault, swapper } = fixture;

        expect(await oethVault.swapper()).to.equal(swapper.address);
      });
      it("assets should have allowed slippage", async () => {
        const { oethVault, weth, reth, stETH, frxETH } = fixture;

        const assets = [weth, stETH, reth, frxETH];
        const expectedConversions = [0, 0, 1, 0];
        const expectedSlippage = [20, 70, 200, 20];

        for (let i = 0; i < assets.length; i++) {
          const config = await oethVault.getAssetConfig(assets[i].address);

          expect(config.decimals, `decimals ${i}`).to.equal(18);
          expect(config.isSupported, `isSupported ${i}`).to.be.true;
          expect(config.unitConversion, `unitConversion ${i}`).to.be.equal(
            expectedConversions[i]
          );
          expect(
            config.allowedSwapSlippageBps,
            `allowedSwapSlippageBps ${i}`
          ).to.equal(expectedSlippage[i]);
        }
      });
    });
    const assertSwap = async (
      fromAsset,
      toAsset,
      fromAmount,
      minToAssetAmount,
      slippage
    ) => {
      const { oethVault, strategist, swapper } = fixture;

      const apiEncodedData = await getIInchSwapData({
        vault: oethVault,
        fromAsset,
        toAsset,
        fromAmount,
        slippage,
      });

      // re-encode the 1Inch tx.data from their swap API to the executer data
      const swapData = await recodeSwapData(apiEncodedData);

      const fromBalanceBefore = await fromAsset.balanceOf(oethVault.address);
      const toBalanceBefore = await toAsset.balanceOf(oethVault.address);

      const tx = await oethVault
        .connect(strategist)
        .swapCollateral(
          fromAsset.address,
          toAsset.address,
          fromAmount,
          minToAssetAmount,
          swapData
        );

      // Asset events
      expect(tx).to.emit(oethVault, "Swapped").withNamedArgs({
        _fromAsset: fromAsset.address,
        _toAsset: toAsset.address,
        _fromAssetAmount: fromAmount,
      });
      expect(tx)
        .to.emit(fromAsset, "Transfer")
        .withArgs(oethVault.address, swapper.address, fromAmount);

      // Asset balances
      const fromBalanceAfter = await fromAsset.balanceOf(oethVault.address);
      expect(fromBalanceBefore.sub(fromBalanceAfter), "from asset bal").to.eq(
        fromAmount
      );
      const toBalanceAfter = await toAsset.balanceOf(oethVault.address);
      expect(toBalanceAfter.sub(toBalanceBefore), "to asset bal").to.gt(
        minToAssetAmount
      );
    };
    describe("Collateral swaps", () => {
      it("should be able to swap WETH for rETH", async () => {
        const { reth, weth } = fixture;
        const fromAmount = parseUnits("100", 18);
        const minToAssetAmount = "92280577666624314114"; // parseUnits("99", 18);
        await assertSwap(weth, reth, fromAmount, minToAssetAmount);
      });
      it("should be able to swap WETH for stETH", async () => {
        const { stETH, weth } = fixture;
        const fromAmount = parseUnits("100", 18);
        const minToAssetAmount = parseUnits("90", 18);

        await assertSwap(weth, stETH, fromAmount, minToAssetAmount);
      });
      it("should be able to swap WETH for frxETH", async () => {
        const { frxETH, weth } = fixture;
        const fromAmount = parseUnits("100", 18);
        const minToAssetAmount = parseUnits("90", 18);

        await assertSwap(weth, frxETH, fromAmount, minToAssetAmount);
      });
    });
  });
});
