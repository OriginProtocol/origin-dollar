const { expect } = require("chai");
const { formatUnits, parseUnits } = require("ethers/lib/utils");

const addresses = require("../../utils/addresses");
const { createFixtureLoader, oethDefaultFixture } = require("../_fixture");
const { isCI, oethUnits, advanceTime } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { logTxDetails } = require("../../utils/txLogger");

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
        oeth,
        woeth,
        oethHarvester,
      } = fixture;

      const oethContracts = [
        oethVault,
        oethDripper,
        convexEthMetaStrategy,
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
  });

  describe("user operations", () => {
    let oethWhaleSigner;
    const delayPeriod = 10 * 60; // 10 minutes
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

    it("should mint with WETH and allocate to strategy", async () => {
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

    it("should partially redeem 10 OETH", async () => {
      const { domen, oeth, oethVault, weth, matt } = fixture;
      await depositDiffInWeth(fixture, matt);

      expect(await oeth.balanceOf(oethWhaleAddress)).to.gt(10);

      const redeemAmount = parseUnits("10", 18);
      const minEth = parseUnits("9", 18);

      // Calculate how much to mint based on the WETH in the vault,
      // the withdrawal queue, and the WETH to be redeemed
      const wethBalance = await weth.balanceOf(oethVault.address);
      const queue = await oethVault.withdrawalQueueMetadata();
      const available = wethBalance.add(queue.claimed).sub(queue.queued);
      const mintAmount = redeemAmount.sub(available);
      if (mintAmount.gt(0)) {
        await weth.connect(domen).transfer(oethVault.address, mintAmount);
      }

      const tx = await oethVault
        .connect(oethWhaleSigner)
        .redeem(redeemAmount, minEth);

      await logTxDetails(tx, "redeem");

      await expect(tx)
        .to.emit(oethVault, "Redeem")
        .withNamedArgs({ _addr: oethWhaleAddress });
    });

    it("should request a withdraw by OETH whale", async () => {
      const { oeth, oethVault } = fixture;

      const oethWhaleBalance = await oeth.balanceOf(oethWhaleAddress);
      expect(oethWhaleBalance, "no longer an OETH whale").to.gt(
        parseUnits("100", 18)
      );
      const { nextWithdrawalIndex: requestId } =
        await oethVault.withdrawalQueueMetadata();

      const tx = await oethVault
        .connect(oethWhaleSigner)
        .requestWithdrawal(oethWhaleBalance);

      await expect(tx)
        .to.emit(oethVault, "WithdrawalRequested")
        .withNamedArgs({
          _withdrawer: await oethWhaleSigner.getAddress(),
          _amount: oethWhaleBalance,
          _requestId: requestId,
        });
    });
    it("should claim withdraw by a OETH whale", async () => {
      const { domen, oeth, oethVault, weth, matt } = fixture;

      let oethWhaleBalance = await oeth.balanceOf(oethWhaleAddress);
      await depositDiffInWeth(fixture, matt);
      // Calculate how much to mint based on the WETH in the vault,
      // the withdrawal queue, and the WETH to be withdrawn
      const wethBalance = await weth.balanceOf(oethVault.address);
      const queue = await oethVault.withdrawalQueueMetadata();
      const available = wethBalance.add(queue.claimed).sub(queue.queued);
      const mintAmount = oethWhaleBalance.sub(available);
      if (mintAmount.gt(0)) {
        await weth.connect(domen).transfer(oethVault.address, mintAmount);
      }

      expect(oethWhaleBalance, "no longer an OETH whale").to.gt(
        parseUnits("100", 18)
      );

      oethWhaleBalance = oethUnits("50");
      const { nextWithdrawalIndex: requestId } =
        await oethVault.withdrawalQueueMetadata();

      // First Request withdrawal
      await oethVault
        .connect(oethWhaleSigner)
        .requestWithdrawal(oethWhaleBalance);

      await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

      // Then Claim withdrawal
      const tx = await oethVault
        .connect(oethWhaleSigner)
        .claimWithdrawal(requestId);

      await expect(tx)
        .to.emit(oethVault, "WithdrawalClaimed")
        .withArgs(oethWhaleAddress, requestId, oethWhaleBalance);
    });
    it("OETH whale can redeem after withdraw from all strategies", async () => {
      const { oeth, oethVault, timelock, matt } = fixture;

      const oethWhaleBalance = await oeth.balanceOf(oethWhaleAddress);
      log(`OETH whale balance: ${formatUnits(oethWhaleBalance)}`);
      expect(oethWhaleBalance, "no longer an OETH whale").to.gt(
        parseUnits("1000", 18)
      );
      await depositDiffInWeth(fixture, matt);

      await oethVault.connect(timelock).withdrawAllFromStrategies();

      const { nextWithdrawalIndex: requestId } =
        await oethVault.withdrawalQueueMetadata();

      await oethVault
        .connect(oethWhaleSigner)
        .requestWithdrawal(oethWhaleBalance);
      await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
      await await oethVault.connect(oethWhaleSigner).claimWithdrawal(requestId);
    });
    it("Vault should have the right WETH address", async () => {
      const { oethVault } = fixture;

      expect((await oethVault.weth()).toLowerCase()).to.equal(
        addresses.mainnet.WETH.toLowerCase()
      );
    });
  });

  describe("operations", () => {
    it("should rebase", async function () {
      const { oethVault } = fixture;

      const tx = await oethVault.rebase();

      await logTxDetails(tx, "rebase");
    });
  });

  /**
   * Checks the difference between withdrawalQueueMetadata[0] and [2]
   * and deposits this diff in WETH.
   * @param {Object} fixture
   * @param {Object} depositor signer to perform the deposit
   */
  async function depositDiffInWeth(fixture, depositor) {
    const { oethVault, weth } = fixture;

    // Get withdrawalQueueMetadata[0] and [2]
    const metadata = await oethVault.withdrawalQueueMetadata();
    const queue = metadata.queued;
    const claimed = metadata.claimed;

    if (queue > claimed) {
      const diff = queue.sub(claimed).mul(110).div(100);
      await weth.connect(depositor).approve(oethVault.address, diff);
      return await oethVault.connect(depositor).mint(weth.address, diff, 0);
    }
    return null;
  }

  // We have migrated to simplified Harvester and this is no longer relevant
  // shouldHaveRewardTokensConfigured(() => ({
  //   vault: fixture.oethVault,
  //   harvester: fixture.oethHarvester,
  //   ignoreTokens: [fixture.weth.address.toLowerCase()],
  //   expectedConfigs: {
  //     [fixture.cvx.address]: {
  //       allowedSlippageBps: 300,
  //       harvestRewardBps: 200,
  //       swapPlatformAddr: "0xB576491F1E6e5E62f1d8F26062Ee822B40B0E0d4",
  //       doSwapRewardToken: true,
  //       swapPlatform: 3,
  //       liquidationLimit: oethUnits("2500"),
  //       curvePoolIndices: [1, 0],
  //     },
  //     [fixture.crv.address]: {
  //       allowedSlippageBps: 300,
  //       harvestRewardBps: 200,
  //       swapPlatformAddr: "0x4eBdF703948ddCEA3B11f675B4D1Fba9d2414A14",
  //       doSwapRewardToken: true,
  //       swapPlatform: 3,
  //       liquidationLimit: oethUnits("4000"),
  //       curvePoolIndices: [2, 1],
  //     },
  //   },
  // }));
});
