const { createFixtureLoader, defaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers.js");
const { deployWithConfirmation } = require("../../utils/deploy.js");
const { hardhatSetBalance } = require("../_fund");
const { ethers } = hre;

const mainnetFixture = createFixtureLoader(defaultFixture);

describe("ForkTest: Merkl Pool Booster", function () {
  const DEFAULT_DURATION = 604800; // 7 days
  const DEFAULT_CAMPAIGN_TYPE = 45;
  const DEFAULT_CAMPAIGN_DATA = "0xc0c0c0";
  const MERKL_BOOSTER_TYPE = 3; // IPoolBoostCentralRegistry.PoolBoosterType.MerklBooster
  const AMM_POOL = "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";

  let fixture,
    poolBoosterMerklFactory,
    merklDistributor,
    oeth,
    weth,
    oethVault,
    poolBoosterCentralRegistry,
    beacon,
    governor, // multichainStrategist — governor of the factory & owner of the beacon
    anna; // random signer for auth tests

  beforeEach(async () => {
    fixture = await mainnetFixture();
    oeth = fixture.oeth;
    weth = fixture.weth;
    oethVault = fixture.oethVault;
    poolBoosterMerklFactory = fixture.poolBoosterMerklFactory;
    merklDistributor = fixture.merklDistributor;
    poolBoosterCentralRegistry = fixture.poolBoosterCentralRegistry;
    anna = fixture.anna;

    // Governor of the factory & owner of the beacon is the multichainStrategist
    governor = await impersonateAndFund(addresses.multichainStrategist);
    governor.address = addresses.multichainStrategist;

    // Get beacon from factory
    const beaconAddr = await poolBoosterMerklFactory.beacon();
    beacon = await ethers.getContractAt("UpgradeableBeacon", beaconAddr);
  });

  // Helper: mint OETH by depositing WETH into the vault
  async function mintOeth(recipient, amount) {
    await hardhatSetBalance(recipient.address, "1000");
    await weth.connect(recipient).deposit({ value: amount });
    await weth.connect(recipient).approve(oethVault.address, amount);
    await oethVault.connect(recipient).mint(weth.address, amount, 0);
  }

  // Helper to encode initialize calldata
  function encodeInitData(overrides = {}) {
    const iface = new ethers.utils.Interface([
      "function initialize(uint32,uint32,address,address,address,address,bytes)",
    ]);
    return iface.encodeFunctionData("initialize", [
      overrides.duration ?? DEFAULT_DURATION,
      overrides.campaignType ?? DEFAULT_CAMPAIGN_TYPE,
      overrides.rewardToken ?? oeth.address,
      overrides.merklDistributor ?? addresses.mainnet.CampaignCreator,
      overrides.governor ?? addresses.mainnet.Guardian,
      overrides.strategist ?? addresses.multichainStrategist,
      overrides.campaignData ?? DEFAULT_CAMPAIGN_DATA,
    ]);
  }

  // Helper to create a pool booster and return contract instance.
  // Uses salt as a unique pool address when ammPool is not provided.
  async function createPoolBooster(salt, ammPool, initOverrides = {}) {
    const pool =
      ammPool || ethers.utils.hexZeroPad(ethers.utils.hexlify(salt || 999), 20);
    const initData = encodeInitData(initOverrides);
    await poolBoosterMerklFactory
      .connect(governor)
      .createPoolBoosterMerkl(pool, initData, salt || 999);

    const entry = await poolBoosterMerklFactory.poolBoosterFromPool(pool);
    return ethers.getContractAt("PoolBoosterMerklV2", entry.boosterAddress);
  }

  // -------------------------------------------------------------------
  // 1. Factory: Deployment & initial state
  // -------------------------------------------------------------------
  describe("Factory: Deployment & initial state", () => {
    it("Should have correct beacon (non-zero)", async () => {
      const b = await poolBoosterMerklFactory.beacon();
      expect(b).to.not.equal(addresses.zero);
    });

    it("Should have correct governor", async () => {
      expect(await poolBoosterMerklFactory.governor()).to.equal(
        addresses.multichainStrategist
      );
    });

    it("Should have OETH token supported by Merkl Distributor", async () => {
      expect(
        await merklDistributor.rewardTokenMinAmounts(oeth.address)
      ).to.be.gt(0);
    });
  });

  // -------------------------------------------------------------------
  // 2. Factory: createPoolBoosterMerkl
  // -------------------------------------------------------------------
  describe("Factory: createPoolBoosterMerkl", () => {
    it("Should create a proxy with correct params", async () => {
      const pool = "0x0000000000000000000000000000000000000100";
      const initData = encodeInitData();
      const tx = await poolBoosterMerklFactory
        .connect(governor)
        .createPoolBoosterMerkl(pool, initData, 100);

      const entry = await poolBoosterMerklFactory.poolBoosterFromPool(pool);
      expect(entry.boosterAddress).to.not.equal(addresses.zero);
      expect(entry.ammPoolAddress).to.equal(pool);
      expect(entry.boosterType).to.equal(MERKL_BOOSTER_TYPE);

      // Check PoolBoosterCreated event via central registry
      await expect(tx).to.emit(
        poolBoosterCentralRegistry,
        "PoolBoosterCreated"
      );
    });

    it("Should initialize proxy with correct parameters", async () => {
      const poolBooster = await createPoolBooster(200);

      expect(await poolBooster.duration()).to.equal(DEFAULT_DURATION);
      expect(await poolBooster.campaignType()).to.equal(DEFAULT_CAMPAIGN_TYPE);
      expect(await poolBooster.rewardToken()).to.equal(oeth.address);
      expect(await poolBooster.merklDistributor()).to.equal(
        addresses.mainnet.CampaignCreator
      );
      expect(await poolBooster.governor()).to.equal(addresses.mainnet.Guardian);
      expect(await poolBooster.strategistAddr()).to.equal(
        addresses.multichainStrategist
      );
      expect(await poolBooster.factory()).to.equal(
        poolBoosterMerklFactory.address
      );
    });

    it("Should match computePoolBoosterAddress", async () => {
      const salt = 300;
      const pool = "0x0000000000000000000000000000000000000300";
      const initData = encodeInitData();
      const computed = await poolBoosterMerklFactory.computePoolBoosterAddress(
        salt,
        initData
      );

      await poolBoosterMerklFactory
        .connect(governor)
        .createPoolBoosterMerkl(pool, initData, salt);

      const entry = await poolBoosterMerklFactory.poolBoosterFromPool(pool);
      expect(entry.boosterAddress).to.equal(computed);
    });

    it("Should revert when creating duplicate for same AMM pool", async () => {
      const pool = "0x0000000000000000000000000000000000000099";
      await createPoolBooster(350, pool);
      await expect(createPoolBooster(351, pool)).to.be.revertedWith(
        "Pool booster already exists"
      );
    });

    it("Should revert with zero ammPoolAddress", async () => {
      const initData = encodeInitData();
      await expect(
        poolBoosterMerklFactory
          .connect(governor)
          .createPoolBoosterMerkl(addresses.zero, initData, 100)
      ).to.be.revertedWith("Invalid ammPoolAddress address");
    });

    it("Should revert with zero salt", async () => {
      const initData = encodeInitData();
      await expect(
        poolBoosterMerklFactory
          .connect(governor)
          .createPoolBoosterMerkl(AMM_POOL, initData, 0)
      ).to.be.revertedWith("Invalid salt");
    });

    it("Should revert when called by non-governor", async () => {
      const initData = encodeInitData();
      await expect(
        poolBoosterMerklFactory
          .connect(anna)
          .createPoolBoosterMerkl(AMM_POOL, initData, 100)
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  // -------------------------------------------------------------------
  // 3. Beacon: upgradeTo
  // -------------------------------------------------------------------
  describe("Beacon: upgradeTo", () => {
    it("Should upgrade beacon and affect existing proxies", async () => {
      // Create a pool booster with the current implementation
      const poolBooster = await createPoolBooster(900);
      expect(await poolBooster.VERSION()).to.equal("1.0.0");

      // Deploy a new implementation
      const newImpl = await deployWithConfirmation("PoolBoosterMerklV2", []);

      // Upgrade beacon
      const tx = await beacon.connect(governor).upgradeTo(newImpl.address);
      await expect(tx).to.emit(beacon, "Upgraded").withArgs(newImpl.address);

      // Existing proxy should still work (uses new implementation)
      expect(await poolBooster.VERSION()).to.equal("1.0.0");
      expect(await poolBooster.duration()).to.equal(DEFAULT_DURATION);
    });

    it("Should revert upgradeTo with non-contract address", async () => {
      await expect(
        beacon.connect(governor).upgradeTo(anna.address)
      ).to.be.revertedWith(
        "UpgradeableBeacon: implementation is not a contract"
      );
    });

    it("Should revert upgradeTo when called by non-governor", async () => {
      const newImpl = await deployWithConfirmation("PoolBoosterMerklV2", []);
      await expect(
        beacon.connect(anna).upgradeTo(newImpl.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  // -------------------------------------------------------------------
  // 4. PoolBoosterMerklV2: Initialization
  // -------------------------------------------------------------------
  describe("PoolBoosterMerklV2: Initialization", () => {
    it("Should not allow double initialization", async () => {
      const poolBooster = await createPoolBooster(400);
      const pbGovernor = await impersonateAndFund(addresses.mainnet.Guardian);

      await expect(
        poolBooster
          .connect(pbGovernor)
          .initialize(
            DEFAULT_DURATION,
            DEFAULT_CAMPAIGN_TYPE,
            oeth.address,
            addresses.mainnet.CampaignCreator,
            addresses.mainnet.Guardian,
            addresses.multichainStrategist,
            "0x"
          )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("Should revert with invalid duration (≤ 1 hour)", async () => {
      await expect(createPoolBooster(401, undefined, { duration: 3600 })).to.be
        .reverted;
    });

    it("Should revert with zero rewardToken", async () => {
      await expect(
        createPoolBooster(402, undefined, { rewardToken: addresses.zero })
      ).to.be.reverted;
    });

    it("Should revert with zero merklDistributor", async () => {
      await expect(
        createPoolBooster(403, undefined, { merklDistributor: addresses.zero })
      ).to.be.reverted;
    });

    it("Should revert with zero campaignType", async () => {
      await expect(createPoolBooster(404, undefined, { campaignType: 0 })).to.be
        .reverted;
    });

    it("Should revert with empty campaignData", async () => {
      await expect(
        createPoolBooster(405, undefined, { campaignData: "0x" })
      ).to.be.reverted;
    });

    it("Should not allow initialize on implementation contract", async () => {
      const implAddress = await beacon.implementation();
      const impl = await ethers.getContractAt(
        "PoolBoosterMerklV2",
        implAddress
      );

      await expect(
        impl.initialize(
          DEFAULT_DURATION,
          DEFAULT_CAMPAIGN_TYPE,
          oeth.address,
          addresses.mainnet.CampaignCreator,
          addresses.mainnet.Guardian,
          addresses.multichainStrategist,
          DEFAULT_CAMPAIGN_DATA
        )
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });
  });

  // -------------------------------------------------------------------
  // 5. PoolBoosterMerklV2: Setters
  // -------------------------------------------------------------------
  describe("PoolBoosterMerklV2: Setters", () => {
    let poolBooster, pbGovernor, pbStrategist;

    beforeEach(async () => {
      poolBooster = await createPoolBooster(500);
      pbGovernor = await impersonateAndFund(addresses.mainnet.Guardian);
      pbStrategist = await impersonateAndFund(addresses.multichainStrategist);
    });

    // setDuration
    it("Should setDuration and emit event", async () => {
      const newDuration = 86400 * 14; // 2 weeks
      const tx = await poolBooster.connect(pbGovernor).setDuration(newDuration);
      await expect(tx)
        .to.emit(poolBooster, "DurationUpdated")
        .withArgs(newDuration);
      expect(await poolBooster.duration()).to.equal(newDuration);
    });

    it("Should revert setDuration if ≤ 1 hour", async () => {
      await expect(
        poolBooster.connect(pbGovernor).setDuration(3600)
      ).to.be.revertedWith("Invalid duration");
    });

    it("Should revert setDuration if non-governor/strategist", async () => {
      await expect(
        poolBooster.connect(anna).setDuration(86400 * 14)
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });

    // setCampaignType
    it("Should setCampaignType and emit event", async () => {
      const tx = await poolBooster.connect(pbStrategist).setCampaignType(99);
      await expect(tx).to.emit(poolBooster, "CampaignTypeUpdated").withArgs(99);
      expect(await poolBooster.campaignType()).to.equal(99);
    });

    it("Should revert setCampaignType with zero value", async () => {
      await expect(
        poolBooster.connect(pbGovernor).setCampaignType(0)
      ).to.be.revertedWith("Invalid campaignType");
    });

    it("Should revert setCampaignType if non-governor/strategist", async () => {
      await expect(
        poolBooster.connect(anna).setCampaignType(99)
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });

    // setRewardToken
    it("Should setRewardToken and emit event", async () => {
      const newToken = addresses.mainnet.WETH;
      const tx = await poolBooster.connect(pbGovernor).setRewardToken(newToken);
      await expect(tx)
        .to.emit(poolBooster, "RewardTokenUpdated")
        .withArgs(newToken);
      expect(await poolBooster.rewardToken()).to.equal(newToken);
    });

    it("Should revert setRewardToken with zero address", async () => {
      await expect(
        poolBooster.connect(pbGovernor).setRewardToken(addresses.zero)
      ).to.be.revertedWith("Invalid rewardToken address");
    });

    it("Should revert setRewardToken if non-governor/strategist", async () => {
      await expect(
        poolBooster.connect(anna).setRewardToken(addresses.mainnet.WETH)
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });

    // setMerklDistributor
    it("Should setMerklDistributor and emit event", async () => {
      const newDist = addresses.mainnet.WETH; // just a non-zero address
      const tx = await poolBooster
        .connect(pbGovernor)
        .setMerklDistributor(newDist);
      await expect(tx)
        .to.emit(poolBooster, "MerklDistributorUpdated")
        .withArgs(newDist);
      expect(await poolBooster.merklDistributor()).to.equal(newDist);
    });

    it("Should revert setMerklDistributor with zero address", async () => {
      await expect(
        poolBooster.connect(pbGovernor).setMerklDistributor(addresses.zero)
      ).to.be.revertedWith("Invalid merklDistributor addr");
    });

    it("Should revert setMerklDistributor if non-governor/strategist", async () => {
      await expect(
        poolBooster.connect(anna).setMerklDistributor(addresses.mainnet.WETH)
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });

    // setCampaignData
    it("Should setCampaignData and emit event", async () => {
      const newData = "0xdeadbeef";
      const tx = await poolBooster
        .connect(pbStrategist)
        .setCampaignData(newData);
      await expect(tx)
        .to.emit(poolBooster, "CampaignDataUpdated")
        .withArgs(newData);
      expect(await poolBooster.campaignData()).to.equal(newData);
    });

    it("Should revert setCampaignData with empty data", async () => {
      await expect(
        poolBooster.connect(pbGovernor).setCampaignData("0x")
      ).to.be.revertedWith("Invalid campaign data");
    });

    it("Should revert setCampaignData if non-governor/strategist", async () => {
      await expect(
        poolBooster.connect(anna).setCampaignData("0xdeadbeef")
      ).to.be.revertedWith("Caller is not the Strategist or Governor");
    });
  });

  // -------------------------------------------------------------------
  // 6. PoolBoosterMerklV2: bribe()
  // -------------------------------------------------------------------
  describe("PoolBoosterMerklV2: bribe()", () => {
    let poolBooster, pbGovernor, pbStrategist;

    beforeEach(async () => {
      poolBooster = await createPoolBooster(600);
      pbGovernor = await impersonateAndFund(addresses.mainnet.Guardian);
      pbStrategist = await impersonateAndFund(addresses.multichainStrategist);
    });

    it("Should skip when balance < MIN_BRIBE_AMOUNT", async () => {
      // Pool booster has 0 balance — bribe should just return silently
      const tx = await poolBooster.connect(pbGovernor).bribe();
      await expect(tx).to.not.emit(poolBooster, "BribeExecuted");
    });

    it("Should skip when balance insufficient for duration", async () => {
      // Transfer a tiny amount above MIN_BRIBE_AMOUNT (1e10) but below
      // the threshold: balance * 1 hours < minAmount * duration
      await mintOeth(anna, oethUnits("1"));
      await oeth
        .connect(anna)
        .transfer(poolBooster.address, ethers.BigNumber.from("100000000000")); // 1e11

      const tx = await poolBooster.connect(pbStrategist).bribe();
      await expect(tx).to.not.emit(poolBooster, "BribeExecuted");
      // Balance unchanged
      expect(await oeth.balanceOf(poolBooster.address)).to.be.gte(
        ethers.BigNumber.from("100000000000")
      );
    });

    it("Should execute campaign creation when funded", async () => {
      // Mint OETH to anna and transfer to pool booster
      await mintOeth(anna, oethUnits("100"));
      await oeth.connect(anna).transfer(poolBooster.address, oethUnits("10"));

      const balance = await oeth.balanceOf(poolBooster.address);
      const tx = await poolBooster.connect(pbGovernor).bribe();
      await expect(tx).to.emit(poolBooster, "BribeExecuted").withArgs(balance);

      // Balance should be 0 after bribe
      expect(await oeth.balanceOf(poolBooster.address)).to.equal(0);
    });

    it("Should revert when called by random address", async () => {
      await expect(poolBooster.connect(anna).bribe()).to.be.revertedWith(
        "Not governor, strategist, fctry"
      );
    });
  });

  // -------------------------------------------------------------------
  // 7. PoolBoosterMerklV2: rescueToken()
  // -------------------------------------------------------------------
  describe("PoolBoosterMerklV2: rescueToken()", () => {
    let poolBooster, pbGovernor;

    beforeEach(async () => {
      poolBooster = await createPoolBooster(700);
      pbGovernor = await impersonateAndFund(addresses.mainnet.Guardian);
    });

    it("Should rescue tokens to receiver", async () => {
      // Fund pool booster
      await mintOeth(anna, oethUnits("100"));
      const transferAmount = oethUnits("5");
      await oeth.connect(anna).transfer(poolBooster.address, transferAmount);

      const receiver = fixture.matt.address;
      const balanceBefore = await oeth.balanceOf(receiver);
      const pbBalance = await oeth.balanceOf(poolBooster.address);

      const tx = await poolBooster
        .connect(pbGovernor)
        .rescueToken(oeth.address, receiver);

      await expect(tx)
        .to.emit(poolBooster, "TokensRescued")
        .withArgs(oeth.address, pbBalance, receiver);

      expect(await oeth.balanceOf(receiver)).to.be.gt(balanceBefore);
      expect(await oeth.balanceOf(poolBooster.address)).to.equal(0);
    });

    it("Should revert with zero receiver", async () => {
      await expect(
        poolBooster
          .connect(pbGovernor)
          .rescueToken(oeth.address, addresses.zero)
      ).to.be.revertedWith("Invalid receiver");
    });

    it("Should revert when called by non-governor", async () => {
      await expect(
        poolBooster.connect(anna).rescueToken(oeth.address, anna.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  // -------------------------------------------------------------------
  // 8. Factory: removePoolBooster & bribeAll
  // -------------------------------------------------------------------
  describe("Factory: removePoolBooster & bribeAll", () => {
    it("Should remove a pool booster", async () => {
      // Create two pool boosters
      const pool1 = "0x0000000000000000000000000000000000000001";
      const pool2 = "0x0000000000000000000000000000000000000002";
      await createPoolBooster(801, pool1);
      await createPoolBooster(802, pool2);

      const entry1 = await poolBoosterMerklFactory.poolBoosterFromPool(pool1);
      const initialLength = await poolBoosterMerklFactory.poolBoosterLength();

      const tx = await poolBoosterMerklFactory
        .connect(governor)
        .removePoolBooster(entry1.boosterAddress);

      await expect(tx).to.emit(
        poolBoosterCentralRegistry,
        "PoolBoosterRemoved"
      );

      expect(await poolBoosterMerklFactory.poolBoosterLength()).to.equal(
        initialLength.sub(1)
      );

      // Removed entry should be zeroed out
      const removedEntry = await poolBoosterMerklFactory.poolBoosterFromPool(
        pool1
      );
      expect(removedEntry.boosterAddress).to.equal(addresses.zero);
    });

    it("Should revert removePoolBooster when called by non-governor", async () => {
      const pool1 = "0x0000000000000000000000000000000000000004";
      await createPoolBooster(804, pool1);
      const entry = await poolBoosterMerklFactory.poolBoosterFromPool(pool1);

      await expect(
        poolBoosterMerklFactory
          .connect(anna)
          .removePoolBooster(entry.boosterAddress)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Should revert removePoolBooster when address not found", async () => {
      await expect(
        poolBoosterMerklFactory
          .connect(governor)
          .removePoolBooster(anna.address)
      ).to.be.revertedWith("Pool booster not found");
    });

    it("Should bribeAll and skip exclusion list", async () => {
      const pool1 = "0x0000000000000000000000000000000000000003";
      const poolBooster = await createPoolBooster(803, pool1);

      // Fund the pool booster
      await mintOeth(anna, oethUnits("100"));
      await oeth.connect(anna).transfer(poolBooster.address, oethUnits("10"));

      const balanceBefore = await oeth.balanceOf(poolBooster.address);

      // bribeAll with the pool booster on the exclusion list
      await poolBoosterMerklFactory
        .connect(governor)
        .bribeAll([poolBooster.address]);

      // Balance should remain the same (excluded from bribe)
      expect(await oeth.balanceOf(poolBooster.address)).to.equal(balanceBefore);
    });

    it("Should bribeAll and execute bribes on funded pool boosters", async () => {
      const pool1 = "0x0000000000000000000000000000000000000005";
      const poolBooster = await createPoolBooster(805, pool1);

      // Fund the pool booster
      await mintOeth(anna, oethUnits("100"));
      await oeth.connect(anna).transfer(poolBooster.address, oethUnits("10"));

      const balance = await oeth.balanceOf(poolBooster.address);
      expect(balance).to.be.gt(0);

      // bribeAll with empty exclusion list — should execute bribe
      const tx = await poolBoosterMerklFactory.connect(governor).bribeAll([]);

      await expect(tx).to.emit(poolBooster, "BribeExecuted").withArgs(balance);
      expect(await oeth.balanceOf(poolBooster.address)).to.equal(0);
    });

    it("Should revert bribeAll when called by non-governor", async () => {
      await expect(
        poolBoosterMerklFactory.connect(anna).bribeAll([])
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  // -------------------------------------------------------------------
  // 9. Beacon: constructor & implementation view
  // -------------------------------------------------------------------
  describe("Beacon: state", () => {
    it("Should return the current implementation address", async () => {
      const impl = await beacon.implementation();
      expect(impl).to.not.equal(addresses.zero);
      // Verify it's a contract
      const code = await ethers.provider.getCode(impl);
      expect(code.length).to.be.gt(2); // "0x" for EOA
    });

    it("Should have correct owner", async () => {
      expect(await beacon.owner()).to.equal(addresses.multichainStrategist);
    });
  });

  // -------------------------------------------------------------------
  // 10. Factory: poolBoosterLength & poolBoosters array
  // -------------------------------------------------------------------
  describe("Factory: pool booster tracking", () => {
    it("Should track multiple pool boosters correctly", async () => {
      const pool1 = "0x0000000000000000000000000000000000000011";
      const pool2 = "0x0000000000000000000000000000000000000012";
      const pool3 = "0x0000000000000000000000000000000000000013";

      const lengthBefore = await poolBoosterMerklFactory.poolBoosterLength();

      await createPoolBooster(1101, pool1);
      await createPoolBooster(1102, pool2);
      await createPoolBooster(1103, pool3);

      expect(await poolBoosterMerklFactory.poolBoosterLength()).to.equal(
        lengthBefore.add(3)
      );

      // Verify each pool maps correctly
      const entry1 = await poolBoosterMerklFactory.poolBoosterFromPool(pool1);
      const entry2 = await poolBoosterMerklFactory.poolBoosterFromPool(pool2);
      const entry3 = await poolBoosterMerklFactory.poolBoosterFromPool(pool3);
      expect(entry1.ammPoolAddress).to.equal(pool1);
      expect(entry2.ammPoolAddress).to.equal(pool2);
      expect(entry3.ammPoolAddress).to.equal(pool3);
    });

    it("Should access poolBoosters array by index", async () => {
      const pool1 = "0x0000000000000000000000000000000000000014";
      await createPoolBooster(1104, pool1);

      const length = await poolBoosterMerklFactory.poolBoosterLength();
      const entry = await poolBoosterMerklFactory.poolBoosters(length.sub(1));
      expect(entry.ammPoolAddress).to.equal(pool1);
      expect(entry.boosterType).to.equal(MERKL_BOOSTER_TYPE);
    });
  });

  // -------------------------------------------------------------------
  // 11. PoolBoosterMerklV2: bribe() called by factory
  // -------------------------------------------------------------------
  describe("PoolBoosterMerklV2: bribe() via factory", () => {
    it("Should allow factory to call bribe()", async () => {
      const pool1 = "0x0000000000000000000000000000000000000015";
      const poolBooster = await createPoolBooster(1201, pool1);

      // Fund the pool booster
      await mintOeth(anna, oethUnits("100"));
      await oeth.connect(anna).transfer(poolBooster.address, oethUnits("10"));

      const balance = await oeth.balanceOf(poolBooster.address);

      // bribeAll calls bribe() on the pool booster from the factory
      const tx = await poolBoosterMerklFactory.connect(governor).bribeAll([]);

      await expect(tx).to.emit(poolBooster, "BribeExecuted").withArgs(balance);
    });
  });
});
