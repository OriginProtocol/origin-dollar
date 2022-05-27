const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");

const { loadFixture, isFork, advanceTime } = require("../helpers");

describe("Pauser", async () => {
  if (isFork) {
    this.timeout(0);
  }

  describe("Whitelist Management", () => {
    it("Others cannot add to or remove from whitelist", async () => {
      const { anna, matt, pauser } = await loadFixture(defaultFixture);
      await expect(
        pauser.connect(matt).addToWhitelist(anna.address)
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
      await expect(
        pauser.connect(matt).removeFromWhitelist(anna.address)
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });

    it("Governor can add to and remove from whitelist", async () => {
      const { anna, governor, pauser } = await loadFixture(defaultFixture);
      await expect(pauser.connect(governor).addToWhitelist(anna.address))
        .to.emit(pauser, "Whitelisted")
        .withArgs(anna.address);
      expect(await pauser.connect(anna).whitelist(anna.address)).to.be.true;
      await expect(pauser.connect(governor).removeFromWhitelist(anna.address))
        .to.emit(pauser, "DeWhitelisted")
        .withArgs(anna.address);
      expect(await pauser.connect(anna).whitelist(anna.address)).to.be.false;
    });

    it("Strategist can add to and remove from whitelist", async () => {
      const { anna, strategist, pauser } = await loadFixture(defaultFixture);
      await expect(pauser.connect(strategist).addToWhitelist(anna.address))
        .to.emit(pauser, "Whitelisted")
        .withArgs(anna.address);
      expect(await pauser.connect(anna).whitelist(anna.address)).to.be.true;
      await expect(pauser.connect(strategist).removeFromWhitelist(anna.address))
        .to.emit(pauser, "DeWhitelisted")
        .withArgs(anna.address);
      expect(await pauser.connect(anna).whitelist(anna.address)).to.be.false;
    });
  });

  describe("Temporary Pausing", () => {
    it("Others cannot temp-pause", async () => {
      const { anna, pauser } = await loadFixture(defaultFixture);

      await expect(pauser.connect(anna).tempPause()).to.be.revertedWith(
        "Caller is not whitelisted and is not the Strategist or Governor"
      );
    });

    it("Cannot temp-pause if already paused", async () => {
      const { anna, matt, strategist, pauser } = await loadFixture(
        defaultFixture
      );
      await pauser.connect(strategist).addToWhitelist(anna.address);
      await pauser.connect(strategist).addToWhitelist(matt.address);
      await pauser.connect(matt).tempPause();

      await expect(pauser.connect(anna).tempPause()).to.be.revertedWith(
        "Contract is not unpaused"
      );
    });

    it("Whitelisted user can temp-pause only once", async () => {
      const { anna, strategist, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).addToWhitelist(anna.address);
      await expect(pauser.connect(anna).tempPause()).to.emit(
        pauser,
        "TempPaused"
      );

      await pauser.connect(strategist).unpause();
      await expect(pauser.connect(anna).tempPause()).to.be.revertedWith(
        "Caller has already initiated a temp pause"
      );
    });

    it("Governor can temp-pause any number of times", async () => {
      const { governor, pauser } = await loadFixture(defaultFixture);
      await expect(pauser.connect(governor).tempPause()).to.emit(
        pauser,
        "TempPaused"
      );

      await pauser.connect(governor).unpause();
      await expect(pauser.connect(governor).tempPause()).to.emit(
        pauser,
        "TempPaused"
      );
    });

    it("Strategist can temp-pause any number of times", async () => {
      const { strategist, pauser } = await loadFixture(defaultFixture);
      await expect(pauser.connect(strategist).tempPause()).to.emit(
        pauser,
        "TempPaused"
      );

      await pauser.connect(strategist).unpause();
      await expect(pauser.connect(strategist).tempPause()).to.emit(
        pauser,
        "TempPaused"
      );
    });

    it("Temp-pausing pauses underlying contract", async () => {
      const { anna, strategist, pauser, vault } = await loadFixture(
        defaultFixture
      );
      // We use a whitelisted user with a pauser configured for Vault for this test
      await pauser.connect(strategist).addToWhitelist(anna.address);
      await expect(await pauser.connect(anna).tempPause()).to.emit(
        pauser,
        "TempPaused"
      );

      // Contract state should be temp-pause
      expect(await pauser.pauseState()).to.eq(await pauser.TEMP_PAUSE());

      // Pauser expiry should match current expiry
      expect(await pauser.pauseExpiry(anna.address)).to.eq(
        await pauser.currentExpiry()
      );

      // Vault pausing should update values
      expect(await vault.paused()).to.be.true;
    });
  });

  describe("Pause Confirmation", () => {
    it("Others cannot confirm pause", async () => {
      const { anna, matt, strategist, pauser } = await loadFixture(
        defaultFixture
      );
      await pauser.connect(strategist).addToWhitelist(anna.address);
      await pauser.connect(anna).tempPause();

      await expect(pauser.connect(matt).confirmPause()).to.be.revertedWith(
        "Caller is not the Strategist or Governor"
      );
    });

    it("Whitelisted cannot confirm pause", async () => {
      const { anna, matt, strategist, pauser } = await loadFixture(
        defaultFixture
      );
      await pauser.connect(strategist).addToWhitelist(anna.address);
      await pauser.connect(strategist).addToWhitelist(matt.address);
      await pauser.connect(anna).tempPause();

      await expect(pauser.connect(matt).confirmPause()).to.be.revertedWith(
        "Caller is not the Strategist or Governor"
      );
    });

    it("Governor can confirm pause", async () => {
      const { anna, governor, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(governor).addToWhitelist(anna.address);
      await pauser.connect(anna).tempPause();
      await pauser.connect(governor).confirmPause();
    });

    it("Strategist can confirm pause", async () => {
      const { anna, strategist, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).addToWhitelist(anna.address);
      await pauser.connect(anna).tempPause();
      await pauser.connect(strategist).confirmPause();
    });

    it("Contract must be temp-paused to confirm pause", async () => {
      const { strategist, pauser } = await loadFixture(defaultFixture);
      await expect(
        pauser.connect(strategist).confirmPause()
      ).to.be.revertedWith("The contract is not temp-paused");
    });

    it("Should update pause state on confirmation and reset expiry", async () => {
      const { strategist, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).tempPause();
      await expect(pauser.connect(strategist).confirmPause()).to.emit(
        pauser,
        "Paused"
      );
      expect(await pauser.currentExpiry()).to.eq(0);
      expect(await pauser.pauseState()).to.eq(await pauser.PAUSED());
    });
  });

  describe("Temp-Pause Expiration", () => {
    it("Others cannot cancel temp-pause", async () => {
      const { anna, matt, strategist, pauser } = await loadFixture(
        defaultFixture
      );
      await pauser.connect(strategist).addToWhitelist(anna.address);
      await pauser.connect(anna).tempPause();

      await expect(pauser.connect(matt).cancelTempPause()).to.be.revertedWith(
        "Caller is not whitelisted and is not the Strategist or Governor"
      );
    });

    it("Whitelisted can cancel expired pause", async () => {
      const { anna, governor, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(governor).addToWhitelist(anna.address);
      await pauser.connect(anna).tempPause();

      const expiryDuration = await pauser.expiryDuration();
      await advanceTime(expiryDuration.add(1).toNumber());
      await pauser.connect(anna).cancelTempPause();
    });

    it("Governor can cancel expired pause", async () => {
      const { anna, governor, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(governor).addToWhitelist(anna.address);
      await pauser.connect(anna).tempPause();

      const expiryDuration = await pauser.expiryDuration();
      await advanceTime(expiryDuration.add(1).toNumber());
      await pauser.connect(governor).cancelTempPause();
    });

    it("Strategist can cancel expired pause", async () => {
      const { anna, strategist, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).addToWhitelist(anna.address);
      await pauser.connect(anna).tempPause();

      const expiryDuration = await pauser.expiryDuration();
      await advanceTime(expiryDuration.add(1).toNumber());
      await pauser.connect(strategist).cancelTempPause();
    });

    it("Contract must be temp-paused to cancel pause", async () => {
      const { strategist, pauser } = await loadFixture(defaultFixture);
      await expect(
        pauser.connect(strategist).cancelTempPause()
      ).to.be.revertedWith("The contract is not temp-paused");
    });

    it("Temp-pause must be expired to cancel pause", async () => {
      const { anna, strategist, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).addToWhitelist(anna.address);
      await pauser.connect(anna).tempPause();
      await expect(
        pauser.connect(strategist).cancelTempPause()
      ).to.be.revertedWith("The current pause is not expired");
    });

    it("Should unpause underlying contract on cancellation", async () => {
      const { strategist, pauser, vault } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).tempPause();
      expect(await vault.paused()).to.be.true;

      const expiryDuration = await pauser.expiryDuration();
      await advanceTime(expiryDuration.add(1).toNumber());
      await expect(pauser.connect(strategist).cancelTempPause()).to.emit(
        pauser,
        "Unpaused"
      );
      expect(await pauser.currentExpiry()).to.eq(0);
      expect(await pauser.pauseState()).to.eq(await pauser.UNPAUSED());
      expect(await vault.paused()).to.be.false;
      expect(await vault.paused()).to.be.false;
    });
  });

  describe("Direct Pausing", () => {
    it("Others cannot direct-pause", async () => {
      const { matt, pauser } = await loadFixture(defaultFixture);
      await expect(pauser.connect(matt).pause()).to.be.revertedWith(
        "Caller is not the Strategist or Governor"
      );
    });
    it("Governor can direct-pause", async () => {
      const { governor, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(governor).pause();
    });
    it("Strategist can direct-pause", async () => {
      const { strategist, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).pause();
    });
    it("Cannot pause if already paused", async () => {
      const { strategist, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).pause();
      await expect(pauser.connect(strategist).pause()).to.be.revertedWith(
        "Contract is already paused"
      );
    });
    it("Should pause underlying contract", async () => {
      const { strategist, pauser, vault } = await loadFixture(defaultFixture);
      await expect(pauser.connect(strategist).pause()).to.emit(
        pauser,
        "Paused"
      );
      expect(await pauser.currentExpiry()).to.eq(0);
      expect(await pauser.pauseState()).to.eq(await pauser.PAUSED());
      expect(await vault.paused()).to.be.true;
    });
  });

  describe("Direct Unpausing", () => {
    it("Others cannot direct-unpause", async () => {
      const { matt, pauser } = await loadFixture(defaultFixture);
      await expect(pauser.connect(matt).unpause()).to.be.revertedWith(
        "Caller is not the Strategist or Governor"
      );
    });
    it("Governor can direct-unpause", async () => {
      const { governor, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(governor).pause();
      await pauser.connect(governor).unpause();
    });
    it("Strategist can direct-unpause", async () => {
      const { strategist, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).pause();
      await pauser.connect(strategist).unpause();
    });
    it("Cannot unpause if already unpaused", async () => {
      const { strategist, pauser } = await loadFixture(defaultFixture);
      await pauser.connect(strategist).pause();
      await pauser.connect(strategist).unpause();
      await expect(pauser.connect(strategist).unpause()).to.be.revertedWith(
        "Contract is already unpaused"
      );
    });
    it("Should unpause underlying contract", async () => {
      const { strategist, pauser, vault } = await loadFixture(defaultFixture);
      pauser.connect(strategist).pause();
      expect(await vault.paused()).to.be.true;

      await expect(pauser.connect(strategist).unpause()).to.emit(
        pauser,
        "Unpaused"
      );
      expect(await pauser.currentExpiry()).to.eq(0);
      expect(await pauser.pauseState()).to.eq(await pauser.UNPAUSED());
      expect(await vault.paused()).to.be.false;
      expect(await vault.paused()).to.be.false;
    });
  });

  describe("Pauser configuration", () => {
    it("Others cannot set expiry duration", async () => {
      const { anna, pauser } = await loadFixture(defaultFixture);
      const expiryDuration = 24 * 3600;
      await expect(
        pauser.connect(anna).setExpiryDuration(expiryDuration)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Governor can update expiry duration", async () => {
      const { governor, pauser } = await loadFixture(defaultFixture);
      const expiryDuration = 24 * 3600;
      await expect(pauser.connect(governor).setExpiryDuration(expiryDuration))
        .to.emit(pauser, "ExpiryDurationChanged")
        .withArgs(expiryDuration);
    });

    it("Others cannot set pausable", async () => {
      const { anna, matt, pauser } = await loadFixture(defaultFixture);
      // pretend that matt's address is the pausable address
      const pausable = matt.address;
      await expect(
        pauser.connect(anna).setPausable(pausable)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Governor can set pausable", async () => {
      const { governor, matt, pauser } = await loadFixture(defaultFixture);
      // pretend that matt's address is the pausable address
      const pausable = matt.address;
      await expect(pauser.connect(governor).setPausable(pausable))
        .to.emit(pauser, "PausableChanged")
        .withArgs(pausable);
    });

    it("Others cannot set strategist address", async () => {
      const { anna, matt, pauser } = await loadFixture(defaultFixture);
      await expect(
        pauser.connect(anna).setStrategistAddr(matt.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Governor can set strategist address", async () => {
      const { governor, matt, pauser } = await loadFixture(defaultFixture);
      await expect(pauser.connect(governor).setStrategistAddr(matt.address))
        .to.emit(pauser, "StrategistChanged")
        .withArgs(matt.address);
    });
  });
});
