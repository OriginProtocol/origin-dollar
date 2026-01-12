const { expect } = require("chai");
const { utils } = require("ethers");

const addresses = require("../../utils/addresses");
const { loadDefaultFixture } = require("./../_fixture");
const {
  ousdUnits,
  usdcUnits,
  differenceInStrategyBalance,
  differenceInErc20TokenBalances,
  isCI,
  decimalsFor,
} = require("./../helpers");
const { canWithdrawAllFromMorphoOUSD } = require("../../utils/morpho");
const { impersonateAndFund } = require("../../utils/signers");
const {
  shouldHaveRewardTokensConfigured,
} = require("./../behaviour/reward-tokens.fork");
const { formatUnits } = require("ethers/lib/utils");

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

    it("Should have the correct OUSD MetaStrategy address set", async () => {
      const { vault } = fixture;
      expect(await vault.ousdMetaStrategy()).to.equal(
        addresses.mainnet.CurveOUSDAMOStrategy
      );
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

    it("Should allow to mint and redeem w/ USDC", async () => {
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

      await vault.connect(josh).redeem(balanceDiff, 0);

      const balancePostRedeem = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      expect(balancePreMint).to.approxEqualTolerance(balancePostRedeem, 1);
    });

    it("Should calculate and return redeem outputs", async () => {
      const { vault } = fixture;
      const outputs = await vault.calculateRedeemOutputs(ousdUnits("100"));
      expect(outputs).to.have.length(1);
      const assets = await vault.getAllAssets();

      const values = await Promise.all(
        outputs.map(async (output, index) => {
          const asset = await ethers.getContractAt(
            "MintableERC20",
            assets[index]
          );
          return parseFloat(
            formatUnits(output.toString(), await decimalsFor(asset))
          );
        })
      );

      expect(ousdUnits(values[0].toString())).to.approxEqualTolerance(
        ousdUnits("100"),
        0.5
      );
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

  describe("Oracle", () => {
    it("Should have correct Price Oracle address set", async () => {
      const { vault } = fixture;
      expect(await vault.priceProvider()).to.equal(
        "0x36CFB852d3b84afB3909BCf4ea0dbe8C82eE1C3c"
      );
    });

    it("Should return a price for minting with USDC", async () => {
      const { vault, usdc } = fixture;
      const price = await vault.priceUnitMint(usdc.address);

      log(`Price for minting with USDC: ${utils.formatEther(price, 6)}`);

      expect(price).to.be.lte(utils.parseEther("1"));
      expect(price).to.be.gt(utils.parseEther("0.999"));
    });

    it("Should return a price for redeem with USDC", async () => {
      const { vault, usdc } = fixture;
      const price = await vault.priceUnitRedeem(usdc.address);

      log(`Price for redeeming with USDC: ${utils.formatEther(price, 6)}`);

      expect(price).to.be.gte(utils.parseEther("1"));
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

    it("Should have correct default strategy set for USDC", async () => {
      const { vault, usdc } = fixture;

      expect([
        "0x3643cafA6eF3dd7Fcc2ADaD1cabf708075AFFf6e", // Morpho OUSD v2 Strategy
      ]).to.include(await vault.assetDefaultStrategies(usdc.address));
    });

    it("Should be able to withdraw from all strategies", async () => {
      const { vault, timelock } = fixture;

      const withdrawAllAllowed = await canWithdrawAllFromMorphoOUSD();

      // If there is not enough liquidity in the Morpho OUSD v1 Vault, skip the withdrawAll test
      if (withdrawAllAllowed === false) return;

      await vault.connect(timelock).withdrawAllFromStrategies();
    });
  });

  shouldHaveRewardTokensConfigured(() => ({
    vault: fixture.vault,
    harvester: fixture.harvester,
    expectedConfigs: {},
  }));
});
