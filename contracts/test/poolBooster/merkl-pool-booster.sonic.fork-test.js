const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");
const { oethUnits } = require("../helpers");
const addresses = require("../../utils/addresses");
const { impersonateAndFund } = require("../../utils/signers.js");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Merkl Pool Booster", function () {
  const DEFAULT_CAMPAIGN_ID = 12; // Euler's campaign ID
  const DEFAULT_DURATION = 86400; // 1 day
  const DEFAULT_AMM_ADDRESS = "0x4c0AF5d6Bcb10B3C05FB5F3a846999a3d87534C7"; // Euler's Re7 Labs wS Vault
  const DEFAULT_CAMPAIGN_DATA = "0xc0c0c0"; // Fake campaign data
  let fixture,
    poolBoosterMerklFactory,
    nick,
    oSonicVault,
    oSonic,
    strategist,
    merklDistributor;
  beforeEach(async () => {
    fixture = await sonicFixture();
    nick = fixture.nick;
    oSonicVault = fixture.oSonicVault;
    oSonic = fixture.oSonic;
    poolBoosterMerklFactory = fixture.poolBoosterMerklFactory;
    strategist = await impersonateAndFund(addresses.multichainStrategist);
    merklDistributor = fixture.merklDistributor;

    await ensureTokenIsApproved(oSonic);

    // mint some OS to Nick
    await oSonicVault.connect(nick).mint(oethUnits("10000"));
  });

  it("Should have correct deployment params", async () => {
    expect(await poolBoosterMerklFactory.merklDistributor()).to.equal(
      addresses.sonic.MerklDistributor
    );
  });

  it("Should deploy a Pool Booster for a Merkl pool", async () => {
    const pb = await createPB("1");
    expect(await poolBoosterMerklFactory.poolBoosterLength()).to.equal(1);
    expect(await pb.campaignType()).to.equal(DEFAULT_CAMPAIGN_ID);
    expect(await pb.campaignData()).to.equal(DEFAULT_CAMPAIGN_DATA);
  });

  it("Should fail to deploy a Pool Booster for a Merkl pool with invalid data", async () => {
    // Invalid ammPoolAddress address
    await expect(
      poolBoosterMerklFactory
        .connect(strategist)
        .createPoolBoosterMerkl(
          DEFAULT_CAMPAIGN_ID,
          addresses.zero,
          DEFAULT_DURATION,
          DEFAULT_CAMPAIGN_DATA,
          1
        )
    ).to.be.revertedWith("Invalid ammPoolAddress address");

    // Invalid salt
    await expect(
      poolBoosterMerklFactory
        .connect(strategist)
        .createPoolBoosterMerkl(
          DEFAULT_CAMPAIGN_ID,
          DEFAULT_AMM_ADDRESS,
          DEFAULT_DURATION,
          DEFAULT_CAMPAIGN_DATA,
          0
        )
    ).to.be.revertedWith("Invalid salt");

    // Invalid campaign duration
    await expect(
      poolBoosterMerklFactory
        .connect(strategist)
        .createPoolBoosterMerkl(
          DEFAULT_CAMPAIGN_ID,
          DEFAULT_AMM_ADDRESS,
          10,
          DEFAULT_CAMPAIGN_DATA,
          1
        )
    ).to.be.revertedWith("Invalid campaign duration");

    // Invalid campaign data
    await expect(
      poolBoosterMerklFactory
        .connect(strategist)
        .createPoolBoosterMerkl(
          DEFAULT_CAMPAIGN_ID,
          DEFAULT_AMM_ADDRESS,
          DEFAULT_DURATION,
          "0x",
          1
        )
    ).to.be.revertedWith("Invalid campaign data");
  });

  it("Should bribe 2 times in a row", async () => {
    const poolBoosterMerkl = await createPB("1");

    // Give 10 OS to the pool booster
    await oSonic
      .connect(nick)
      .transfer(poolBoosterMerkl.address, oethUnits("1000"));

    // Bribe the pool booster
    let tx = await poolBoosterMerkl.connect(strategist).bribe();

    await expect(tx).to.emittedEvent("BribeExecuted", [oethUnits("1000")]);
    expect(await oSonic.balanceOf(poolBoosterMerkl.address)).to.equal(
      oethUnits("0")
    );

    // Timejump 1 day, otherwise the bribe already exist
    await ethers.provider.send("evm_increaseTime", [86400]);
    await ethers.provider.send("evm_mine");

    // Give 10 OS to the pool booster
    await oSonic
      .connect(nick)
      .transfer(poolBoosterMerkl.address, oethUnits("1000"));

    // Bribe the pool booster
    tx = await poolBoosterMerkl.connect(strategist).bribe();
    await expect(tx).to.emittedEvent("BribeExecuted", [oethUnits("1000")]);
    expect(await oSonic.balanceOf(poolBoosterMerkl.address)).to.equal(
      oethUnits("0")
    );
  });

  it("Should not bribe if amount is too small", async () => {
    const poolBoosterMerkl = await createPB("1");
    // First test to ensure that amount is lower than immutable MIN_BRIBE_AMOUNT.
    // Give 100 OS to the pool booster
    await oSonic.connect(nick).transfer(poolBoosterMerkl.address, "100"); // 100 wei of OS

    // Bribe the pool booster
    await poolBoosterMerkl.connect(strategist).bribe();
    expect(await oSonic.balanceOf(poolBoosterMerkl.address)).to.equal("100");

    // Second test to ensure that amount is lower than minBribeAmount required from rewardFactory.
    // Give 1e12 OS to the pool booster
    await oSonic
      .connect(nick)
      .transfer(poolBoosterMerkl.address, oethUnits("1")); // 1e18 wei of OS

    // Bribe the pool booster
    await poolBoosterMerkl.connect(strategist).bribe();
    expect(await oSonic.balanceOf(poolBoosterMerkl.address)).to.equal(
      "1000000000000000100"
    );
  });

  async function createPB(salt) {
    await poolBoosterMerklFactory
      .connect(strategist)
      .createPoolBoosterMerkl(
        DEFAULT_CAMPAIGN_ID,
        DEFAULT_AMM_ADDRESS,
        DEFAULT_DURATION,
        DEFAULT_CAMPAIGN_DATA,
        salt
      );
    const boostersCount = await poolBoosterMerklFactory.poolBoosterLength();
    const boosterEntry = await poolBoosterMerklFactory.poolBoosters(
      boostersCount.sub(1)
    );
    const cont = await ethers.getContractAt(
      "PoolBoosterMerklV2",
      boosterEntry.boosterAddress
    );
    return cont;
  }

  async function ensureTokenIsApproved(token) {
    // Guess by on-chain tx.
    await merklDistributor
      .connect(
        await impersonateAndFund("0xA9DdD91249DFdd450E81E1c56Ab60E1A62651701")
      )
      .setRewardTokenMinAmounts([token.address], [oethUnits("1")]);
  }
});
