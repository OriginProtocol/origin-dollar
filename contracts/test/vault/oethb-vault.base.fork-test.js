const { createFixtureLoader } = require("../_fixture");
const { defaultBaseFixture } = require("../_fixture-base");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { oethUnits } = require("../helpers");
const { deployWithConfirmation } = require("../../utils/deploy");

const baseFixture = createFixtureLoader(defaultBaseFixture);

describe("ForkTest: OETHb Vault", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await baseFixture();
  });

  describe("Mint & Permissioned redeems", function () {
    async function _mint(signer) {
      const { weth, oethbVault } = fixture;
      await weth.connect(signer).deposit({ value: oethUnits("1") });
      await weth.connect(signer).approve(oethbVault.address, oethUnits("1"));
      await oethbVault.connect(signer).mint(weth.address, oethUnits("1"), "0");
    }

    it("Should allow anyone to mint", async () => {
      const { nick, weth, oethb, oethbVault } = fixture;

      // issue a pre-mint so that Dripper collect gets called so next mint
      // doesn't include dripper funds
      await _mint(nick);
      await oethbVault.rebase();

      const vaultBalanceBefore = await weth.balanceOf(oethbVault.address);
      const userBalanceBefore = await oethb.balanceOf(nick.address);
      const totalSupplyBefore = await oethb.totalSupply();

      await _mint(nick);

      const vaultBalanceAfter = await weth.balanceOf(oethbVault.address);
      const userBalanceAfter = await oethb.balanceOf(nick.address);
      const totalSupplyAfter = await oethb.totalSupply();

      expect(totalSupplyAfter).to.approxEqual(
        totalSupplyBefore.add(oethUnits("1"))
      );
      expect(userBalanceAfter).to.approxEqual(
        userBalanceBefore.add(oethUnits("1"))
      );
      expect(vaultBalanceAfter).to.approxEqualTolerance(
        vaultBalanceBefore.add(oethUnits("1")),
        0.1
      );
    });

    it("Should allow only Strategist to redeem", async () => {
      const { strategist, oethbVault, oethb, weth } = fixture;

      await oethbVault.rebase();
      await _mint(strategist);

      const vaultBalanceBefore = await weth.balanceOf(oethbVault.address);
      const userBalanceBefore = await oethb.balanceOf(strategist.address);
      const totalSupplyBefore = await oethb.totalSupply();

      await oethbVault.connect(strategist).redeem(oethUnits("1"), "0");

      const vaultBalanceAfter = await weth.balanceOf(oethbVault.address);
      const userBalanceAfter = await oethb.balanceOf(strategist.address);
      const totalSupplyAfter = await oethb.totalSupply();

      expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(oethUnits("1")));
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(oethUnits("1")));
      expect(vaultBalanceAfter).to.equal(
        vaultBalanceBefore.sub(oethUnits("1"))
      );
    });

    it("Should allow only Governor to redeem", async () => {
      const { governor, oethbVault, oethb, weth } = fixture;

      await oethbVault.rebase();
      await _mint(governor);

      const vaultBalanceBefore = await weth.balanceOf(oethbVault.address);
      const userBalanceBefore = await oethb.balanceOf(governor.address);
      const totalSupplyBefore = await oethb.totalSupply();

      await oethbVault.connect(governor).redeem(oethUnits("1"), "0");

      const vaultBalanceAfter = await weth.balanceOf(oethbVault.address);
      const userBalanceAfter = await oethb.balanceOf(governor.address);
      const totalSupplyAfter = await oethb.totalSupply();

      expect(totalSupplyAfter).to.equal(totalSupplyBefore.sub(oethUnits("1")));
      expect(userBalanceAfter).to.equal(userBalanceBefore.sub(oethUnits("1")));
      expect(vaultBalanceAfter).to.equal(
        vaultBalanceBefore.sub(oethUnits("1"))
      );
    });

    it("No one else can redeem", async () => {
      const { rafael, nick, oethbVault } = fixture;

      await oethbVault.rebase();

      for (const signer of [rafael, nick]) {
        await _mint(signer);
        await expect(
          oethbVault.connect(signer).redeem(oethUnits("1"), "0")
        ).to.be.revertedWith("Caller is not the Strategist or Governor");
      }
    });
  });

  describe("Async withdrawals", function () {
    it("Should be disabled", async () => {
      const { oethbVault, nick } = fixture;

      let tx = oethbVault.connect(nick).requestWithdrawal(oethUnits("1"));

      await expect(tx).to.be.revertedWith("Async withdrawals disabled");

      tx = oethbVault.connect(nick).claimWithdrawal(oethUnits("1"));

      await expect(tx).to.be.revertedWith("Async withdrawals disabled");

      tx = oethbVault.connect(nick).claimWithdrawals([oethUnits("1")]);

      await expect(tx).to.be.revertedWith("Async withdrawals disabled");
    });
  });

  describe("Mint Whitelist", function () {
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
  });

  describe("Mint & Burn For Strategy", function () {
    let strategySigner, mockStrategy;

    beforeEach(async () => {
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
