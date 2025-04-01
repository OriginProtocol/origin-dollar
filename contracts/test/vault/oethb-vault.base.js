const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { oethUnits } = require("../helpers");
const { deployWithConfirmation } = require("../../utils/deploy");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("OETHb Vault", function () {
  let fixture;

  describe("Mint Whitelist", function () {
    beforeEach(async () => {
      fixture = await baseFixture();
    });

    it("Should allow a strategy to be added to the whitelist", async () => {
      const { oethbVault, governor } = fixture;

      // Pretend addresses.dead is a strategy
      await oethbVault.connect(governor).approveStrategy(addresses.dead);

      const tx = oethbVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);

      await expect(tx).to.emit(oethbVault, "StrategyAddedToMintWhitelist");
      expect(await oethbVault.isMintWhitelistedStrategy(addresses.dead)).to.be
        .true;
    });

    it("Should allow a strategy to be removed from the whitelist", async () => {
      const { oethbVault, governor } = fixture;

      // Pretend addresses.dead is a strategy
      await oethbVault.connect(governor).approveStrategy(addresses.dead);
      await oethbVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);

      // Remove it
      const tx = oethbVault
        .connect(governor)
        .removeStrategyFromMintWhitelist(addresses.dead);

      await expect(tx).to.emit(oethbVault, "StrategyRemovedFromMintWhitelist");
      expect(await oethbVault.isMintWhitelistedStrategy(addresses.dead)).to.be
        .false;
    });

    it("Should not allow non-governor to add to whitelist", async () => {
      const { oethbVault, rafael } = fixture;
      const tx = oethbVault
        .connect(rafael)
        .addStrategyToMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should not allow non-governor to remove from whitelist", async () => {
      const { oethbVault, rafael } = fixture;
      const tx = oethbVault
        .connect(rafael)
        .removeStrategyFromMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should not allow adding unapproved strategy", async () => {
      const { oethbVault, governor } = fixture;
      const tx = oethbVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Strategy not approved");
    });

    it("Should not whitelist if already whitelisted", async () => {
      const { oethbVault, governor } = fixture;

      await oethbVault.connect(governor).approveStrategy(addresses.dead);
      await oethbVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);

      const tx = oethbVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Already whitelisted");
    });

    it("Should revert when removing unwhitelisted strategy", async () => {
      const { oethbVault, governor } = fixture;

      const tx = oethbVault
        .connect(governor)
        .removeStrategyFromMintWhitelist(addresses.dead);
      await expect(tx).to.be.revertedWith("Not whitelisted");
    });

    describe("Disabled functions", function () {
      it("Should not support redeem", async () => {
        const { oethbVault, nick } = fixture;

        const tx = oethbVault.connect(nick).redeem(1, 0);
        await expect(tx).to.be.revertedWith(
          "Caller is not the Strategist or Governor"
        );
      });
    });
  });

  describe("Mint & Burn For Strategy", function () {
    let strategySigner, mockStrategy;

    beforeEach(async () => {
      fixture = await baseFixture();
      const { oethbVault, governor } = fixture;

      mockStrategy = await deployWithConfirmation("MockStrategy");

      await oethbVault.connect(governor).approveStrategy(mockStrategy.address);
      await oethbVault
        .connect(governor)
        .addStrategyToMintWhitelist(mockStrategy.address);
      strategySigner = await impersonateAndFund(mockStrategy.address);
    });

    it("Should allow a whitelisted strategy to mint and burn", async () => {
      const { oethbVault, oethb } = fixture;

      await oethbVault.rebase();

      const amount = oethUnits("1");

      const supplyBefore = await oethb.totalSupply();
      await oethbVault.connect(strategySigner).mintForStrategy(amount);
      expect(await oethb.balanceOf(mockStrategy.address)).to.eq(amount);
      expect(await oethb.totalSupply()).to.eq(supplyBefore.add(amount));

      await oethbVault.connect(strategySigner).burnForStrategy(amount);
      expect(await oethb.balanceOf(mockStrategy.address)).to.eq(0);
      expect(await oethb.totalSupply()).to.eq(supplyBefore);
    });

    it("Should not allow a non-supported strategy to mint", async () => {
      const { oethbVault, governor } = fixture;

      const amount = oethUnits("1");

      const tx = oethbVault.connect(governor).mintForStrategy(amount);
      await expect(tx).to.be.revertedWith("Unsupported strategy");
    });

    it("Should not allow a non-supported strategy to burn", async () => {
      const { oethbVault, governor } = fixture;

      const amount = oethUnits("1");

      const tx = oethbVault.connect(governor).burnForStrategy(amount);
      await expect(tx).to.be.revertedWith("Unsupported strategy");
    });

    it("Should not allow a non-white listed strategy to mint", async () => {
      const { oethbVault, governor } = fixture;

      // Pretend addresses.dead is a strategy
      await oethbVault.connect(governor).approveStrategy(addresses.dead);

      const amount = oethUnits("1");

      const tx = oethbVault
        .connect(await impersonateAndFund(addresses.dead))
        .mintForStrategy(amount);
      await expect(tx).to.be.revertedWith("Not whitelisted strategy");
    });

    it("Should not allow a non-white listed strategy to burn", async () => {
      const { oethbVault, governor } = fixture;

      // Pretend addresses.dead is a strategy
      await oethbVault.connect(governor).approveStrategy(addresses.dead);

      const amount = oethUnits("1");

      const tx = oethbVault
        .connect(await impersonateAndFund(addresses.dead))
        .burnForStrategy(amount);
      await expect(tx).to.be.revertedWith("Not whitelisted strategy");
    });
  });
});
