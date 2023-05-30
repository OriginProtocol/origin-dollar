const { expect } = require("chai");

const { defaultFixture } = require("./../_fixture");
const addresses = require("../../utils/addresses");
const { recodeSwapData } = require("../../utils/1Inch");
const { loadFixture, forkOnlyDescribe } = require("./../helpers");
const { parseUnits } = require("ethers/lib/utils");

forkOnlyDescribe("ForkTest: Vault", function () {
  this.timeout(0);
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

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
    describe("Collateral swaps", () => {
      it("should be able to swap WETH for rETH", async () => {
        const { oethVault, reth, weth, strategist } = fixture;
        const fromAmount = parseUnits("100", 18);
        const minToAssetAmount = "92280577666624314114"; // parseUnits("99", 18);
        const apiEncodedData =
          "0x12aa3caf0000000000000000000000001136b25047e142fa3018184793aec68fbb173ce4000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000ae78736cd615f374d3085123a210448e74fc63930000000000000000000000001136b25047e142fa3018184793aec68fbb173ce400000000000000000000000039254033945aa2e4809cc2977e7087bee48bd7ab0000000000000000000000000000000000000000000000056bc75e2d6310000000000000000000000000000000000000000000000000000500a67876defcdb02000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000bc00000000000000000000000000000000000000009e00007000005600003c4101c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200042e1a7d4d000000000000000000000000000000000000000000000000000000000000000040e0dd3f50f8a6cafbe9b31a427582963f465e745af8d0e30db00020d6bdbf78ae78736cd615f374d3085123a210448e74fc639380a06c4eca27ae78736cd615f374d3085123a210448e74fc63931111111254eeb25477b68fb85ed929f73a96058200000000cfee7c08";
        const swapData = recodeSwapData(apiEncodedData);

        const tx = await oethVault
          .connect(strategist)
          .swapCollateral(
            weth.address,
            reth.address,
            fromAmount,
            minToAssetAmount,
            swapData
          );
        expect(tx).to.emit(oethVault, "Swapped");
        expect(tx).to.emit(weth, "Transfer");
      });
      it("should be able to swap WETH for stETH", async () => {
        const { oethVault, stETH, weth, strategist } = fixture;
        const fromAmount = parseUnits("100", 18);
        const minToAssetAmount = parseUnits("90", 18);
        const apiEncodedData =
          "0x12aa3caf0000000000000000000000001136b25047e142fa3018184793aec68fbb173ce4000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000ae7ab96520de3a18e5e111b5eaab095312d7fe840000000000000000000000001136b25047e142fa3018184793aec68fbb173ce400000000000000000000000039254033945aa2e4809cc2977e7087bee48bd7ab0000000000000000000000000000000000000000000000056bc75e2d631000000000000000000000000000000000000000000000000000055e1c867fd240a6950000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000013e0000000000000000000000000000000000000001200000f20000d800003c4101c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200042e1a7d4d00000000000000000000000000000000000000000000000000000000000000004160dc24316b9ae028f1497c275eb9192a3ea0f6702200443df021240000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000055e1c867fd240a6950020d6bdbf78ae7ab96520de3a18e5e111b5eaab095312d7fe8480a06c4eca27ae7ab96520de3a18e5e111b5eaab095312d7fe841111111254eeb25477b68fb85ed929f73a9605820000cfee7c08";
        const swapData = recodeSwapData(apiEncodedData);

        await oethVault
          .connect(strategist)
          .swapCollateral(
            weth.address,
            stETH.address,
            fromAmount,
            minToAssetAmount,
            swapData
          );
      });
      it("should be able to swap WETH for frxETH", async () => {
        const { oethVault, frxETH, weth, strategist } = fixture;
        const fromAmount = parseUnits("100", 18);
        const minToAssetAmount = parseUnits("90", 18);
        const apiEncodedData =
          "0x12aa3caf0000000000000000000000001136b25047e142fa3018184793aec68fbb173ce4000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20000000000000000000000005e8422345238f34275888049021821e8e08caa1f0000000000000000000000001136b25047e142fa3018184793aec68fbb173ce400000000000000000000000039254033945aa2e4809cc2977e7087bee48bd7ab0000000000000000000000000000000000000000000000056bc75e2d631000000000000000000000000000000000000000000000000000055e44d47e9cace9530000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000013e0000000000000000000000000000000000000001200000f20000d800003c4101c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200042e1a7d4d00000000000000000000000000000000000000000000000000000000000000004160a1f8a6807c402e4a15ef4eba36528a3fed24e57700443df021240000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000055e44d47e9cace9530020d6bdbf785e8422345238f34275888049021821e8e08caa1f80a06c4eca275e8422345238f34275888049021821e8e08caa1f1111111254eeb25477b68fb85ed929f73a9605820000cfee7c08";
        const swapData = recodeSwapData(apiEncodedData);

        await oethVault
          .connect(strategist)
          .swapCollateral(
            weth.address,
            frxETH.address,
            fromAmount,
            minToAssetAmount,
            swapData
          );
      });
    });
  });
});
