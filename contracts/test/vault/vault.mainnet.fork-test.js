const { expect } = require("chai");

const addresses = require("../../utils/addresses");
const { loadDefaultFixture } = require("./../_fixture");
const {
  ousdUnits,
  usdcUnits,
  differenceInStrategyBalance,
  differenceInErc20TokenBalances,
  isCI,
} = require("./../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const {
  shouldHaveRewardTokensConfigured,
} = require("./../behaviour/reward-tokens.fork");

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

describe("ForkTest: Vault", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe("View functions", () => {
    // These tests use a transaction to call a view function so the gas usage can be reported.
    it("Should get total value", async () => {
      const { josh, vault } = fixture;

      const tx = await vault.connect(josh).populateTransaction.totalValue();
      await josh.sendTransaction(tx);
    });
    it("Should check asset balances", async () => {
      const { usdc, josh, vault } = fixture;

      const tx = await vault
        .connect(josh)
        .populateTransaction.checkBalance(usdc.address);
      await josh.sendTransaction(tx);
    });
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

    it("Should have the OUSD/USDC AMO mint whitelist", async () => {
      const { vault } = fixture;
      expect(
        await vault.isMintWhitelistedStrategy(
          addresses.mainnet.CurveOUSDAMOStrategy
        )
      ).to.be.true;
    });

    it("Should have supported assets", async () => {
      const { vault } = fixture;
      const assets = await vault.getAllAssets();
      expect(assets).to.have.length(1);
      expect(assets).to.include(addresses.mainnet.USDC);
      expect(await vault.isSupportedAsset(addresses.mainnet.USDC)).to.be.true;
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

    it("Should allow to mint w/ USDC", async () => {
      const { ousd, vault, josh, usdc } = fixture;
      const balancePreMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      await vault.connect(josh).mint(usdc.address, usdcUnits("500"), 0);

      const balancePostMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());

      const balanceDiff = balancePostMint.sub(balancePreMint);
      expect(balanceDiff).to.approxEqualTolerance(ousdUnits("500"), 1);
    });

    it("should withdraw from and deposit to strategy", async () => {
      const { vault, josh, usdc, morphoOUSDv2Strategy } = fixture;
      await vault.connect(josh).mint(usdc.address, usdcUnits("90"), 0);
      const strategistSigner = await impersonateAndFund(
        await vault.strategistAddr()
      );

      let usdcBalanceDiff, usdcStratDiff;

      [usdcBalanceDiff] = await differenceInErc20TokenBalances(
        [vault.address],
        [usdc],
        async () => {
          [usdcStratDiff] = await differenceInStrategyBalance(
            [usdc.address],
            [morphoOUSDv2Strategy],
            async () => {
              await vault
                .connect(strategistSigner)
                .depositToStrategy(
                  morphoOUSDv2Strategy.address,
                  [usdc.address],
                  [usdcUnits("90")]
                );
            }
          );
        }
      );

      expect(usdcBalanceDiff).to.equal(usdcUnits("-90"));

      expect(usdcStratDiff).gte(usdcUnits("89.91"));

      [usdcBalanceDiff] = await differenceInErc20TokenBalances(
        [vault.address],
        [usdc],
        async () => {
          [usdcStratDiff] = await differenceInStrategyBalance(
            [usdc.address],
            [morphoOUSDv2Strategy],
            async () => {
              await vault
                .connect(strategistSigner)
                .withdrawFromStrategy(
                  morphoOUSDv2Strategy.address,
                  [usdc.address],
                  [usdcUnits("90")]
                );
            }
          );
        }
      );

      expect(usdcBalanceDiff).to.equal(usdcUnits("90"));

      expect(usdcStratDiff).to.lte(usdcUnits("-89.91"));
    });

    it("Should have vault buffer disabled", async () => {
      const { vault } = fixture;
      expect(await vault.vaultBuffer()).to.equal("0");
    });
  });

  describe("Assets & Strategies", () => {
    it("Should NOT have any unknown assets", async () => {
      const { vault } = fixture;
      const assets = await vault.getAllAssets();

      const knownAssets = [
        // TODO: Update this every time a new asset is supported
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
        "0x26a02ec47ACC2A3442b757F45E0A82B8e993Ce11", // Curve AMO OUSD/USDC
        "0x3643cafA6eF3dd7Fcc2ADaD1cabf708075AFFf6e", // Morpho OUSD v2 Strategy
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

    it("Should be able to withdraw from all strategies", async () => {
      const { vault, timelock } = fixture;
      await vault.connect(timelock).withdrawAllFromStrategies();
    });
  });

  shouldHaveRewardTokensConfigured(() => ({
    vault: fixture.vault,
    harvester: fixture.harvester,
    expectedConfigs: {},
  }));
});
