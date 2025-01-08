const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");

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
      dataBefore.oSonicTotalSupply.add(delta.oSonicTotalSupply)
    );
    expect(await oSonicVault.totalValue(), "Vault Total Value").to.equal(
      dataBefore.oSonicTotalValue.add(delta.oSonicTotalValue)
    );
    expect(
      await oSonicVault.checkBalance(wS.address),
      "Vault Check Balance of wS"
    ).to.equal(dataBefore.vaultCheckBalance.add(delta.vaultCheckBalance));
    expect(await oSonic.balanceOf(user.address), "user's OS balance").to.equal(
      dataBefore.userOSonic.add(delta.userOSonic)
    );
    expect(await wS.balanceOf(user.address), "user's wS balance").to.equal(
      dataBefore.userWS.add(delta.userWS)
    );
    expect(
      await wS.balanceOf(oSonicVault.address),
      "Vault wS balance"
    ).to.equal(dataBefore.vaultWS.add(delta.vaultWS));

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

  describe("Administer Sonic Staking Strategy", function () {
    beforeEach(async () => {
      fixture = await sonicFixture();
    });

    it("Should allow governor to set validator registrator", async () => {
      const { sonicStakingStrategy, governor } = fixture;

      // generate a wallet
      const newRegistrator = ethers.Wallet.createRandom();

      const tx = await sonicStakingStrategy
        .connect(governor)
        .setRegistrator(newRegistrator.address);

      await expect(tx)
        .to.emit(sonicStakingStrategy, "RegistratorChanged")
        .withArgs(newRegistrator.address);
      expect(await sonicStakingStrategy.validatorRegistrator()).to.eq(
        newRegistrator.address
      );
    });

    it("Should not allow set validator registrator by non-Governor", async () => {
      const { sonicStakingStrategy, strategist, nick, rafael } = fixture;

      for (const signer of [strategist, nick, rafael]) {
        await expect(
          sonicStakingStrategy.connect(signer).setRegistrator(signer.address)
        ).to.be.revertedWith("Caller is not the Governor");
      }
    });
  });
});
