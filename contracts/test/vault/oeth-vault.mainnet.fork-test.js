const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { createFixtureLoader, oethDefaultFixture } = require("../_fixture");
const { isCI, oethUnits } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { logTxDetails } = require("../../utils/txLogger");
const {
  shouldHaveRewardTokensConfigured,
} = require("../behaviour/reward-tokens.fork");

const log = require("../../utils/logger")("test:fork:oeth:vault");

const { oethWhaleAddress } = addresses.mainnet;

const loadFixture = createFixtureLoader(oethDefaultFixture);
describe("ForkTest: OETH Vault", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  describe("post deployment", () => {
    it("Should have the correct governor address set", async () => {
      const {
        oethVault,
        oethDripper,
        convexEthMetaStrategy,
        fraxEthStrategy,
        oeth,
        woeth,
        oethHarvester,
      } = fixture;

      const oethContracts = [
        oethVault,
        oethDripper,
        convexEthMetaStrategy,
        fraxEthStrategy,
        oeth,
        woeth,
        oethHarvester,
      ];

      for (let i = 0; i < oethContracts.length; i++) {
        expect(await oethContracts[i].governor()).to.equal(
          addresses.mainnet.Timelock
        );
      }
    });

    it("Should have correct WETH asset index cached", async () => {
      const { oethVault, weth } = fixture;
      const index = await oethVault.wethAssetIndex();
      const assets = await oethVault.getAllAssets();

      expect(assets[index]).to.equal(weth.address);
    });
  });

  describe("user operations", () => {
    let oethWhaleSigner;
    beforeEach(async () => {
      oethWhaleSigner = await impersonateAndFund(oethWhaleAddress);
    });

    it("should mint with 1 WETH then no allocation", async () => {
      const { oethVault, weth, josh } = fixture;

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      await weth.connect(josh).approve(oethVault.address, amount);

      const tx = await oethVault
        .connect(josh)
        .mint(weth.address, amount, minOeth);

      await logTxDetails(tx, "mint");

      await expect(tx)
        .to.emit(oethVault, "Mint")
        .withArgs(josh.address, amount);
    });

    it("should mint with 11 WETH then auto allocate", async () => {
      const { oethVault, weth, josh } = fixture;

      const amount = parseUnits("11", 18);
      const minOeth = parseUnits("8", 18);

      await weth.connect(josh).approve(oethVault.address, amount);

      const tx = await oethVault
        .connect(josh)
        .mint(weth.address, amount, minOeth);

      await logTxDetails(tx, "mint");

      await expect(tx)
        .to.emit(oethVault, "Mint")
        .withArgs(josh.address, amount);
    });

    it("should not mint with any other asset", async () => {
      const { oethVault, frxETH, stETH, reth, josh } = fixture;

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      for (const asset of [frxETH, stETH, reth]) {
        await asset.connect(josh).approve(oethVault.address, amount);
        const tx = oethVault.connect(josh).mint(asset.address, amount, minOeth);

        await expect(tx).to.be.revertedWith("Unsupported asset for minting");
      }
    });

    it("should have 0.1% redeem fee", async () => {
      const { oethVault } = fixture;

      expect(await oethVault.redeemFeeBps()).to.equal(10);
    });

    it("should return only WETH in redeem calculations", async () => {
      const { oethVault } = fixture;

      const output = await oethVault.calculateRedeemOutputs(oethUnits("123"));
      const index = await oethVault.wethAssetIndex();

      expect(output[index]).to.equal(oethUnits("123").mul("9990").div("10000"));

      output.map((x, i) => {
        if (i !== index.toNumber()) {
          expect(x).to.equal("0");
        }
      });
    });

    it("should partially redeem 10 OETH", async () => {
      const { oeth, oethVault } = fixture;

      expect(await oeth.balanceOf(oethWhaleAddress)).to.gt(10);

      const amount = parseUnits("10", 18);
      const minEth = parseUnits("9.94", 18);

      const tx = await oethVault
        .connect(oethWhaleSigner)
        .redeem(amount, minEth);

      await logTxDetails(tx, "redeem");

      await expect(tx)
        .to.emit(oethVault, "Redeem")
        .withNamedArgs({ _addr: oethWhaleAddress });
    });

    // Skipping this test since right now we have too much of
    // WETH sitting in the Vault waiting to be deposited
    it.skip("should not do full redeem by OETH whale", async () => {
      const { oeth, oethVault } = fixture;

      const oethWhaleBalance = await oeth.balanceOf(oethWhaleAddress);
      expect(oethWhaleBalance, "no longer an OETH whale").to.gt(
        parseUnits("100", 18)
      );

      const tx = oethVault.connect(oethWhaleSigner).redeem(oethWhaleBalance, 0);
      await expect(tx).to.revertedWith("Liquidity error");
    });
    it("OETH whale can redeem after withdraw from all strategies", async () => {
      const { oeth, oethVault, timelock } = fixture;

      const oethWhaleBalance = await oeth.balanceOf(oethWhaleAddress);
      log(`OETH whale balance: ${formatUnits(oethWhaleBalance)}`);
      expect(oethWhaleBalance, "no longer an OETH whale").to.gt(
        parseUnits("1000", 18)
      );

      await oethVault.connect(timelock).withdrawAllFromStrategies();

      const tx = await oethVault
        .connect(oethWhaleSigner)
        .redeem(oethWhaleBalance, 0);
      await expect(tx)
        .to.emit(oethVault, "Redeem")
        .withNamedArgs({ _addr: oethWhaleAddress });
    });
    it("OETH whale redeem 50 OETH", async () => {
      const { oethVault } = fixture;

      const amount = parseUnits("50", 18);
      const minEth = parseUnits("49.7", 18);

      const tx = await oethVault
        .connect(oethWhaleSigner)
        .redeem(amount, minEth);

      await logTxDetails(tx, "redeem");

      await expect(tx)
        .to.emit(oethVault, "Redeem")
        .withNamedArgs({ _addr: oethWhaleAddress });
    });
    it("Vault should have the right WETH address", async () => {
      const { oethVault } = fixture;

      expect((await oethVault.weth()).toLowerCase()).to.equal(
        addresses.mainnet.WETH.toLowerCase()
      );
    });
  });

  describe("Remove asset", () => {
    it("should remove all LSTs from the Vault", async function () {
      const { oethVault, frxETH, reth, stETH, timelock } = fixture;

      if (!(await oethVault.isSupportedAsset(frxETH.address))) {
        this.skip();
      }

      // Remove all assets from strategies
      await oethVault.connect(timelock).withdrawAllFromStrategies();

      const lstAssets = [frxETH, reth, stETH];

      // Just draining out every asset to make
      // sure `checkBalance(asset)` returns 0
      const mockedVaultSigner = await impersonateAndFund(oethVault.address);
      for (const asset of lstAssets) {
        const balance = await asset.balanceOf(oethVault.address);
        // stETH has rounding issues, so transferring 1 wei more than the balance
        await asset
          .connect(mockedVaultSigner)
          .transfer(
            addresses.dead,
            asset.address == stETH.address ? balance.add(1) : balance
          );
      }

      // Now remove all LSTs
      for (const asset of lstAssets) {
        await oethVault.connect(timelock).removeAsset(asset.address);

        expect(await oethVault.checkBalance(asset.address)).to.equal(0);
        expect(await oethVault.isSupportedAsset(asset.address)).to.be.false;
        expect(await oethVault.assetDefaultStrategies(asset.address)).to.equal(
          addresses.zero
        );
      }
    });
  });

  describe("operations", () => {
    it("should rebase", async function () {
      const { oethVault } = fixture;

      const tx = await oethVault.rebase();

      await logTxDetails(tx, "rebase");
    });
  });

  shouldHaveRewardTokensConfigured(() => ({
    vault: fixture.oethVault,
    harvester: fixture.oethHarvester,
    ignoreTokens: [fixture.weth.address.toLowerCase()],
    expectedConfigs: {
      [fixture.cvx.address]: {
        allowedSlippageBps: 300,
        harvestRewardBps: 200,
        swapPlatformAddr: "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4",
        doSwapRewardToken: true,
        swapPlatform: 3,
        liquidationLimit: oethUnits("2500"),
        curvePoolIndices: [1, 0],
      },
      [fixture.crv.address]: {
        allowedSlippageBps: 300,
        harvestRewardBps: 200,
        swapPlatformAddr: "0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14",
        doSwapRewardToken: true,
        swapPlatform: 3,
        liquidationLimit: oethUnits("4000"),
        curvePoolIndices: [2, 1],
      },
    },
  }));
});
