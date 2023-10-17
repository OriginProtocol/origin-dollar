const { expect } = require("chai");
const { Wallet } = require("ethers");

const { units, usdcUnits } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { parseUnits } = require("ethers/lib/utils");

/**
 *
 * @param {*} context a function that returns a fixture with the additional properties:
 * - strategy: the strategy to test
 * - assets: array of tokens to test
 * - vault: Vault or OETHVault contract
 * - harvester: Harvester or OETHHarvester contract
 * @example
    shouldBehaveLikeStrategy(() => ({
      ...fixture,
      strategy: fixture.convexFrxEthWethStrategy,
      assets: [fixture.weth, fixture.frxETH],
      vault: fixture.oethVault,
      harvester: fixture.oethHarvester,
    }));
 */
const shouldBehaveLikeStrategy = (context) => {
  describe("Strategy behaviour", () => {
    it("Should have vault configured", async () => {
      const { strategy, vault } = await context();
      expect(await strategy.vaultAddress()).to.equal(vault.address);
    });
    it("Should be a supported asset", async () => {
      const { assets, strategy, crv, cvx } = await context();

      for (const asset of assets) {
        expect(await strategy.supportsAsset(asset.address)).to.be.true;
      }
      const unsupportedAssets = [crv, cvx];
      for (const asset of unsupportedAssets) {
        expect(await strategy.supportsAsset(asset.address)).to.be.false;
      }
    });
    describe("with no assets in the strategy", () => {
      it("Should check asset balances", async () => {
        const { assets, josh, strategy } = context();

        for (const asset of assets) {
          // assume there are no assets already in the strategy
          expect(
            await strategy.connect(josh).checkBalance(asset.address)
          ).to.equal(0);

          // This uses a transaction to call a view function so the gas usage can be reported.
          const tx = await strategy
            .connect(josh)
            .populateTransaction.checkBalance(asset.address);
          await josh.sendTransaction(tx);
        }
      });
      it("Should be able to deposit each asset", async () => {
        const { assets, strategy, vault } = await context();

        const strategySigner = await impersonateAndFund(strategy.address);
        const vaultSigner = await impersonateAndFund(vault.address);

        for (const asset of assets) {
          const depositAmount = await units("1000", asset);
          // mint some test assets directly into the strategy contract
          await asset.connect(strategySigner).mint(depositAmount);

          const tx = await strategy
            .connect(vaultSigner)
            .deposit(asset.address, depositAmount);

          const platformAddress = await strategy.assetToPToken(asset.address);
          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(asset.address, platformAddress, depositAmount);
        }

        // Have to do this after all assets have been added as pool strategies
        // spread the value equally across all assets
        for (const asset of assets) {
          // Has to be >= as AMOs will add extra OTokens to the strategy
          expect(await strategy.checkBalance(asset.address)).to.be.gte(
            await units("1000", asset)
          );
        }
      });
      it("Should not allow deposit by non-vault", async () => {
        const { assets, strategy, harvester, governor, strategist, matt } =
          context();

        const harvesterSigner = await impersonateAndFund(harvester.address);
        for (const signer of [harvesterSigner, governor, strategist, matt]) {
          await expect(
            strategy
              .connect(signer)
              .deposit(assets[0].address, parseUnits("10"))
          ).to.revertedWith("Caller is not the Vault");
        }
      });
      it("Should be able to deposit all asset together", async () => {
        const { assets, strategy, vault } = await context();

        const strategySigner = await impersonateAndFund(strategy.address);
        const vaultSigner = await impersonateAndFund(vault.address);

        for (const [i, asset] of assets.entries()) {
          const depositAmount = await units("1000", asset);
          // mint some test assets directly into the strategy contract
          await asset.connect(strategySigner).mint(depositAmount.mul(i + 1));
        }

        const tx = await strategy.connect(vaultSigner).depositAll();

        for (const [i, asset] of assets.entries()) {
          const platformAddress = await strategy.assetToPToken(asset.address);
          const depositAmount = await units("1000", asset);
          await expect(tx)
            .to.emit(strategy, "Deposit")
            .withArgs(asset.address, platformAddress, depositAmount.mul(i + 1));
        }
      });
      it("Should not be able to deposit zero asset amount", async () => {
        const { assets, strategy, vault } = await context();
        const vaultSigner = await impersonateAndFund(vault.address);

        for (const asset of assets) {
          await expect(
            strategy.connect(vaultSigner).deposit(asset.address, 0)
          ).to.be.revertedWith("Must deposit something");
        }
      });
      it("Should not allow deposit all by non-vault", async () => {
        const { strategy, harvester, governor, strategist, matt } = context();

        const harvesterSigner = await impersonateAndFund(harvester.address);
        for (const signer of [harvesterSigner, governor, strategist, matt]) {
          await expect(strategy.connect(signer).depositAll()).to.revertedWith(
            "Caller is not the Vault"
          );
        }
      });
      it("Should not be able to withdraw zero asset amount", async () => {
        const { assets, strategy, vault } = await context();
        const vaultSigner = await impersonateAndFund(vault.address);

        for (const asset of assets) {
          await expect(
            strategy
              .connect(vaultSigner)
              .withdraw(vault.address, asset.address, 0)
          ).to.be.revertedWith("Must withdraw something");
        }
      });
      it("Should not allow withdraw by non-vault", async () => {
        const {
          assets,
          vault,
          strategy,
          harvester,
          governor,
          strategist,
          matt,
        } = context();

        const harvesterSigner = await impersonateAndFund(harvester.address);
        for (const signer of [harvesterSigner, governor, strategist, matt]) {
          await expect(
            strategy
              .connect(signer)
              .withdraw(vault.address, assets[0].address, parseUnits("10"))
          ).to.revertedWith("Caller is not the Vault");
        }
      });
      it("Should be able to call withdraw all by vault", async () => {
        const { strategy, vault } = await context();
        const vaultSigner = await impersonateAndFund(vault.address);

        const tx = await strategy.connect(vaultSigner).withdrawAll();

        await expect(tx).to.not.emit(strategy, "Withdrawal");
      });
      it("Should be able to call withdraw all by governor", async () => {
        const { strategy, governor } = await context();

        const tx = await strategy.connect(governor).withdrawAll();

        await expect(tx).to.not.emit(strategy, "Withdrawal");
      });
      it("Should not allow withdraw all by non-vault or non-governor", async () => {
        const { strategy, harvester, strategist, matt } = context();

        const harvesterSigner = await impersonateAndFund(harvester.address);
        for (const signer of [harvesterSigner, strategist, matt]) {
          await expect(strategy.connect(signer).withdrawAll()).to.revertedWith(
            "Caller is not the Vault or Governor"
          );
        }
      });
    });
    describe("with assets in the strategy", () => {
      beforeEach(async () => {
        const { assets, strategy, vault } = await context();
        const strategySigner = await impersonateAndFund(strategy.address);
        const vaultSigner = await impersonateAndFund(vault.address);

        // deposit some assets into the strategy so we can withdraw them
        for (const asset of assets) {
          const depositAmount = await units("10000", asset);
          // mint some test assets directly into the strategy contract
          await asset.connect(strategySigner).mint(depositAmount);
        }
        await strategy.connect(vaultSigner).depositAll();
      });
      it("Should check asset balances", async () => {
        const { assets, josh, strategy } = context();

        for (const asset of assets) {
          // assume there are no assets already in the strategy
          expect(
            await strategy.connect(josh).checkBalance(asset.address)
          ).to.gt(0);

          // This uses a transaction to call a view function so the gas usage can be reported.
          const tx = await strategy
            .connect(josh)
            .populateTransaction.checkBalance(asset.address);
          await josh.sendTransaction(tx);
        }
      });
      it("Should be able to withdraw each asset to the vault", async () => {
        const { assets, strategy, vault } = await context();
        const vaultSigner = await impersonateAndFund(vault.address);

        for (const asset of assets) {
          const platformAddress = await strategy.assetToPToken(asset.address);
          const withdrawAmount = await units("8000", asset);

          const tx = await strategy
            .connect(vaultSigner)
            .withdraw(vault.address, asset.address, withdrawAmount);

          await expect(tx)
            .to.emit(strategy, "Withdrawal")
            .withArgs(asset.address, platformAddress, withdrawAmount);
          // the transfer does not have to come from the strategy. It can come directly from the platform
          await expect(tx)
            .to.emit(asset, "Transfer")
            .withNamedArgs({ to: vault.address, value: withdrawAmount });
        }
      });
      it("Should be able to withdraw all assets", async () => {
        const { assets, strategy, vault } = await context();
        const vaultSigner = await impersonateAndFund(vault.address);

        const tx = await strategy.connect(vaultSigner).withdrawAll();

        for (const asset of assets) {
          const platformAddress = await strategy.assetToPToken(asset.address);
          const withdrawAmount = await units("10000", asset);
          await expect(tx)
            .to.emit(strategy, "Withdrawal")
            .withArgs(asset.address, platformAddress, withdrawAmount);
          await expect(tx).to.emit(asset, "Transfer").withNamedArgs({
            to: vault.address,
            // FraxETHStrategy withdraws directly from the sfrxETH vault and not the strategy
            // from: strategy.address,
          });
        }
      });
    });
    it("Should allow transfer of arbitrary tokens by Governor", async () => {
      const { strategy, usdc, weth, governor } = context();

      const strategySigner = await impersonateAndFund(strategy.address);

      // Add some USDC to the strategy
      const usdcAmount = usdcUnits("987");
      await usdc.connect(strategySigner).mint(usdcAmount);
      // Governor can take the USDC from the strategy
      const usdcTx = await strategy
        .connect(governor)
        .transferToken(usdc.address, usdcAmount);
      await expect(usdcTx)
        .to.emit(usdc, "Transfer")
        .withArgs(strategy.address, governor.address, usdcAmount);

      // Add some WETH to the strategy
      const wethAmount = parseUnits("123");
      await weth.connect(strategySigner).mint(wethAmount);
      // Governor can take the WETH from the strategy
      const wethTx = await strategy
        .connect(governor)
        .transferToken(weth.address, wethAmount);
      await expect(wethTx)
        .to.emit(weth, "Transfer")
        .withArgs(strategy.address, governor.address, wethAmount);
    });
    it("Should not allow transfer of arbitrary token by non-Governor", async () => {
      const { strategy, weth, strategist, matt, harvester, vault } = context();

      const vaultSigner = await impersonateAndFund(vault.address);
      const harvesterSigner = await impersonateAndFund(harvester.address);

      for (const signer of [strategist, matt, harvesterSigner, vaultSigner]) {
        await expect(
          strategy.connect(signer).transferToken(weth.address, parseUnits("8"))
        ).to.be.revertedWith("Caller is not the Governor");
      }
    });
    it("Should not allow transfer of supported token", async () => {
      const { strategy, governor, assets } = context();
      await expect(
        strategy
          .connect(governor)
          .transferToken(assets[0].address, parseUnits("8"))
      ).to.be.revertedWith("Cannot transfer supported asset");
    });
    it("Should allow the harvester to be set by the governor", async () => {
      const { governor, harvester, strategy } = context();
      const randomAddress = Wallet.createRandom().address;

      const tx = await strategy
        .connect(governor)
        .setHarvesterAddress(randomAddress);
      await expect(tx)
        .to.emit(strategy, "HarvesterAddressesUpdated")
        .withArgs(harvester.address, randomAddress);
      expect(await strategy.harvesterAddress()).to.equal(randomAddress);
    });
    it("Should not allow the harvester to be set by non-governor", async () => {
      const { strategy, strategist, matt, harvester, vault } = context();
      const randomAddress = Wallet.createRandom().address;

      const vaultSigner = await impersonateAndFund(vault.address);
      const harvesterSigner = await impersonateAndFund(harvester.address);

      for (const signer of [strategist, matt, harvesterSigner, vaultSigner]) {
        await expect(
          strategy.connect(signer).setHarvesterAddress(randomAddress)
        ).to.revertedWith("Caller is not the Governor");
      }
    });
  });
};

module.exports = {
  shouldBehaveLikeStrategy,
};
