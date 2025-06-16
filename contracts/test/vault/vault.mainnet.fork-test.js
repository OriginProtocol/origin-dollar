const { expect } = require("chai");
const { utils } = require("ethers");

const addresses = require("../../utils/addresses");
const { loadDefaultFixture } = require("./../_fixture");
const {
  ousdUnits,
  usdtUnits,
  usdcUnits,
  usdsUnits,
  differenceInStrategyBalance,
  differenceInErc20TokenBalances,
  isCI,
  decimalsFor,
} = require("./../helpers");
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
      const { usds, usdc, usdt, josh, vault } = fixture;

      for (const asset of [usds, usdc, usdt]) {
        const tx = await vault
          .connect(josh)
          .populateTransaction.checkBalance(asset.address);
        await josh.sendTransaction(tx);
      }
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
      expect(assets).to.have.length(3);
      expect(assets).to.include(addresses.mainnet.USDT);
      expect(assets).to.include(addresses.mainnet.USDC);
      expect(assets).to.include(addresses.mainnet.USDS);

      expect(await vault.isSupportedAsset(addresses.mainnet.USDT)).to.be.true;
      expect(await vault.isSupportedAsset(addresses.mainnet.USDC)).to.be.true;
      expect(await vault.isSupportedAsset(addresses.mainnet.USDS)).to.be.true;
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

    it("Should allow to mint and redeem w/ USDT & USDC & USDS", async () => {
      const { ousd, vault, josh, usdt, usdc, usds } = fixture;
      const balancePreMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      // mint using all 3 tokens, giving vault enough liquidity to create a mixed
      // bag of tokens on redeem
      await vault.connect(josh).mint(usdt.address, usdtUnits("50000"), 0);
      await vault.connect(josh).mint(usdc.address, usdcUnits("50000"), 0);
      await vault.connect(josh).mint(usds.address, usdsUnits("50000"), 0);

      const balancePostMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());

      const balanceDiff = balancePostMint.sub(balancePreMint);
      expect(balanceDiff).to.approxEqualTolerance(ousdUnits("150000"), 1);

      // redeem only a third of the minted amount
      await vault.connect(josh).redeem(ousdUnits("50000"), 0);

      const balancePostRedeem = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      expect(balancePreMint.add(ousdUnits("100000"))).to.approxEqualTolerance(
        balancePostRedeem,
        1
      );
    });

    it.skip("Should allow to mint and redeem w/ USDT", async () => {
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

    it.skip("Should allow to mint and redeem w/ USDC", async () => {
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

    it.skip("Should allow to mint and redeem w/ USDS", async () => {
      const { ousd, vault, josh, usds } = fixture;
      const balancePreMint = await ousd
        .connect(josh)
        .balanceOf(josh.getAddress());
      await vault.connect(josh).mint(usds.address, usdsUnits("50000"), 0);

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

    it("Should calculate and return redeem outputs", async () => {
      const { vault } = fixture;
      const outputs = await vault.calculateRedeemOutputs(ousdUnits("100"));
      expect(outputs).to.have.length(3);
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

      expect(
        ousdUnits((values[0] + values[1] + values[2]).toString())
      ).to.approxEqualTolerance(ousdUnits("100"), 0.5);
    });

    it("should withdraw from and deposit to strategy", async () => {
      const { vault, josh, usdt, morphoGauntletPrimeUSDTStrategy } = fixture;
      await vault.connect(josh).mint(usdt.address, usdtUnits("90"), 0);
      const strategistSigner = await impersonateAndFund(
        await vault.strategistAddr()
      );

      let usdtBalanceDiff, usdtStratDiff;

      [usdtBalanceDiff] = await differenceInErc20TokenBalances(
        [vault.address],
        [usdt],
        async () => {
          [usdtStratDiff] = await differenceInStrategyBalance(
            [usdt.address],
            [morphoGauntletPrimeUSDTStrategy],
            async () => {
              await vault
                .connect(strategistSigner)
                .depositToStrategy(
                  morphoGauntletPrimeUSDTStrategy.address,
                  [usdt.address],
                  [usdtUnits("90")]
                );
            }
          );
        }
      );

      expect(usdtBalanceDiff).to.equal(usdtUnits("-90"));

      expect(usdtStratDiff).gte(usdtUnits("89.91"));

      [usdtBalanceDiff] = await differenceInErc20TokenBalances(
        [vault.address],
        [usdt],
        async () => {
          [usdtStratDiff] = await differenceInStrategyBalance(
            [usdt.address],
            [morphoGauntletPrimeUSDTStrategy],
            async () => {
              await vault
                .connect(strategistSigner)
                .withdrawFromStrategy(
                  morphoGauntletPrimeUSDTStrategy.address,
                  [usdt.address],
                  [usdtUnits("90")]
                );
            }
          );
        }
      );

      expect(usdtBalanceDiff).to.equal(usdtUnits("90"));

      expect(usdtStratDiff).to.lte(usdtUnits("-89.91"));
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

    it("Should return a price for minting with USDT", async () => {
      const { vault, usdt } = fixture;
      const price = await vault.priceUnitMint(usdt.address);

      log(`Price for minting with USDT: ${utils.formatEther(price, 6)}`);

      expect(price).to.be.lte(utils.parseEther("1"));
      expect(price).to.be.gt(utils.parseEther("0.998"));
    });

    it("Should return a price for minting with USDS", async () => {
      const { vault, usds } = fixture;
      const price = await vault.priceUnitMint(usds.address);

      log(`Price for minting with USDS: ${utils.formatEther(price, 18)}`);

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
    });

    it("Should return a price for redeem with USDS", async () => {
      const { vault, usds } = fixture;
      const price = await vault.priceUnitRedeem(usds.address);

      log(`Price for redeeming with USDS: ${utils.formatEther(price, 18)}`);

      expect(price).to.be.gte(utils.parseEther("1"));
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
        "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
        "0xdC035D45d973E3EC169d2276DDab16f1e407384F", // USDS
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
        "0x5Bd9AF9c2506D29B6d79cB878284A270190EaEAa", // Maker SSR Strategy
        "0x603CDEAEC82A60E3C4A10dA6ab546459E5f64Fa0", // Meta Morpho USDC
        "0x2B8f37893EE713A4E9fF0cEb79F27539f20a32a1", // Morpho Gauntlet Prime USDC
        "0xe3ae7C80a1B02Ccd3FB0227773553AEB14e32F26", // Morpho Gauntlet Prime USDT
        "0x26a02ec47ACC2A3442b757F45E0A82B8e993Ce11", // Curve AMO OUSD/USDC
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

      expect([
        "0xe3ae7C80a1B02Ccd3FB0227773553AEB14e32F26", // Morpho Gauntlet Prime USDT
      ]).to.include(await vault.assetDefaultStrategies(usdt.address));
    });

    it("Should have correct default strategy set for USDC", async () => {
      const { vault, usdc } = fixture;

      expect([
        "0x603CDEAEC82A60E3C4A10dA6ab546459E5f64Fa0", // Meta Morpho USDC
      ]).to.include(await vault.assetDefaultStrategies(usdc.address));
    });

    it("Should have correct default strategy set for USDS", async () => {
      const { vault, usds } = fixture;

      expect([
        "0x5Bd9AF9c2506D29B6d79cB878284A270190EaEAa", // Maker SSR Strategy
      ]).to.include(await vault.assetDefaultStrategies(usds.address));
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
