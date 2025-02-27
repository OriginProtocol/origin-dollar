const { expect } = require("chai");
const { utils } = require("ethers");

const addresses = require("../../utils/addresses");
const { loadDefaultFixture } = require("./../_fixture");
const {
  ousdUnits,
  usdtUnits,
  usdcUnits,
  daiUnits,
  differenceInStrategyBalance,
  differenceInErc20TokenBalances,
  isCI,
} = require("./../helpers");
const { impersonateAndFund } = require("../../utils/signers");

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
      const { dai, usdc, usdt, josh, vault } = fixture;

      for (const asset of [dai, usdc, usdt]) {
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
      expect(await vault.ousdMetaStrategy()).to.equal(addresses.zero);
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
    });

    it("Should return a price for redeem with DAI", async () => {
      const { vault, dai } = fixture;
      const price = await vault.priceUnitRedeem(dai.address);

      log(`Price for redeeming with DAI: ${utils.formatEther(price, 18)}`);

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
        "0x79F2188EF9350A1dC11A062cca0abE90684b0197", // MorphoAaveStrategy
        "0x6b69B755C629590eD59618A2712d8a2957CA98FC", // Maker DSR Strategy
        "0x603CDEAEC82A60E3C4A10dA6ab546459E5f64Fa0", // Meta Morpho USDC
        "0x2B8f37893EE713A4E9fF0cEb79F27539f20a32a1", // Morpho Gauntlet Prime USDC
        "0xe3ae7C80a1B02Ccd3FB0227773553AEB14e32F26", // Morpho Gauntlet Prime USDT
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
        "0x79F2188EF9350A1dC11A062cca0abE90684b0197", // MorphoAave
        "0xe3ae7c80a1b02ccd3fb0227773553aeb14e32f26", // Morpho Gauntlet Prime USDT
      ]).to.include(await vault.assetDefaultStrategies(usdt.address));
    });

    it("Should have correct default strategy set for USDC", async () => {
      const { vault, usdc } = fixture;

      expect([
        "0x79F2188EF9350A1dC11A062cca0abE90684b0197", // MorphoAave
        "0x603CDEAEC82A60E3C4A10dA6ab546459E5f64Fa0", // Meta Morpho USDC
      ]).to.include(await vault.assetDefaultStrategies(usdc.address));
    });

    it("Should have correct default strategy set for DAI", async () => {
      const { vault, dai } = fixture;

      expect([
        "0x79F2188EF9350A1dC11A062cca0abE90684b0197", // MorphoAave
        "0x6b69B755C629590eD59618A2712d8a2957CA98FC", // Maker DSR
      ]).to.include(await vault.assetDefaultStrategies(dai.address));
    });

    it("Should be able to withdraw from all strategies", async () => {
      const { vault, timelock } = fixture;
      await vault.connect(timelock).withdrawAllFromStrategies();
    });
  });

  // We no longer have any strategies that harvest these reward tokens
  // shouldHaveRewardTokensConfigured(() => ({
  //   vault: fixture.vault,
  //   harvester: fixture.harvester,
  //   expectedConfigs: {
  //     [fixture.aave.address]: {
  //       allowedSlippageBps: 300,
  //       harvestRewardBps: 100,
  //       swapPlatformAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  //       doSwapRewardToken: true,
  //       swapPlatform: 1,
  //       liquidationLimit: 0,
  //       uniswapV3Path:
  //         "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9002710c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f4dac17f958d2ee523a2206206994597c13d831ec7",
  //     },
  //     [fixture.cvx.address]: {
  //       allowedSlippageBps: 300,
  //       harvestRewardBps: 100,
  //       swapPlatformAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  //       doSwapRewardToken: true,
  //       swapPlatform: 1,
  //       liquidationLimit: ousdUnits("2500"),
  //       uniswapV3Path:
  //         "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b002710c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f4dac17f958d2ee523a2206206994597c13d831ec7",
  //     },
  //     [fixture.crv.address]: {
  //       allowedSlippageBps: 300,
  //       harvestRewardBps: 200,
  //       swapPlatformAddr: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
  //       doSwapRewardToken: true,
  //       swapPlatform: 1,
  //       liquidationLimit: ousdUnits("4000"),
  //       uniswapV3Path:
  //         "0xd533a949740bb3306d119cc777fa900ba034cd52000bb8c02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f4dac17f958d2ee523a2206206994597c13d831ec7",
  //     },
  //   },
  // }));
});
