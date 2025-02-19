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
    const { oSonic, poolBoosterIchiFactoryV1 } = fixture;

    expect(await poolBoosterIchiFactoryV1.oSonic()).to.equal(oSonic.address);
    expect(await poolBoosterIchiFactoryV1.governor()).to.equal(
      addresses.sonic.timelock
    );
  });

  // this section tests specific deployments of pool boosters
  describe("ForkTest: Specific pool boosters deployed", function () {
    // add newly deployed pool booster factories to this list
    const factoryConfigs = [
      {
        name: "First Ichi Factory",
        factoryName: "poolBoosterIchiFactoryV1",
        ammPool: addresses.sonic.SwapXOsUSDCe.pool,
        bribeContractOS: addresses.sonic.SwapXOsUSDCe.extBribeOS,
        bribeContractOther: addresses.sonic.SwapXOsUSDCe.extBribeUSDC,
        split: "0.7", //70%
      },
    ];

    for (const {
      name,
      factoryName,
      ammPool,
      bribeContractOS,
      bribeContractOther,
      split,
    } of factoryConfigs) {
      it(`Should have the ${name}'s pool booster correctly configured`, async () => {
        const { oSonic } = fixture;
        const factory = fixture[factoryName];

        const poolBoosterEntry = await factory.poolBoosterFromPool(ammPool);
        expect(poolBoosterEntry.boosterType).to.equal(0); // SwapXIchiVault enum value
        expect(poolBoosterEntry.ammPoolAddress).to.equal(ammPool);

        const poolBooster = await getPoolBoosterContractFromPoolAddress(
          factory,
          ammPool
        );
        expect(await poolBooster.osToken()).to.equal(oSonic.address);
        expect(await poolBooster.bribeContractOS()).to.equal(bribeContractOS);
        expect(await poolBooster.bribeContractOther()).to.equal(
          bribeContractOther
        );
        expect(await poolBooster.split()).to.equal(oethUnits(`${split}`));
      });

      it(`Should call bribe on the ${name}'s pool booster to send incentives to the 2 Ichi bribe contracts `, async () => {
        const { oSonic, nick } = fixture;
        const factory = fixture[factoryName];

        const poolBooster = await getPoolBoosterContractFromPoolAddress(
          factory,
          ammPool
        );
        // make sure pool booster has some balance
        await oSonic
          .connect(nick)
          .transfer(poolBooster.address, oethUnits("10"));

        const bribeBalance = await oSonic.balanceOf(poolBooster.address);
        let tx = await poolBooster.bribe();
        const balanceAfter = await oSonic.balanceOf(poolBooster.address);

        // extract the emitted RewardAdded events
        let rewardAddedEvents = await filterAndParseRewardAddedEvents(tx);

        expect(rewardAddedEvents.length).to.equal(2);
        expect(rewardAddedEvents[0].rewardToken).to.equal(oSonic.address);
        expect(rewardAddedEvents[1].rewardToken).to.equal(oSonic.address);

        expect(rewardAddedEvents[0].amount).to.approxEqual(
          bribeBalance.mul(oethUnits(split.toString())).div(oethUnits("1"))
        );
        expect(rewardAddedEvents[1].amount).to.approxEqual(
          bribeBalance
            .mul(oethUnits(`${1 - parseFloat(split)}`))
            .div(oethUnits("1"))
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

      it(`Should call bribeAll on ${name}'s to send incentives to the 2 Ichi bribe contracts`, async () => {
        const { oSonic, nick } = fixture;
        const factory = fixture[factoryName];

        const poolBooster = await getPoolBoosterContractFromPoolAddress(
          factory,
          ammPool
        );
        // make sure pool booster has some balance
        await oSonic
          .connect(nick)
          .transfer(poolBooster.address, oethUnits("10"));

        const bribeBalance = await oSonic.balanceOf(poolBooster.address);
        const tx = await factory.bribeAll([]);
        const balanceAfter = await oSonic.balanceOf(poolBooster.address);

        // extract the emitted RewardAdded events
        const rewardAddedEvents = await filterAndParseRewardAddedEvents(tx);

        expect(rewardAddedEvents[0].rewardToken).to.equal(oSonic.address);
        expect(rewardAddedEvents[1].rewardToken).to.equal(oSonic.address);

        expect(rewardAddedEvents[0].amount).to.approxEqual(
          bribeBalance.mul(oethUnits(split.toString())).div(oethUnits("1"))
        );
        expect(rewardAddedEvents[1].amount).to.approxEqual(
          bribeBalance
            .mul(oethUnits(`${1 - parseFloat(split)}`))
            .div(oethUnits("1"))
        );

        expect(balanceAfter).to.lte(1);
      });
    }
  });

  it("Should skip pool booster bribe call when pool booster on exclusion list", async () => {
    const { oSonic, poolBoosterIchiFactoryV1, nick } = fixture;

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      poolBoosterIchiFactoryV1,
      addresses.sonic.SwapXOsUSDCe.pool
    );
    // make sure pool booster has some balance
    await oSonic.connect(nick).transfer(poolBooster.address, oethUnits("10"));

    const balanceBefore = await oSonic.balanceOf(poolBooster.address);
    await poolBoosterIchiFactoryV1.bribeAll([poolBooster.address]);

    // balance before and after should be the same (no bribes have been executed)
    expect(await oSonic.balanceOf(poolBooster.address)).to.eq(balanceBefore);
  });

  it("Should be able to remove a pool booster", async () => {
    const { poolBoosterIchiFactoryV1, governor } = fixture;

    // create another pool booster (which is placed as the last entry in
    // the poolBoosters array in poolBoosterIchiFactoryV1)
    await poolBoosterIchiFactoryV1.connect(governor).createPoolBoosterSwapxIchi(
      addresses.sonic.SwapXOsUSDCeMultisigBooster, //_bribeAddress
      addresses.sonic.SwapXOsUSDCeMultisigBooster, //_bribeAddressOther
      addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
      oethUnits("0.5"), //_split
      oethUnits("1") //_salt
    );

    const osUsdcePoolBooster =
      await poolBoosterIchiFactoryV1.poolBoosterFromPool(
        addresses.sonic.SwapXOsUSDCe.pool
      );
    const initialLength = await poolBoosterIchiFactoryV1.poolBoosterLength();

    // remove the pool booster. This step should also copy last entry in the pool
    // booster list over the deleted one
    const tx = await poolBoosterIchiFactoryV1
      .connect(governor)
      .removePoolBooster(osUsdcePoolBooster.boosterAddress);

    await expect(tx)
      .to.emit(poolBoosterIchiFactoryV1, "PoolBoosterRemoved")
      .withArgs(osUsdcePoolBooster.boosterAddress);

    expect(await poolBoosterIchiFactoryV1.poolBoosterLength()).to.equal(
      initialLength.sub(ethers.BigNumber.from("1"))
    );

    const poolBooster = await poolBoosterIchiFactoryV1.poolBoosterFromPool(
      addresses.sonic.SwapXOsUSDCe.pool
    );
    expect(poolBooster.boosterAddress).to.equal(addresses.zero);

    // verify the newly added pool booster has had its data correctly copied
    const osGemsxPoolBooster =
      await poolBoosterIchiFactoryV1.poolBoosterFromPool(
        addresses.sonic.SwapXOsGEMSx.pool
      );

    expect(osGemsxPoolBooster.boosterAddress).to.not.equal(addresses.zero);
    expect(osGemsxPoolBooster.ammPoolAddress).to.equal(
      addresses.sonic.SwapXOsGEMSx.pool
    );
    expect(osGemsxPoolBooster.boosterType).to.equal(ethers.BigNumber.from("0")); // SwapXClassicPool
  });

  it("Should be able to create an Ichi pool booster", async () => {
    const { oSonic, poolBoosterIchiFactoryV1, governor } = fixture;

    const tx = await poolBoosterIchiFactoryV1
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
      poolBoosterIchiFactoryV1,
      addresses.sonic.SwapXOsGEMSx.pool
    );

    await expect(tx)
      .to.emit(poolBoosterIchiFactoryV1, "PoolBoosterDeployed")
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
    const { oSonic, poolBoosterPairFactoryV1, governor } = fixture;

    const tx = await poolBoosterPairFactoryV1
      .connect(governor)
      .createPoolBoosterSwapxClassic(
        addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddress
        addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
        oethUnits("1") //_salt
      );

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      poolBoosterPairFactoryV1,
      addresses.sonic.SwapXOsGEMSx.pool
    );

    await expect(tx)
      .to.emit(poolBoosterPairFactoryV1, "PoolBoosterDeployed")
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
    it("Should throw an error when invalid params are passed to swapx pair booster creation function", async () => {
      const { poolBoosterPairFactoryV1, poolBoosterIchiFactoryV1, governor } =
        fixture;

      await expect(
        poolBoosterPairFactoryV1
          .connect(governor)
          .createPoolBoosterSwapxClassic(
            addresses.zero, //_bribeAddress
            addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
            oethUnits("1") //_salt
          )
        // Invalid bribeContract address
      ).to.be.revertedWith("Failed creating a pool booster");

      await expect(
        poolBoosterPairFactoryV1
          .connect(governor)
          .createPoolBoosterSwapxClassic(
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddress
            addresses.zero, //_ammPoolAddress
            oethUnits("1") //_salt
          )
      ).to.be.revertedWith("Invalid ammPoolAddress address");

      await expect(
        poolBoosterIchiFactoryV1.connect(governor).createPoolBoosterSwapxIchi(
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
          addresses.zero, //_ammPoolAddress
          oethUnits("0.7"), //_split
          oethUnits("1") //_salt
        )
      ).to.be.revertedWith("Invalid ammPoolAddress address");

      await expect(
        poolBoosterIchiFactoryV1.connect(governor).createPoolBoosterSwapxIchi(
          addresses.zero, //_bribeAddressOS
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
          addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
          oethUnits("0.7"), //_split
          oethUnits("1") //_salt
        )
        // Invalid bribeContractOS address
      ).to.be.revertedWith("Failed creating a pool booster");

      await expect(
        poolBoosterIchiFactoryV1.connect(governor).createPoolBoosterSwapxIchi(
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
          addresses.zero, //_bribeAddressOther
          addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
          oethUnits("0.7"), //_split
          oethUnits("1") //_salt
        )
        // Invalid bribeContractOther address
      ).to.be.revertedWith("Failed creating a pool booster");

      await expect(
        poolBoosterIchiFactoryV1.connect(governor).createPoolBoosterSwapxIchi(
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
          addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
          oethUnits("1"), //_split
          oethUnits("1") //_salt
        )
        // Unexpected split amount
      ).to.be.revertedWith("Failed creating a pool booster");

      await expect(
        poolBoosterIchiFactoryV1.connect(governor).createPoolBoosterSwapxIchi(
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
          addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
          oethUnits("0.009"), //_split
          oethUnits("1") //_salt
        )
        // Unexpected split amount
      ).to.be.revertedWith("Failed creating a pool booster");
    });

    it("Should throw an error when non govenor is trying to create a pool booster", async () => {
      const { poolBoosterPairFactoryV1, poolBoosterIchiFactoryV1, nick } =
        fixture;

      await expect(
        poolBoosterPairFactoryV1.connect(nick).createPoolBoosterSwapxClassic(
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddress
          addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
          oethUnits("1") //_salt
        )
      ).to.be.revertedWith("Caller is not the Governor");

      await expect(
        poolBoosterIchiFactoryV1.connect(nick).createPoolBoosterSwapxIchi(
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
          addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
          oethUnits("0.7"), //_split
          oethUnits("1") //_salt
        )
      ).to.be.revertedWith("Caller is not the Governor");
    });
  });

  describe("Should test the central registry", async () => {
    it("Governor should be able to add a new factory address", async () => {
      const { poolBoosterCentralRegistry, governor } = fixture;
      const someFactoryAddress = addresses.sonic.SwapXOsUSDCe.extBribeOS;

      const tx = await poolBoosterCentralRegistry
        .connect(governor)
        .approveFactory(someFactoryAddress);

      await expect(tx)
        .to.emit(poolBoosterCentralRegistry, "FactoryApproved")
        .withArgs(someFactoryAddress);

      expect(
        await poolBoosterCentralRegistry.isApprovedFactory(someFactoryAddress)
      ).to.equal(true);

      expect(
        (await poolBoosterCentralRegistry.getAllFactories()).length
      ).to.be.gte(1);
    });

    it("Governor should be able to remove a factory address", async () => {
      const { poolBoosterCentralRegistry, governor } = fixture;
      const someFactoryAddress = addresses.sonic.SwapXOsUSDCe.extBribeOS;

      await poolBoosterCentralRegistry
        .connect(governor)
        .approveFactory(someFactoryAddress);

      expect(
        await poolBoosterCentralRegistry.isApprovedFactory(someFactoryAddress)
      ).to.equal(true);

      const tx = await poolBoosterCentralRegistry
        .connect(governor)
        .removeFactory(someFactoryAddress);

      expect(
        await poolBoosterCentralRegistry.isApprovedFactory(someFactoryAddress)
      ).to.equal(false);

      await expect(tx)
        .to.emit(poolBoosterCentralRegistry, "FactoryRemoved")
        .withArgs(someFactoryAddress);
    });

    it("Non governor shouldn't be allowed to add or remove pool boosters", async () => {
      const { poolBoosterCentralRegistry, nick } = fixture;
      const someFactoryAddress = addresses.sonic.SwapXOsUSDCe.extBribeOS;

      await expect(
        poolBoosterCentralRegistry
          .connect(nick)
          .approveFactory(someFactoryAddress)
      ).to.be.revertedWith("Caller is not the Governor");

      await expect(
        poolBoosterCentralRegistry
          .connect(nick)
          .removeFactory(someFactoryAddress)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("Governor should be able to remove a factory address", async () => {
      const { poolBoosterCentralRegistry, governor } = fixture;
      const someFactoryAddress = addresses.sonic.SwapXOsUSDCe.extBribeOS;

      await poolBoosterCentralRegistry
        .connect(governor)
        .approveFactory(someFactoryAddress);

      await expect(
        poolBoosterCentralRegistry
          .connect(governor)
          .approveFactory(someFactoryAddress)
      ).to.be.revertedWith("Factory already approved");
    });
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

  const getPoolBoosterContractFromPoolAddress = async (
    factory,
    poolAddress
  ) => {
    const poolBoosterEntry = await factory.poolBoosterFromPool(poolAddress);
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
