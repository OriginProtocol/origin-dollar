const { expect } = require("chai");
const { parseUnits } = require("ethers/lib/utils");
const hhHelpers = require("@nomicfoundation/hardhat-network-helpers");
const { BigNumber } = require("ethers");

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
      expect(await oSonicVault.governor()).to.equal(addresses.sonic.timelock);
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

    it("Should call safeApproveAllTokens", async () => {
      const { sonicStakingStrategy, timelock } = fixture;
      await sonicStakingStrategy.connect(timelock).safeApproveAllTokens();
    });

    it("Should have trusteeFeeBps set to 10%", async () => {
      const { oSonicVault } = fixture;
      expect(await oSonicVault.trusteeFeeBps()).to.equal(
        BigNumber.from("1000")
      );
    });

    it("Should trustee set to the multichain buyback operator", async () => {
      const { oSonicVault } = fixture;
      expect(await oSonicVault.trusteeAddress()).to.equal(
        addresses.multichainBuybackOperator
      );
    });

    it("Should have redeem fee set to 0.1%", async () => {
      const { oSonicVault } = fixture;
      expect(await oSonicVault.redeemFeeBps()).to.equal(BigNumber.from("10"));
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

    it.skip("should automatically deposit to staking strategy", async () => {
      const { oSonicVault, nick, wS, sonicStakingStrategy } = fixture;

      // Clear any wS out of the Vault first
      await oSonicVault.allocate();

      const mintAmount = parseUnits("5000000");
      const tx = await oSonicVault
        .connect(nick)
        .mint(wS.address, mintAmount, 0);

      // Check mint event
      await expect(tx)
        .to.emit(oSonicVault, "Mint")
        .withArgs(nick.address, mintAmount);

      // check 99.5% is deposited to staking strategy
      await expect(tx).to.emit(sonicStakingStrategy, "Deposit");
    });

    it("should withdraw from staking strategy", async () => {
      const { oSonicVault, nick, wS, sonicStakingStrategy } = fixture;

      const depositAmount = parseUnits("2000");
      await oSonicVault.connect(nick).mint(wS.address, depositAmount, 0);
      const strategistSigner = await impersonateAndFund(
        await oSonicVault.strategistAddr()
      );

      // Simulate undelegate and withdraw from validator by transferring wS to the strategy
      const withdrawAmount = parseUnits("1500");
      await wS
        .connect(nick)
        .transfer(sonicStakingStrategy.address, withdrawAmount);

      const tx = await oSonicVault
        .connect(strategistSigner)
        .withdrawFromStrategy(
          sonicStakingStrategy.address,
          [wS.address],
          [withdrawAmount]
        );

      await expect(tx)
        .emit(sonicStakingStrategy, "Withdrawal")
        .withArgs(wS.address, addresses.zero, withdrawAmount);
    });

    it("should call withdraw all from staking strategy even if all delegated", async () => {
      const { oSonicVault, nick, wS, sonicStakingStrategy } = fixture;

      const depositAmount = parseUnits("2000");
      await oSonicVault.connect(nick).mint(wS.address, depositAmount, 0);
      const strategistSigner = await impersonateAndFund(
        await oSonicVault.strategistAddr()
      );

      const tx = await oSonicVault
        .connect(strategistSigner)
        .withdrawAllFromStrategy(sonicStakingStrategy.address);

      await expect(tx).not.emit(sonicStakingStrategy, "Withdrawal");
    });

    it("should call withdraw all from staking strategy with wrapped S in it", async () => {
      const { oSonicVault, nick, wS, sonicStakingStrategy } = fixture;
      const depositAmount = parseUnits("2000");
      await oSonicVault.connect(nick).mint(wS.address, depositAmount, 0);
      const strategistSigner = await impersonateAndFund(
        await oSonicVault.strategistAddr()
      );

      // Simulate undelegate and withdraw from validator by transferring wS to the strategy
      const withdrawAmount = parseUnits("1500");
      await wS
        .connect(nick)
        .transfer(sonicStakingStrategy.address, withdrawAmount);

      const tx = await oSonicVault
        .connect(strategistSigner)
        .withdrawAllFromStrategy(sonicStakingStrategy.address);

      await expect(tx)
        .emit(sonicStakingStrategy, "Withdrawal")
        .withArgs(wS.address, addresses.zero, withdrawAmount);
    });

    it("should call withdraw all from staking strategy with native S in it", async () => {
      const { oSonicVault, nick, wS, sonicStakingStrategy } = fixture;
      const depositAmount = parseUnits("2000");
      await oSonicVault.connect(nick).mint(wS.address, depositAmount, 0);
      const strategistSigner = await impersonateAndFund(
        await oSonicVault.strategistAddr()
      );

      // Add some native S
      const withdrawAmount = parseUnits("500");
      await hhHelpers.setBalance(sonicStakingStrategy.address, withdrawAmount);

      const tx = await oSonicVault
        .connect(strategistSigner)
        .withdrawAllFromStrategy(sonicStakingStrategy.address);

      await expect(tx)
        .emit(sonicStakingStrategy, "Withdrawal")
        .withArgs(wS.address, addresses.zero, withdrawAmount);
    });

    it("Should have vault buffer set", async () => {
      const { oSonicVault } = fixture;
      expect(await oSonicVault.vaultBuffer()).to.equal(
        parseUnits("0.005", 18) // 0.5%
      );
    });
  });
});
