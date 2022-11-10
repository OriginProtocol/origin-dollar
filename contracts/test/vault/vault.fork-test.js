const { expect } = require("chai");

const { defaultFixture } = require("./../_fixture");
const { utils } = require("ethers");

const {
  loadFixture,
  forkOnlyDescribe,
  ousdUnits,
  usdtUnits,
  usdcUnits,
  daiUnits,
} = require("./../helpers");

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
  // due to hardhat forked mode timeouts - retry failed tests up to 3 times
  this.retries(3);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture(defaultFixture);
  });

  describe("Admin", () => {
    it("Should have the correct governor address set", async () => {
      const { vault } = fixture;
      expect(await vault.governor()).to.equal(
        "0x72426BA137DEC62657306b12B1E869d43FeC6eC7"
      );
    });

    it("Should have the correct strategist address set", async () => {
      const { vault } = fixture;
      expect(await vault.strategistAddr()).to.equal(
        "0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC"
      );
    });

    it("Should have the correct turstee address set", async () => {
      const { vault } = fixture;
      // This fails locally for now, since
      // BuyBack contract is yet to be deployed
      expect(await vault.strategistAddr()).to.equal(
        "0xF14BBdf064E3F67f51cd9BD646aE3716aD938FDC"
      );
    });

    it("Should have the correct OUSD MetaStrategy address set", async () => {
      const { vault } = fixture;
      expect(await vault.ousdMetaStrategy()).to.equal(
        "0x89Eb88fEdc50FC77ae8a18aAD1cA0ac27f777a90"
      );
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

    it("Should have vault buffer disabled", async () => {
      const { vault } = fixture;
      expect(await vault.vaultBuffer()).to.equal("0");
    });
  });

  describe("Oracle", () => {
    it("Should have correct Price Oracle address set", async () => {
      const { vault } = fixture;
      expect(await vault.priceProvider()).to.equal(
        "0x7533365d1b0D95380bc4e94D0bdEF5173E43f954"
      );
    });

    it("Should return a price for minting with USDT", async () => {
      const { vault, usdt } = fixture;
      await vault.priceUSDMint(usdt.address);
    });

    it("Should return a price for minting with DAI", async () => {
      const { vault, dai } = fixture;
      await vault.priceUSDMint(dai.address);
    });

    it("Should return a price for minting with USDC", async () => {
      const { vault, usdc } = fixture;
      await vault.priceUSDMint(usdc.address);
    });

    it("Should return a price for redeem with USDT", async () => {
      const { vault, usdt } = fixture;
      const price = await vault.priceUSDRedeem(usdt.address);
      expect(price).to.be.gte(utils.parseEther("1"));
    });

    it("Should return a price for redeem with DAI", async () => {
      const { vault, dai } = fixture;
      const price = await vault.priceUSDRedeem(dai.address);
      expect(price).to.be.gte(utils.parseEther("1"));
    });

    it("Should return a price for redeem with USDC", async () => {
      const { vault, usdc } = fixture;
      const price = await vault.priceUSDRedeem(usdc.address);
      expect(price).to.be.gte(utils.parseEther("1"));
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
        // TODO: Update this every time a new strategy is added
        "0x9c459eeb3FA179a40329b81C1635525e9A0Ef094", // Compound
        "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259", // Aave
        "0xEA2Ef2e2E5A749D4A66b41Db9aD85a38Aa264cb3", // Convex
        "0x89Eb88fEdc50FC77ae8a18aAD1cA0ac27f777a90", // OUSD MetaStrategy
        // TODO: Hardcode these after deploy
        "0x4258a6E32Eb33Eed64c3caefe6bcCf53141518dE", // alUSD MetaStrategy
        "0x617F960A19f0f4d560256E04B5F4B92E187C512D", // mUSD MetaStrategy
        "0xB262b69d1dB3dc092C73384B8553DA3d00e93682", // USDD MetaStrategy
        "0xD2001BaF4E726dAfd6589D5c7bf8C74d59E48438", // BUSD MetaStrategy
        "0x885a4D0b5070faB2C8F58B86fD196974cDe4feCd", // Morpho MetaStrategy
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
      ]).to.include(await vault.assetDefaultStrategies(usdt.address));
    });

    it("Should have correct default strategy set for USDC", async () => {
      const { vault, usdc } = fixture;

      // aave and compound
      expect([
        "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259",
        "0x9c459eeb3FA179a40329b81C1635525e9A0Ef094",
      ]).to.include(await vault.assetDefaultStrategies(usdc.address));
    });

    it("Should have correct default strategy set for DAI", async () => {
      const { vault, dai } = fixture;

      // aave and compound
      expect([
        "0x5e3646A1Db86993f73E6b74A57D8640B69F7e259",
        "0x9c459eeb3FA179a40329b81C1635525e9A0Ef094",
      ]).to.include(await vault.assetDefaultStrategies(dai.address));
    });

    it("Should be able to withdraw from all strategies", async () => {
      const { vault, governor } = fixture;
      await vault.connect(governor).withdrawAllFromStrategies();
    });
  });
});
