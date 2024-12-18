const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers");
const { oethUnits } = require("../helpers");
const { deployWithConfirmation } = require("../../utils/deploy");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("Origin S Vault", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await sonicFixture();
  });

  const snapData = async (fixture) => {
    const { oSonic, oSonicVault, wS, user } = fixture;

    const oSonicTotalSupply = await oSonic.totalSupply();
    const oSonicTotalValue = await oSonicVault.totalValue();
    const vaultCheckBalance = await oSonicVault.checkBalance(wS.address);
    const userOSonic = await oSonic.balanceOf(user.address);
    const userWS = await wS.balanceOf(user.address);
    const vaultWS = await wS.balanceOf(oSonicVault.address);
    const queue = await oSonicVault.withdrawalQueueMetadata();

    return {
      oSonicTotalSupply,
      oSonicTotalValue,
      vaultCheckBalance,
      userOSonic,
      userWS,
      vaultWS,
      queue,
    };
  };

  const assertChangedData = async (dataBefore, delta, fixture) => {
    const { oSonic, oSonicVault, wS, user } = fixture;

    expect(await oSonic.totalSupply(), "OSonic Total Supply").to.equal(
      dataBefore.oethTotalSupply.add(delta.oethTotalSupply)
    );
    expect(await oSonicVault.totalValue(), "Vault Total Value").to.equal(
      dataBefore.oethTotalValue.add(delta.oethTotalValue)
    );
    expect(
      await oSonicVault.checkBalance(wS.address),
      "Vault Check Balance of wS"
    ).to.equal(dataBefore.vaultCheckBalance.add(delta.vaultCheckBalance));
    expect(await oSonic.balanceOf(user.address), "user's OS balance").to.equal(
      dataBefore.userOeth.add(delta.userOeth)
    );
    expect(await wS.balanceOf(user.address), "user's wS balance").to.equal(
      dataBefore.userWeth.add(delta.userWeth)
    );
    expect(
      await wS.balanceOf(oSonicVault.address),
      "Vault wS balance"
    ).to.equal(dataBefore.vaultWeth.add(delta.vaultWeth));

    const queueAfter = await oSonicVault.withdrawalQueueMetadata();
    expect(queueAfter.queued, "Queued").to.equal(
      dataBefore.queue.queued.add(delta.queued)
    );
    expect(queueAfter.claimable, "Claimable").to.equal(
      dataBefore.queue.claimable.add(delta.claimable)
    );
    expect(queueAfter.claimed, "Claimed").to.equal(
      dataBefore.queue.claimed.add(delta.claimed)
    );
    expect(queueAfter.nextWithdrawalIndex, "nextWithdrawalIndex").to.equal(
      dataBefore.queue.nextWithdrawalIndex.add(delta.nextWithdrawalIndex)
    );
  };

  describe("Mint", () => {
    it("Should mint with wS", async () => {
      const { oSonicVault, wS, nick } = fixture;

      const fixtureWithUser = { ...fixture, user: nick };
      const dataBefore = await snapData(fixtureWithUser);

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      await wS.connect(nick).approve(oSonicVault.address, amount);

      const tx = await oSonicVault
        .connect(nick)
        .mint(wS.address, amount, minOeth);

      await expect(tx)
        .to.emit(oSonicVault, "Mint")
        .withArgs(nick.address, amount);

      await assertChangedData(
        dataBefore,
        {
          oSonicTotalSupply: amount,
          oSonicTotalValue: amount,
          vaultCheckBalance: amount,
          userOSonic: amount,
          userWS: amount.mul(-1),
          vaultWS: amount,
          queued: 0,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });
  });

  describe("Mint Whitelist", function () {
    beforeEach(async () => {
      fixture = await sonicFixture();
    });

    it("Should allow a strategy to be added to the whitelist", async () => {
      const { oSonicVault, governor } = fixture;

      // Pretend addresses.dead is a strategy
      await oSonicVault.connect(governor).approveStrategy(addresses.dead);

      const tx = oSonicVault
        .connect(governor)
        .addStrategyToMintWhitelist(addresses.dead);

      await expect(tx).to.emit(oSonicVault, "StrategyAddedToMintWhitelist");
      expect(await oSonicVault.isMintWhitelistedStrategy(addresses.dead)).to.be
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
      fixture = await sonicFixture();
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
