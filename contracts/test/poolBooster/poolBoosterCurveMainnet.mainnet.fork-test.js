const { expect } = require("chai");
const hre = require("hardhat");

const addresses = require("../../utils/addresses");
const { isCI } = require("../helpers");

const { loadDefaultFixture } = require("../_fixture");
const { ethers } = require("ethers");

const gauge = "0x92d956C1F89a2c71efEEB4Bac45d02016bdD2408";

describe("ForkTest: PoolBoosterFactoryCurveMainnet", function () {
  this.timeout(0);

  // Retry up to 3 times on CI
  this.retries(isCI ? 3 : 0);

  let fixture, poolBoosterFactoryCurveMainnet, oeth;

  beforeEach(async () => {
    fixture = await loadDefaultFixture();
    poolBoosterFactoryCurveMainnet = fixture.poolBoosterFactoryCurveMainnet;
    oeth = fixture.oeth;
  });

  async function deployAndInitializePoolBooster(gauge, oethAddress, version) {
    const poolBoosterCurveMainnet =
      await poolBoosterFactoryCurveMainnet.deployAndInitPoolBooster(
        gauge,
        oethAddress,
        version
      );
    const resp = await poolBoosterCurveMainnet.wait();
    const address = resp.logs[0].address;
    return await hre.ethers.getContractAt("PoolBoosterCurveMainnet", address);
  }

  // --- Initialization ---
  describe("Factory", async () => {
    it("Should have correct params", async () => {
      expect(await poolBoosterFactoryCurveMainnet.version()).to.equal(1);
      expect(await poolBoosterFactoryCurveMainnet.targetChainId()).to.equal(
        42161
      );
      expect(
        await poolBoosterFactoryCurveMainnet.centralRegistry()
      ).to.not.equal(ethers.constants.AddressZero);
      expect(await poolBoosterFactoryCurveMainnet.governor()).to.equal(
        addresses.mainnet.Timelock
      );
      expect(await poolBoosterFactoryCurveMainnet.strategistAddr()).to.equal(
        addresses.multichainStrategist
      );
      expect(
        await poolBoosterFactoryCurveMainnet.campaignRemoteManager()
      ).to.equal(addresses.mainnet.CampaignRemoteManager);
      expect(await poolBoosterFactoryCurveMainnet.votemarket()).to.equal(
        addresses.votemarket
      );
    });
    it("Should revert when trying to initialize again", async () => {
      await expect(
        poolBoosterFactoryCurveMainnet.initialize(
          addresses.multichainStrategist,
          addresses.mainnet.CampaignRemoteManager,
          addresses.votemarket
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
    it("Should deploy and initialize a PoolBoosterCurveMainnet", async () => {
      // Precompute the address
      const computeAddress =
        await poolBoosterFactoryCurveMainnet.computePoolBoosterAddress(
          gauge,
          oeth.address,
          1
        );

      // Deploy and initialize
      const pb = await deployAndInitializePoolBooster(gauge, oeth.address, 1);

      expect(computeAddress).to.equal(pb.address);
      expect(await pb.gauge()).to.equal(gauge);
      expect(await pb.rewardToken()).to.equal(oeth.address);
      expect(await pb.targetChainId()).to.equal(42161);
      expect(await pb.governor()).to.equal(addresses.mainnet.Timelock);
      expect(await pb.strategistAddr()).to.equal(
        addresses.multichainStrategist
      );
      expect(await pb.fee()).to.equal(0);
      expect(await pb.feeCollector()).to.equal(addresses.multichainStrategist);
      expect(await pb.campaignRemoteManager()).to.equal(
        addresses.mainnet.CampaignRemoteManager
      );
      expect(await pb.votemarket()).to.equal(addresses.votemarket);
      expect(await poolBoosterFactoryCurveMainnet.poolBoosterLength()).to.equal(
        1
      );
      expect(
        (await poolBoosterFactoryCurveMainnet.poolBoosters(0))[0]
      ).to.equal(pb.address);
      expect(
        (await poolBoosterFactoryCurveMainnet.poolBoosters(0))[1]
      ).to.equal(gauge);
      expect(
        (await poolBoosterFactoryCurveMainnet.poolBoosters(0))[2]
      ).to.equal(2);

      const entry = await poolBoosterFactoryCurveMainnet.poolBoosterFromPool(
        gauge
      );
      expect(entry[0]).to.equal(pb.address);
      expect(entry[1]).to.equal(gauge);
      expect(entry[2]).to.equal(2);
    });
  });
});
