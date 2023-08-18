const { expect } = require("chai");
const { utils } = require("ethers");

const addresses = require("../../utils/addresses");
const {
  loadDefaultFixture,
  impersonateAndFundContract,
} = require("./../_fixture");
const {
  forkOnlyDescribe,
  ousdUnits,
  usdtUnits,
  usdcUnits,
  daiUnits,
  differenceInStrategyBalance,
  differenceInErc20TokenBalances,
  isCI,
} = require("./../helpers");

const log = require("../../utils/logger")("test:fork:ousd:vault");

/**
 * Regarding hardcoded addresses:
 * The addresses are hardcoded in the test files (instead of
 * using them from addresses.js) intentionally. While importing and
 * using the variables from that file increases readability, it may
 * result in it being a single point of failure. Anyone can update
 * the addresses.js file and it may go unnoticed.
 *
 * Points against this: The on-chain data would still be correct,
 * making the tests to fail in case only addresses.js is updated.
 *
 * Still open to discussion.
 */

forkOnlyDescribe("ForkTest: Vault", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe("Admin", () => {
    it("Should have the correct governor address set", async () => {
      const { vault } = fixture;
      expect(await vault.governor()).to.equal(addresses.mainnet.Timelock);
    });

    it("Should have the correct strategist address set", async () => {
      const { strategist, vault } = fixture;
      expect(await vault.strategistAddr()).to.equal(
        await strategist.getAddress()
      );
    });

    it("Should have the correct OUSD MetaStrategy address set", async () => {
      const { vault } = fixture;
      expect(await vault.ousdMetaStrategy()).to.equal(
        addresses.mainnet.ConvexOUSDAMOStrategy
      );
    });

    it("Should have supported assets", async () => {
      const { vault } = fixture;
      const assets = await vault.getAllAssets();
      expect(assets).to.have.length(3);
      expect(assets).to.include(addresses.mainnet.USDT);
      expect(assets).to.include(addresses.mainnet.USDC);
      expect(assets).to.include(addresses.mainnet.DAI);

      expect(await vault.isSupportedAsset(addresses.mainnet.USDT)).to.be.true;
      expect(await vault.isSupportedAsset(addresses.mainnet.DAI)).to.be.true;
      expect(await vault.isSupportedAsset(addresses.mainnet.USDT)).to.be.true;
    });
  });

  describe("Rebase", () => {
    it(`Shouldn't be paused`, async () => {
      const { vault } = fixture;
      expect(await vault.rebasePaused()).to.be.false;
    });

    it(`Should rebase`, async () => {
      const { vault } = fixture;
      await vault.rebase();
    });
  });

  describe("Capital", () => {
    it(`Shouldn't be paused`, async () => {
      const { vault } = fixture;
      expect(await vault.capitalPaused()).to.be.false;
    });

    it("Should allow to mint and redeem w/ USDT", async () => {
      const { ousd, vault, josh, usdt } = fixture;
      const balancePreMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      await vault.connect(josh).mint(usdt.address, usdtUnits("50000"), 0);

      const balancePostMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());

      const balanceDiff = balancePostMint.sub(balancePreMint);
      expect(balanceDiff).to.approxEqualTolerance(ousdUnits("50000"), 1);

      await vault.connect(josh).redeem(balanceDiff, 0);

      const balancePostRedeem = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      expect(balancePreMint).to.approxEqualTolerance(balancePostRedeem, 1);
    });

    it("Should allow to mint and redeem w/ USDC", async () => {
      const { ousd, vault, josh, usdc } = fixture;
      const balancePreMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      await vault.connect(josh).mint(usdc.address, usdcUnits("50000"), 0);

      const balancePostMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());

      const balanceDiff = balancePostMint.sub(balancePreMint);
      expect(balanceDiff).to.approxEqualTolerance(ousdUnits("50000"), 1);

      await vault.connect(josh).redeem(balanceDiff, 0);

      const balancePostRedeem = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      expect(balancePreMint).to.approxEqualTolerance(balancePostRedeem, 1);
    });

    it("Should allow to mint and redeem w/ DAI", async () => {
      const { ousd, vault, josh, dai } = fixture;
      const balancePreMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      await vault.connect(josh).mint(dai.address, daiUnits("50000"), 0);

      const balancePostMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());

      const balanceDiff = balancePostMint.sub(balancePreMint);
      expect(balanceDiff).to.approxEqualTolerance(ousdUnits("50000"), 1);

      await vault.connect(josh).redeem(balanceDiff, 0);

      const balancePostRedeem = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      expect(balancePreMint).to.approxEqualTolerance(balancePostRedeem, 1);
    });

    it("should withdraw from and deposit to strategy", async () => {
      const { vault, josh, usdc, dai, compoundStrategy } = fixture;
      await vault.connect(josh).mint(usdc.address, usdcUnits("90"), 0);
      await vault.connect(josh).mint(dai.address, daiUnits("50"), 0);
      const strategistSigner = await impersonateAndFundContract(
        await vault.strategistAddr()
      );

      let daiBalanceDiff, usdcBalanceDiff, daiStratDiff, usdcStratDiff;

      [daiBalanceDiff, usdcBalanceDiff] = await differenceInErc20TokenBalances(
        [vault.address, vault.address],
        [dai, usdc],
        async () => {
          [daiStratDiff, usdcStratDiff] = await differenceInStrategyBalance(
            [dai.address, usdc.address],
            [compoundStrategy, compoundStrategy],
            async () => {
              await vault
                .connect(strategistSigner)
                .depositToStrategy(
                  compoundStrategy.address,
                  [dai.address, usdc.address],
                  [daiUnits("50"), usdcUnits("90")]
                );
            }
          );
        }
      );

      expect(daiBalanceDiff).to.equal(daiUnits("-50"));
      expect(usdcBalanceDiff).to.approxEqualTolerance(usdcUnits("-90"), 1);

      expect(daiStratDiff).gte(daiUnits("49.95"));
      expect(usdcStratDiff).gte(usdcUnits("89.91"));

      [daiBalanceDiff, usdcBalanceDiff] = await differenceInErc20TokenBalances(
        [vault.address, vault.address],
        [dai, usdc],
        async () => {
          [daiStratDiff, usdcStratDiff] = await differenceInStrategyBalance(
            [dai.address, usdc.address],
            [compoundStrategy, compoundStrategy],
            async () => {
              await vault
                .connect(strategistSigner)
                .withdrawFromStrategy(
                  compoundStrategy.address,
                  [dai.address, usdc.address],
                  [daiUnits("50"), usdcUnits("90")]
                );
            }
          );
        }
      );

      expect(daiBalanceDiff).to.approxEqualTolerance(daiUnits("50"), 1);
      expect(usdcBalanceDiff).to.approxEqualTolerance(usdcUnits("90"), 1);

      expect(daiStratDiff).approxEqualTolerance(daiUnits("-50"));
      expect(usdcStratDiff).approxEqualTolerance(usdcUnits("-90"));
    });

    it("Should have vault buffer disabled", async () => {
      const { vault } = fixture;
      expect(await vault.vaultBuffer()).to.equal("0");
    });
  });

  describe("Oracle", () => {
    /* NOTICE: update once the address is the updated on the mainnet.
     * the fork tests require the 052 deploy to run in order to be
     * compatible with the latest codebase -> which is not yet deployed to
     * OUSD mainnet.
     */
    it("Should have correct Price Oracle address set", async () => {
      const { vault } = fixture;
      expect(await vault.priceProvider()).to.equal(
        "0xe7fD05515A51509Ca373a42E81ae63A40AA4384b"
      );
    });

    it("Should return a price for minting with USDT", async () => {
      const { vault, usdt } = fixture;
      const price = await vault.priceUnitMint(usdt.address);

      log(`Price for minting with USDT: ${utils.formatEther(price, 6)}`);

      expect(price).to.be.lte(utils.parseEther("1"));
      expect(price).to.be.gt(utils.parseEther("0.998"));
    });

    it("Should return a price for minting with DAI", async () => {
      const { vault, dai } = fixture;
      const price = await vault.priceUnitMint(dai.address);

      log(`Price for minting with DAI: ${utils.formatEther(price, 18)}`);

      expect(price).to.be.lte(utils.parseEther("1"));
      expect(price).to.be.gt(utils.parseEther("0.999"));
    });

    it("Should return a price for minting with USDC", async () => {
      const { vault, usdc } = fixture;
      const price = await vault.priceUnitMint(usdc.address);

      log(`Price for minting with USDC: ${utils.formatEther(price, 6)}`);

      expect(price).to.be.lte(utils.parseEther("1"));
      expect(price).to.be.gt(utils.parseEther("0.999"));
    });

    it("Should return a price for redeem with USDT", async () => {
      const { vault, usdt } = fixture;
      const price = await vault.priceUnitRedeem(usdt.address);

      log(`Price for redeeming with USDT: ${utils.formatEther(price, 6)}`);

      expect(price).to.be.gte(utils.parseEther("1"));
      expect(price).to.be.lt(utils.parseEther("1.001"));
    });

    it("Should return a price for redeem with DAI", async () => {
      const { vault, dai } = fixture;
      const price = await vault.priceUnitRedeem(dai.address);

      log(`Price for redeeming with DAI: ${utils.formatEther(price, 18)}`);

      expect(price).to.be.gte(utils.parseEther("1"));
      expect(price).to.be.lt(utils.parseEther("1.001"));
    });

    it("Should return a price for redeem with USDC", async () => {
      const { vault, usdc } = fixture;
      const price = await vault.priceUnitRedeem(usdc.address);

      log(`Price for redeeming with USDC: ${utils.formatEther(price, 6)}`);

      expect(price).to.be.gte(utils.parseEther("1"));
      expect(price).to.be.lt(utils.parseEther("1.001"));
    });
  });

  describe("Assets & Strategies", () => {
    it("Should NOT have any unknown assets", async () => {
      const { vault } = fixture;
      const assets = await vault.getAllAssets();

      const knownAssets = [
        // TODO: Update this every time a new asset is supported
        "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
        "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
      ];

      for (const a of assets) {
        expect(knownAssets).to.include(a, `Unknown asset: ${a}`);
      }

      for (const a of knownAssets) {
        expect(assets).to.include(a, `Known asset missing from contract: ${a}`);
      }
    });

    it("Should NOT have any unknown strategies", async () => {
      const { vault } = fixture;
      const strategies = await vault.getAllStrategies();

      const knownStrategies = [
        // Update this every time a new strategy is added. Below are mainnet addresses
        "0x9c459eeb3FA179a40329b81C1635525e9A0Ef094", // Compound
        "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259", // Aave
        "0xEA2Ef2e2E5A749D4A66b41Db9aD85a38Aa264cb3", // Convex
        "0x89Eb88fEdc50FC77ae8a18aAD1cA0ac27f777a90", // OUSD MetaStrategy
        "0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D", // MorphoCompoundStrategy
        "0x7A192DD9Cc4Ea9bdEdeC9992df74F1DA55e60a19", // LUSD MetaStrategy
        "0x79F2188EF9350A1dC11A062cca0abE90684b0197", // MorphoAaveStrategy
        "0x76Bf500B6305Dc4ea851384D3d5502f1C7a0ED44", // Flux Strategy
        "0x6b69B755C629590eD59618A2712d8a2957CA98FC", // Maker DSR Strategy
      ];

      for (const s of strategies) {
        expect(knownStrategies).to.include(
          s,
          `Unknown strategy with address: ${s}`
        );
      }

      for (const s of knownStrategies) {
        expect(strategies).to.include(
          s,
          `Known strategy missing from contract: ${s}`
        );
      }
    });

    it("Should have correct default strategy set for USDT", async () => {
      const { vault, usdt } = fixture;

      // aave and compound
      expect([
        "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259",
        "0x9c459eeb3FA179a40329b81C1635525e9A0Ef094",
        "0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D", // Morpho
        "0x79F2188EF9350A1dC11A062cca0abE90684b0197", // MorphoAave
      ]).to.include(await vault.assetDefaultStrategies(usdt.address));
    });

    it("Should have correct default strategy set for USDC", async () => {
      const { vault, usdc } = fixture;

      // aave and compound
      expect([
        "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259",
        "0x9c459eeb3FA179a40329b81C1635525e9A0Ef094",
        "0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D", // Morpho
        "0x79F2188EF9350A1dC11A062cca0abE90684b0197", // MorphoAave
      ]).to.include(await vault.assetDefaultStrategies(usdc.address));
    });

    it("Should have correct default strategy set for DAI", async () => {
      const { vault, dai } = fixture;

      // aave and compound
      expect([
        "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259",
        "0x9c459eeb3FA179a40329b81C1635525e9A0Ef094",
        "0x5A4eEe58744D1430876d5cA93cAB5CcB763C037D", // Morpho
        "0x79F2188EF9350A1dC11A062cca0abE90684b0197", // MorphoAave
      ]).to.include(await vault.assetDefaultStrategies(dai.address));
    });

    it("Should be able to withdraw from all strategies", async () => {
      const { vault, timelock } = fixture;
      await vault.connect(timelock).withdrawAllFromStrategies();
    });
  });
});
