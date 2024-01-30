const { expect } = require("chai");

const { oethUnits, units } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");

const {
  createFixtureLoader,
  fraxETHStrategyFixture,
} = require("./../_fixture");
const { BigNumber } = require("ethers");
const { impersonateAndFund } = require("../../utils/signers");

describe("FraxETH Strategy", function () {
  let fixture;
  const loadFixture = createFixtureLoader(fraxETHStrategyFixture);
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.fraxEthStrategy,
  }));

  shouldBehaveLikeHarvestable(() => ({
    ...fixture,
    harvester: fixture.oethHarvester,
    strategy: fixture.fraxEthStrategy,
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    strategy: fixture.fraxEthStrategy,
    assets: [fixture.frxETH, fixture.weth],
    valueAssets: [fixture.frxETH],
    harvester: fixture.oethHarvester,
    vault: fixture.oethVault,
  }));

  describe("Mint", function () {
    it("Should allow minting with frxETH", async () => {
      const { daniel, frxETH } = fixture;
      await mintTest(fixture, daniel, frxETH, "12.3887");
    });

    it("Should allow minting with WETH", async () => {
      const { domen, weth } = fixture;
      await mintTest(fixture, domen, weth, "22.3008");
    });

    it("Should allow minting with RETH", async () => {
      const { josh, reth } = fixture;
      await mintTest(fixture, josh, reth, "42.6665");
    });

    it("Should allow minting with stETH", async () => {
      const { matt, stETH } = fixture;
      await mintTest(fixture, matt, stETH, "12.49993");
    });
  });

  describe("Redeem", function () {
    it("Should allow redeem", async () => {
      const {
        daniel,
        domen,
        josh,
        matt,
        frxETH,
        weth,
        reth,
        stETH,
        oeth,
        oethVault,
      } = fixture;

      const users = [daniel, domen, josh, matt];
      const assets = [frxETH, weth, reth, stETH];
      const mintAmounts = ["10.2333", "20.45", "23.456", "15.3434"];

      // Rebase & Allocate
      await oethVault.connect(daniel).rebase();
      await oethVault.connect(daniel).allocate();

      // Mint some OETH first
      for (let i = 0; i < users.length; i++) {
        await oethVault
          .connect(users[i])
          .mint(assets[i].address, oethUnits(mintAmounts[i]), "0");
      }

      // Now try redeeming
      const supplyBeforeRedeem = await oeth.totalSupply();
      const userAssetBalanceBeforeRedeem = await Promise.all(
        assets.map((a) => a.balanceOf(daniel.address))
      );
      const userOETHBalanceBeforeRedeem = await oeth.balanceOf(daniel.address);

      // Redeem all
      await oethVault.connect(daniel).redeem(userOETHBalanceBeforeRedeem, "0");

      const supplyAfterRedeem = await oeth.totalSupply();
      const userAssetBalanceAfterRedeem = await Promise.all(
        assets.map((a) => a.balanceOf(daniel.address))
      );
      const userOETHBalanceAfterRedeem = await oeth.balanceOf(daniel.address);

      // Should've burned user's OETH
      expect(userOETHBalanceAfterRedeem).to.equal(
        "0",
        "OETH should've been burned on redeem"
      );

      // Should've reduced supply
      expect(supplyBeforeRedeem.sub(supplyAfterRedeem)).to.approxEqualTolerance(
        userOETHBalanceBeforeRedeem,
        1,
        "OETH Supply should've changed"
      );

      // User should have got other assets
      let netGainedAssetValue = BigNumber.from(0);
      for (let i = 0; i < assets.length; i++) {
        const redeemPrice = await oethVault.priceUnitRedeem(assets[i].address);
        netGainedAssetValue = netGainedAssetValue.add(
          userAssetBalanceAfterRedeem[i]
            .sub(userAssetBalanceBeforeRedeem[i])
            .mul(redeemPrice)
            .div(oethUnits("1"))
        );
      }
      expect(netGainedAssetValue).to.approxEqualTolerance(
        userOETHBalanceBeforeRedeem,
        1,
        "Net Value of assets redeemed doesn't match"
      );
    });

    it("Should allow redeem with no frxETH in Vault/Strategy", async () => {
      const { daniel, domen, weth, stETH, oeth, oethVault } = fixture;

      const users = [daniel, domen];
      const assets = [weth, stETH];
      const mintAmounts = ["10.2333", "20.45"];

      // Mint some OETH first
      for (let i = 0; i < users.length; i++) {
        await oethVault
          .connect(users[i])
          .mint(assets[i].address, oethUnits(mintAmounts[i]), "0");
      }

      // Rebase & Allocate
      await oethVault.connect(daniel).rebase();
      await oethVault.connect(daniel).allocate();

      // Now try redeeming
      const supplyBeforeRedeem = await oeth.totalSupply();
      const userOETHBalanceBeforeRedeem = await oeth.balanceOf(daniel.address);

      // Redeem all
      await oethVault.connect(daniel).redeem(userOETHBalanceBeforeRedeem, "0");

      const supplyAfterRedeem = await oeth.totalSupply();
      const userOETHBalanceAfterRedeem = await oeth.balanceOf(daniel.address);

      // Should've burned user's OETH
      expect(userOETHBalanceAfterRedeem).to.equal(
        "0",
        "OETH should've been burned on redeem"
      );

      // Should've reduced supply
      expect(supplyBeforeRedeem.sub(supplyAfterRedeem)).to.approxEqualTolerance(
        userOETHBalanceBeforeRedeem,
        1,
        "OETH Supply should've changed"
      );
    });
  });

  describe("Deposit", function () {
    it("Should deposit frxETH from Vault", async () => {
      const { frxETH, sfrxETH, daniel, oethVault, fraxEthStrategy } = fixture;
      const impersonatedVaultSigner = await impersonateAndFund(
        oethVault.address
      );

      // Send some funds to the strategy
      await frxETH
        .connect(daniel)
        .transfer(fraxEthStrategy.address, oethUnits("10"));

      // Call deposit
      const tx = fraxEthStrategy
        .connect(impersonatedVaultSigner)
        .deposit(frxETH.address, oethUnits("10"));

      await expect(tx)
        .to.emit(fraxEthStrategy, "Deposit")
        .withArgs(frxETH.address, sfrxETH.address, oethUnits("10"));
    });

    it("Should deposit WETH from Vault", async () => {
      const { weth, sfrxETH, domen, oethVault, fraxEthStrategy } = fixture;
      const impersonatedVaultSigner = await impersonateAndFund(
        oethVault.address
      );

      // Send some funds to the strategy
      await weth
        .connect(domen)
        .transfer(fraxEthStrategy.address, oethUnits("10"));

      // Call deposit
      const tx = fraxEthStrategy
        .connect(impersonatedVaultSigner)
        .deposit(weth.address, oethUnits("10"));

      await expect(tx)
        .to.emit(fraxEthStrategy, "Deposit")
        .withArgs(weth.address, sfrxETH.address, oethUnits("10"));
    });

    it("Should allow to deposit all supported assets", async () => {
      const { frxETH, weth, matt, sfrxETH, fraxEthStrategy, oethVault } =
        fixture;
      const impersonatedVaultSigner = await impersonateAndFund(
        oethVault.address
      );

      // Send some funds to the strategy
      await weth
        .connect(matt)
        .transfer(fraxEthStrategy.address, oethUnits("11"));
      await frxETH
        .connect(matt)
        .transfer(fraxEthStrategy.address, oethUnits("12"));

      // Call deposit
      const tx = fraxEthStrategy.connect(impersonatedVaultSigner).depositAll();

      await expect(tx)
        .to.emit(fraxEthStrategy, "Deposit")
        .withArgs(frxETH.address, sfrxETH.address, oethUnits("12"))
        .emit(fraxEthStrategy, "Deposit")
        .withArgs(weth.address, sfrxETH.address, oethUnits("11"));
    });

    it("Should revert when depositing nothing", async () => {
      const { frxETH, oethVault, fraxEthStrategy } = fixture;
      const impersonatedVaultSigner = await impersonateAndFund(
        oethVault.address
      );
      const tx = fraxEthStrategy
        .connect(impersonatedVaultSigner)
        .deposit(frxETH.address, "0");
      await expect(tx).to.be.revertedWith("Must deposit something");
    });

    it("Should not deposit any unsupported asset", async () => {
      const { reth, oethVault, fraxEthStrategy } = fixture;
      const impersonatedVaultSigner = await impersonateAndFund(
        oethVault.address
      );
      const tx = fraxEthStrategy
        .connect(impersonatedVaultSigner)
        .deposit(reth.address, "10");
      await expect(tx).to.be.revertedWith("Unexpected asset address");
    });

    it("Should not allow deposit from anyone other than Vault", async () => {
      const { frxETH, strategist, franck, governor, fraxEthStrategy } = fixture;

      // Send some funds to the strategy
      await frxETH
        .connect(franck)
        .transfer(fraxEthStrategy.address, oethUnits("11"));

      for (const user of [franck, strategist, governor]) {
        const tx = fraxEthStrategy.connect(user).deposit(frxETH.address, "5");
        await expect(tx).to.be.revertedWith("Caller is not the Vault");
      }
    });
  });

  describe("Balance", function () {
    it("Should show max redeemable shares as frxETH balance", async () => {
      const { frxETH, fraxEthStrategy, sfrxETH } = fixture;

      await sfrxETH.setMaxWithdrawableBalance(
        fraxEthStrategy.address,
        oethUnits("1234.343")
      );
      expect(await fraxEthStrategy.checkBalance(frxETH.address)).to.equal(
        oethUnits("1234.343")
      );

      await sfrxETH.setMaxWithdrawableBalance(
        fraxEthStrategy.address,
        oethUnits("0")
      );
      expect(await fraxEthStrategy.checkBalance(frxETH.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Should always show 0 WETH balance", async () => {
      const { fraxEthStrategy, weth, domen } = fixture;

      expect(await fraxEthStrategy.checkBalance(weth.address)).to.equal(
        oethUnits("0")
      );

      // Mint something with WETH
      await mintTest(fixture, domen, weth, "2.23");

      // Should still be zero
      expect(await fraxEthStrategy.checkBalance(weth.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Should not show balance of unsupported assets", async () => {
      const { fraxEthStrategy, reth } = fixture;

      await expect(
        fraxEthStrategy.checkBalance(reth.address)
      ).to.be.revertedWith("Unexpected asset address");
    });

    it("Should not include balance held by the strategy contract", async () => {
      const { fraxEthStrategy, weth, frxETH, daniel } = fixture;

      // Give strategy some balance
      await frxETH
        .connect(daniel)
        .mintTo(fraxEthStrategy.address, oethUnits("100"));
      await weth
        .connect(daniel)
        .mintTo(fraxEthStrategy.address, oethUnits("100"));

      // Check balance
      expect(await fraxEthStrategy.checkBalance(frxETH.address)).to.equal(
        oethUnits("0")
      );
      expect(await fraxEthStrategy.checkBalance(weth.address)).to.equal(
        oethUnits("0")
      );
    });
  });

  describe("Assets", function () {
    it("Should support WETH and frxETH", async () => {
      const { fraxEthStrategy, frxETH, weth } = fixture;
      expect(await fraxEthStrategy.supportsAsset(frxETH.address)).to.be.true;
      expect(await fraxEthStrategy.supportsAsset(weth.address)).to.be.true;
    });

    it("Should not support anything else", async () => {
      const { fraxEthStrategy, reth, usdt, sfrxETH, stETH } = fixture;

      for (const asset of [reth, usdt, sfrxETH, stETH]) {
        expect(await fraxEthStrategy.supportsAsset(asset.address)).to.be.false;
      }
    });

    it("Should have pToken set for frxETH", async () => {
      const { fraxEthStrategy, frxETH, sfrxETH } = fixture;
      expect(await fraxEthStrategy.assetToPToken(frxETH.address)).to.equal(
        sfrxETH.address
      );
    });

    it("Should not have pToken set for WETH", async () => {
      const { fraxEthStrategy, sfrxETH, weth } = fixture;
      expect(await fraxEthStrategy.assetToPToken(weth.address)).to.equal(
        sfrxETH.address
      );
    });

    it("sfrxETH Vault should have allowance to move frxETH from the strategy", async () => {
      const { frxETH, sfrxETH, fraxEthStrategy } = fixture;
      expect(
        await frxETH.allowance(fraxEthStrategy.address, sfrxETH.address)
      ).to.be.gt(oethUnits("999999999999999999"));
    });
  });
});

async function mintTest(fixture, user, asset, amount = "10") {
  const { oeth, oethVault, frxETH, fraxEthStrategy } = fixture;

  const unitAmount = await units(amount, asset);

  const supplyBeforeMint = await oeth.totalSupply();
  const userAssetBalanceBeforeMint = await asset.balanceOf(user.address);
  const userOETHBalanceBeforeMint = await oeth.balanceOf(user.address);
  const stratBalanceBeforeMint = await fraxEthStrategy.checkBalance(
    frxETH.address
  );

  await oethVault.connect(user).mint(asset.address, unitAmount, "0");

  await oethVault.connect(user).rebase();
  await oethVault.connect(user).allocate();

  const supplyAfterMint = await oeth.totalSupply();
  const userAssetBalanceAfterMint = await asset.balanceOf(user.address);
  const userOETHBalanceAfterMint = await oeth.balanceOf(user.address);
  const stratBalanceAfterMint = await fraxEthStrategy.checkBalance(
    frxETH.address
  );

  expect(supplyAfterMint.sub(supplyBeforeMint)).to.approxEqualTolerance(
    unitAmount
  );

  expect(
    userAssetBalanceBeforeMint.sub(userAssetBalanceAfterMint)
  ).to.approxEqualTolerance(unitAmount);

  expect(
    userOETHBalanceAfterMint.sub(userOETHBalanceBeforeMint)
  ).to.approxEqualTolerance(unitAmount);

  if (asset.address === frxETH.address) {
    // Should've deposited frxETH to the strategy
    expect(
      stratBalanceAfterMint.sub(stratBalanceBeforeMint)
    ).to.approxEqualTolerance(unitAmount);
  } else {
    // Shouldn't have deposited anything else
    expect(stratBalanceAfterMint).to.approxEqualTolerance(
      stratBalanceBeforeMint
    );
  }
}
