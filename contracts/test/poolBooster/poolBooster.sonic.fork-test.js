const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { ethers } = hre;
const { oethUnits } = require("../helpers");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Pool Booster", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await sonicFixture();
    const { wS, oSonicVault, nick } = fixture;
    // mint some OS
    await oSonicVault
      .connect(nick)
      .mint(wS.address, oethUnits("1000"), oethUnits("0"));
  });

  it("Should have the correct initial state", async () => {
    const { oSonic, poolBoosterFactory } = fixture;

    expect(await poolBoosterFactory.oSonic()).to.equal(oSonic.address);
    expect(await poolBoosterFactory.governor()).to.equal(
      addresses.sonic.timelock
    );
    expect(await poolBoosterFactory.strategistAddr()).to.equal(
      addresses.sonic.guardian
    );
  });

  it("Should have the OS/USDC.e pool booster correctly configured", async () => {
    const { oSonic, poolBoosterFactory } = fixture;

    const poolBoosterEntry = await poolBoosterFactory.poolBoosterFromPool(
      addresses.sonic.SwapXOsUSDCe.pool
    );
    expect(poolBoosterEntry.boosterType).to.equal(0); // SwapXIchiVault enum value
    expect(poolBoosterEntry.ammPoolAddress).to.equal(
      addresses.sonic.SwapXOsUSDCe.pool
    );

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      addresses.sonic.SwapXOsUSDCe.pool
    );
    expect(await poolBooster.osToken()).to.equal(oSonic.address);
    expect(await poolBooster.bribeContractOS()).to.equal(
      addresses.sonic.SwapXOsUSDCe.extBribeOS
    );
    expect(await poolBooster.bribeContractOther()).to.equal(
      addresses.sonic.SwapXOsUSDCe.extBribeUSDC
    );
    expect(await poolBooster.split()).to.equal(oethUnits("0.7")); // 70%
  });

  it("Should call bribe on pool booster to send incentives to the 2 Ichi bribe contracts ", async () => {
    const { oSonic, nick } = fixture;

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      addresses.sonic.SwapXOsUSDCe.pool
    );
    // make sure pool booster has some balance
    await oSonic.connect(nick).transfer(poolBooster.address, oethUnits("10"));

    const bribeBalance = await oSonic.balanceOf(poolBooster.address);
    let tx = await poolBooster.bribe();
    const balanceAfter = await oSonic.balanceOf(poolBooster.address);

    // extract the emitted RewardAdded events
    let rewardAddedEvents = await filterAndParseRewardAddedEvents(tx);

    expect(rewardAddedEvents.length).to.equal(2);
    expect(rewardAddedEvents[0].rewardToken).to.equal(oSonic.address);
    expect(rewardAddedEvents[1].rewardToken).to.equal(oSonic.address);

    expect(rewardAddedEvents[0].amount).to.approxEqual(
      bribeBalance.mul(oethUnits("0.70")).div(oethUnits("1"))
    );
    expect(rewardAddedEvents[1].amount).to.approxEqual(
      bribeBalance.mul(oethUnits("0.30")).div(oethUnits("1"))
    );
    expect(balanceAfter).to.lte(1);

    // Call bribe again, but this time with too little funds to execute the bribe (min amount is 1e10)
    await oSonic
      .connect(nick)
      .transfer(poolBooster.address, ethers.BigNumber.from("1000000000")); // 1e19
    expect(await oSonic.balanceOf(poolBooster.address)).to.lte(1000000001);
    tx = await poolBooster.bribe();
    rewardAddedEvents = await filterAndParseRewardAddedEvents(tx);

    // expect that no bribes have been executed
    expect(rewardAddedEvents.length).to.equal(0);
    expect(await oSonic.balanceOf(poolBooster.address)).to.gte(1000000000);
    expect(await oSonic.balanceOf(poolBooster.address)).to.lte(1000000001);
  });

  it("Should call bribeAll on factory to send incentives to the 2 Ichi bribe contracts ", async () => {
    const { oSonic, poolBoosterFactory, nick } = fixture;

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      addresses.sonic.SwapXOsUSDCe.pool
    );
    // make sure pool booster has some balance
    await oSonic.connect(nick).transfer(poolBooster.address, oethUnits("10"));

    const bribeBalance = await oSonic.balanceOf(poolBooster.address);
    const tx = await poolBoosterFactory.bribeAll();
    const balanceAfter = await oSonic.balanceOf(poolBooster.address);

    // extract the emitted RewardAdded events
    const rewardAddedEvents = await filterAndParseRewardAddedEvents(tx);

    expect(rewardAddedEvents[0].rewardToken).to.equal(oSonic.address);
    expect(rewardAddedEvents[1].rewardToken).to.equal(oSonic.address);

    expect(rewardAddedEvents[0].amount).to.approxEqual(
      bribeBalance.mul(oethUnits("0.70")).div(oethUnits("1"))
    );
    expect(rewardAddedEvents[1].amount).to.approxEqual(
      bribeBalance.mul(oethUnits("0.30")).div(oethUnits("1"))
    );

    expect(balanceAfter).to.lte(1);
  });

  it("Should be able to remove a pool booster", async () => {
    const { poolBoosterFactory, governor } = fixture;

    // create another pool booster (which is placed as the last entry in
    // the poolBoosters array in PoolBoosterFactory)
    await poolBoosterFactory.connect(governor).createPoolBoosterSwapxClassic(
      addresses.sonic.SwapXOsUSDCeMultisigBooster, //_bribeAddress
      addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
      oethUnits("1") //_salt
    );

    const osUsdcePoolBooster = await poolBoosterFactory.poolBoosterFromPool(
      addresses.sonic.SwapXOsUSDCe.pool
    );
    const initialLength = await poolBoosterFactory.poolBoosterLength();

    // remove the pool booster. This step should also copy last entry in the pool
    // booster list over the deleted one
    const tx = await poolBoosterFactory
      .connect(governor)
      .removePoolBooster(osUsdcePoolBooster.boosterAddress);

    await expect(tx)
      .to.emit(poolBoosterFactory, "PoolBoosterRemoved")
      .withArgs(osUsdcePoolBooster.boosterAddress);

    expect(await poolBoosterFactory.poolBoosterLength()).to.equal(
      initialLength.sub(ethers.BigNumber.from("1"))
    );

    const poolBooster = await poolBoosterFactory.poolBoosterFromPool(
      addresses.sonic.SwapXOsUSDCe.pool
    );
    expect(poolBooster.boosterAddress).to.equal(addresses.zero);

    // verify the newly added pool booster has had its data correctly copied
    const osGemsxPoolBooster = await poolBoosterFactory.poolBoosterFromPool(
      addresses.sonic.SwapXOsGEMSx.pool
    );

    expect(osGemsxPoolBooster.boosterAddress).to.not.equal(addresses.zero);
    expect(osGemsxPoolBooster.ammPoolAddress).to.equal(
      addresses.sonic.SwapXOsGEMSx.pool
    );
    expect(osGemsxPoolBooster.boosterType).to.equal(ethers.BigNumber.from("1")); // SwapXClassicPool
  });

  it("Should be able to create an Ichi pool booster", async () => {
    const { oSonic, poolBoosterFactory, governor } = fixture;

    const tx = await poolBoosterFactory
      .connect(governor)
      // the addresses below are not suitable for pool boosting. Still they will serve the
      // purpose of confirming correct setup.
      .createPoolBoosterSwapxIchi(
        addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
        addresses.sonic.SwapXOsUSDCe.extBribeUSDC, //_bribeAddressOther
        addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
        oethUnits("0.5"), //_split
        oethUnits("1") //_salt
      );

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      addresses.sonic.SwapXOsGEMSx.pool
    );

    await expect(tx)
      .to.emit(poolBoosterFactory, "PoolBoosterDeployed")
      .withArgs(
        poolBooster.address,
        addresses.sonic.SwapXOsGEMSx.pool,
        ethers.BigNumber.from("0") // PoolBoosterType.SwapXIchiVault
      );

    expect(await poolBooster.osToken()).to.equal(oSonic.address);
    expect(await poolBooster.bribeContractOS()).to.equal(
      addresses.sonic.SwapXOsUSDCe.extBribeOS
    );
    expect(await poolBooster.bribeContractOther()).to.equal(
      addresses.sonic.SwapXOsUSDCe.extBribeUSDC
    );
    expect(await poolBooster.split()).to.equal(oethUnits("0.5")); // 50%
  });

  it("Should be able to create a pair pool booster", async () => {
    const { oSonic, poolBoosterFactory, governor } = fixture;

    const tx = await poolBoosterFactory
      .connect(governor)
      .createPoolBoosterSwapxClassic(
        addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddress
        addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
        oethUnits("1") //_salt
      );

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      addresses.sonic.SwapXOsGEMSx.pool
    );

    await expect(tx)
      .to.emit(poolBoosterFactory, "PoolBoosterDeployed")
      .withArgs(
        poolBooster.address,
        addresses.sonic.SwapXOsGEMSx.pool,
        ethers.BigNumber.from("1") // PoolBoosterType.SwapXClassicPool
      );

    expect(await poolBooster.osToken()).to.equal(oSonic.address);
    expect(await poolBooster.bribeContract()).to.equal(
      addresses.sonic.SwapXOsUSDCe.extBribeOS
    );
  });

  describe("Should test require checks", async () => {
    it("Should throw error when 0 address passed to ichi as bribe contract", async () => {});
  });

  const filterAndParseRewardAddedEvents = async (tx) => {
    // keccak256("RewardAdded(address,uint256,uint256)")
    const rewardAddedTopic =
      "0x6a6f77044107a33658235d41bedbbaf2fe9ccdceb313143c947a5e76e1ec8474";

    const { events } = await tx.wait();
    return events
      .filter((e) => e.topics[0] == rewardAddedTopic)
      .map((e) => {
        const decoded = ethers.utils.defaultAbiCoder.decode(
          ["address", "uint256", "uint256"],
          e.data
        );
        return {
          rewardToken: decoded[0],
          amount: decoded[1],
          startTimestamp: decoded[2],
        };
      });
  };

  const getPoolBoosterContractFromPoolAddress = async (poolAddress) => {
    const { poolBoosterFactory } = fixture;
    const poolBoosterEntry = await poolBoosterFactory.poolBoosterFromPool(
      poolAddress
    );
    const poolBoosterType = poolBoosterEntry.boosterType;

    if (poolBoosterType == 0) {
      return await ethers.getContractAt(
        "PoolBoosterSwapxIchi",
        poolBoosterEntry.boosterAddress
      );
    } else if (poolBoosterType == 1) {
      return await ethers.getContractAt(
        "PoolBoosterSwapxPair",
        poolBoosterEntry.boosterAddress
      );
    } else {
      throw new Error(`Unrecognised pool booster type: ${poolBoosterType}`);
    }
  };
});
