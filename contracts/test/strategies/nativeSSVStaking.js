const hre = require("hardhat");
const { expect } = require("chai");
const ethers = require("ethers");
const utils = ethers.utils;
const addresses = require("../../utils/addresses");

const { units, oethUnits, isCI } = require("../helpers");
const { shouldBehaveLikeGovernable } = require("../behaviour/governable");
const { shouldBehaveLikeHarvestable } = require("../behaviour/harvestable");
const { shouldBehaveLikeStrategy } = require("../behaviour/strategy");
const { MAX_UINT256 } = require("../../utils/constants");

const {
  createFixtureLoader,
  nativeStakingSSVStrategyFixture,
} = require("./../_fixture");
const { impersonateAndFund } = require("../../utils/signers");
const { setERC20TokenBalance } = require("../_fund");

const loadFixture = createFixtureLoader(nativeStakingSSVStrategyFixture);

describe.only("ForkTest: Native SSV Staking Strategy", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture;
  beforeEach(async () => {
    fixture = await loadFixture();
  });

  shouldBehaveLikeGovernable(() => ({
    ...fixture,
    strategy: fixture.nativeStakingSSVStrategy,
  }));

  shouldBehaveLikeHarvestable(() => ({
    ...fixture,
    harvester: fixture.oethHarvester,
    strategy: fixture.nativeStakingSSVStrategy,
  }));

  shouldBehaveLikeStrategy(() => ({
    ...fixture,
    strategy: fixture.nativeStakingSSVStrategy,
    assets: [fixture.weth],
    valueAssets: [],
    harvester: fixture.oethHarvester,
    vault: fixture.oethVault,
  }));

  describe("Initial setup", function () {
    it("Should not allow sending of ETH to the strategy via a transaction", async () => {
      const { nativeStakingSSVStrategy, strategist } = fixture;

      const signer = nativeStakingSSVStrategy.provider.getSigner(strategist.address);
      tx = {
          to: nativeStakingSSVStrategy.address,
          value: ethers.utils.parseEther('2', 'ether')
      };

      await expect(
        signer.sendTransaction(tx)
      ).to.be.revertedWith("function selector was not recognized and there's no fallback nor receive function");
    });

    it("SSV network should have allowance to spend SSV tokens of the strategy", async () => {
      const { nativeStakingSSVStrategy, ssv } = fixture;

      const ssvNetworkAddress = await nativeStakingSSVStrategy.SSV_NETWORK_ADDRESS();
      await expect(await ssv.allowance(nativeStakingSSVStrategy.address, ssvNetworkAddress)).to.equal(MAX_UINT256);
    });
  });

  describe("Configuring the strategy", function () {
    it("Governor should be able to change the registrator address", async () => {
      const { nativeStakingSSVStrategy, governor, strategist } = fixture;

      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .setRegistratorAddress(strategist.address);

      const events = (await tx.wait()).events || [];
      const RegistratorAddressChangedEvent = events.find((e) => e.event === "RegistratorAddressChanged");

      expect(RegistratorAddressChangedEvent).to.not.be.undefined;
      expect(RegistratorAddressChangedEvent.event).to.equal("RegistratorAddressChanged");
      expect(RegistratorAddressChangedEvent.args[0]).to.equal(addresses.zero);
      expect(RegistratorAddressChangedEvent.args[1]).to.equal(strategist.address);
    });

    it("Non governor should not be able to change the registrator address", async () => {
      const { nativeStakingSSVStrategy, governor, strategist } = fixture;

      await expect(nativeStakingSSVStrategy
        .connect(strategist)
        .setRegistratorAddress(strategist.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Non governor should not be able to update the fuse intervals", async () => {
      const { nativeStakingSSVStrategy, governor, strategist } = fixture;

      await expect(nativeStakingSSVStrategy
        .connect(strategist)
        .setFuseInterval(utils.parseEther("21.6"), utils.parseEther("25.6"))
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Fuse interval start needs to be larger than fuse end", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      await expect(nativeStakingSSVStrategy
        .connect(governor)
        .setFuseInterval(utils.parseEther("25.6"), utils.parseEther("21.6"))
      ).to.be.revertedWith("FuseIntervalValuesIncorrect");
    });

    it("There should be at least 4 ETH between interval start and interval end", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      await expect(nativeStakingSSVStrategy
        .connect(governor)
        .setFuseInterval(utils.parseEther("21.6"), utils.parseEther("25.5"))
      ).to.be.revertedWith("FuseIntervalValuesIncorrect");
    });

    it("Revert when fuse intervals are larger than 32 ether", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      await expect(nativeStakingSSVStrategy
        .connect(governor)
        .setFuseInterval(utils.parseEther("32.1"), utils.parseEther("32.1"))
      ).to.be.revertedWith("FuseIntervalValuesIncorrect");
    });

    it("Governor should be able to change the registrator address", async () => {
      const { nativeStakingSSVStrategy, governor } = fixture;

      const fuseStartBn = utils.parseEther("21.6");
      const fuseEndBn = utils.parseEther("25.6");

      const tx = await nativeStakingSSVStrategy
        .connect(governor)
        .setFuseInterval(fuseStartBn, fuseEndBn);

      const events = (await tx.wait()).events || [];
      const FuseIntervalUpdated = events.find((e) => e.event === "FuseIntervalUpdated");

      expect(FuseIntervalUpdated).to.not.be.undefined;
      expect(FuseIntervalUpdated.event).to.equal("FuseIntervalUpdated");
      expect(FuseIntervalUpdated.args[0]).to.equal(addresses.zero); // prev fuse start
      expect(FuseIntervalUpdated.args[1]).to.equal(addresses.zero); // prev fuse end
      expect(FuseIntervalUpdated.args[2]).to.equal(fuseStartBn); // fuse start
      expect(FuseIntervalUpdated.args[3]).to.equal(fuseEndBn); // fuse end
    });
  });

  describe("Deposit/Allocation", function () {
    
  });

  describe("Withdraw", function () {
   
  });

  describe("Balance/Assets", function () {
  });
});
