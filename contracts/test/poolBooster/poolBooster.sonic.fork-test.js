const { createFixtureLoader } = require("../_fixture");
const { defaultSonicFixture } = require("../_fixture-sonic");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { ethers } = hre;
const { oethUnits } = require("../helpers");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe.only("ForkTest: Pool Booster", function () {
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
    expect(await poolBoosterFactory.governor()).to.equal(addresses.sonic.timelock);
    expect(await poolBoosterFactory.strategistAddr()).to.equal(addresses.sonic.guardian);
  });

  it("Should have the OS/USDC.e pool booster correctly configured", async () => {
    const { oSonic, poolBoosterFactory } = fixture;
    
    const poolBoosterEntry = await poolBoosterFactory.poolBoosterFromPool(addresses.sonic.SwapXOsUSDCe.pool);
    expect(poolBoosterEntry.boosterType).to.equal(0); // SwapXIchiVault enum value
    expect(poolBoosterEntry.ammPoolAddress).to.equal(addresses.sonic.SwapXOsUSDCe.pool);

    const poolBooster = await getPoolBoosterContractFromPoolAddress(addresses.sonic.SwapXOsUSDCe.pool);
    expect(await poolBooster.osToken()).to.equal(oSonic.address);
    expect(await poolBooster.bribeContractOS()).to.equal(addresses.sonic.SwapXOsUSDCe.extBribeOS);
    expect(await poolBooster.bribeContractOther()).to.equal(addresses.sonic.SwapXOsUSDCe.extBribeUSDC);
    expect(await poolBooster.split()).to.equal(oethUnits("0.7")); // 70%  
  });

  it("Should call bribe on pool booster to send incentives to the 2 Ichi bribe contracts ", async () => {
    const { oSonic, wS, oSonicVault, poolBoosterFactory, nick } = fixture;


    const poolBooster = await getPoolBoosterContractFromPoolAddress(addresses.sonic.SwapXOsUSDCe.pool);
    // make sure pool booster has some balance
    await oSonic
      .connect(nick)
      .transfer(poolBooster.address, oethUnits("10"));    

    const balanceBefore = await oSonic.balanceOf(poolBooster.address);
    console.log("balanceBefore", balanceBefore);

    const tx = await poolBooster.bribe();

    console.log("balanceAfter", await oSonic.balanceOf(poolBooster.address));

    await expect(tx).to.emittedEvent("RewardAdded", [
      wS.address,
      async (rewardAmount) => {
        console.log("rewardAmount", rewardAmount);
        expect(rewardAmount).to.lt(0, "Unexpected reward amount");
      },
      async (startTimestamp) => {
        expect(startTimestamp).to.gt(0, "Timestamp should be greater than 0");
      },
    ]);


    // emitted by the function notifyRewardAmount
    // emit RewardAdded(_rewardsToken, reward, _startTimestamp)
  });

  const getPoolBoosterContractFromPoolAddress = async (poolAddress) => {
    const { poolBoosterFactory } = fixture;
    const poolBoosterEntry = await poolBoosterFactory.poolBoosterFromPool(addresses.sonic.SwapXOsUSDCe.pool);
    const poolBoosterType = poolBoosterEntry.boosterType;

    if (poolBoosterType == 0) {
      return await ethers.getContractAt("PoolBoosterSwapxIchi", poolBoosterEntry.boosterAddress);
    } else if (poolBoosterType == 1) {
      return await ethers.getContractAt("PoolBoosterSwapxPair", poolBoosterEntry.boosterAddress);
    } else {
      throw new Error(`Unrecognised pool booster type: ${poolBoosterType}`);
    }
  };
});
