const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { defaultSonicFixture } = require("./../_fixture-sonic");
const { isCI } = require("./../helpers");
const { impersonateAndFund } = require("../../utils/signers");

describe("ForkTest: Sonic Vault", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await defaultSonicFixture();
  });

  describe("View functions", () => {
    // These tests use a transaction to call a view function so the gas usage can be reported.
    it("Should get total value", async () => {
      const { nick, oSonicVault } = fixture;

      const tx = await oSonicVault
        .connect(nick)
        .populateTransaction.totalValue();
      await nick.sendTransaction(tx);
    });
    it("Should check asset balances", async () => {
      const { wS, nick, oSonicVault } = fixture;

      const tx = await oSonicVault
        .connect(nick)
        .populateTransaction.checkBalance(wS.address);
      await nick.sendTransaction(tx);
    });
  });

  describe("Admin", () => {
    it("Should have the correct governor address set", async () => {
      const { oSonicVault } = fixture;
      expect(await oSonicVault.governor()).to.equal(addresses.sonic.admin);
    });

    it("Should have the correct strategist address set", async () => {
      const { strategist, oSonicVault } = fixture;
      expect(await oSonicVault.strategistAddr()).to.equal(
        await strategist.getAddress()
      );
    });

    it("Should have supported assets", async () => {
      const { oSonicVault } = fixture;
      const assets = await oSonicVault.getAllAssets();
      expect(assets).to.have.length(1);
      expect(assets).to.include(addresses.sonic.wS);

      expect(await oSonicVault.isSupportedAsset(addresses.sonic.wS)).to.be.true;
    });
  });

  describe("Rebase", () => {
    it(`Shouldn't be paused`, async () => {
      const { oSonicVault } = fixture;
      expect(await oSonicVault.rebasePaused()).to.be.false;
    });

    it(`Should rebase`, async () => {
      const { oSonicVault } = fixture;
      await oSonicVault.rebase();
    });
  });

  describe("Capital", () => {
    it(`Shouldn't be paused`, async () => {
      const { oSonicVault } = fixture;
      expect(await oSonicVault.capitalPaused()).to.be.false;
    });

    it("Should allow to mint w/ Wrapped S (wS)", async () => {
      const { oSonic, oSonicVault, nick, wS } = fixture;
      const balancePreMint = await oSonic
        .connect(nick)
        .balanceOf(nick.getAddress());
      await oSonicVault.connect(nick).mint(wS.address, parseUnits("1000"), 0);

      const balancePostMint = await oSonic
        .connect(nick)
        .balanceOf(nick.getAddress());

      const balanceDiff = balancePostMint.sub(balancePreMint);
      expect(balanceDiff).to.approxEqualTolerance(parseUnits("1000"), 1);
    });

    it.skip("should deposit to and withdraw from staking strategy", async () => {
      const { oSonicVault, nick, wS, sonicStakingStrategy } = fixture;
      await oSonicVault.connect(nick).mint(wS.address, parseUnits("1000"), 0);
      const strategistSigner = await impersonateAndFund(
        await oSonicVault.strategistAddr()
      );

      await oSonicVault
        .connect(strategistSigner)
        .depositToStrategy(
          sonicStakingStrategy.address,
          [wS.address],
          [parseUnits("1000")]
        );

      await oSonicVault
        .connect(strategistSigner)
        .withdrawFromStrategy(
          sonicStakingStrategy.address,
          [wS.address],
          [parseUnits("1000")]
        );
    });

    it("Should have vault buffer disabled", async () => {
      const { oSonicVault } = fixture;
      expect(await oSonicVault.vaultBuffer()).to.equal("0");
    });
  });
});
