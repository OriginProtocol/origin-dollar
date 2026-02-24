const { createFixtureLoader } = require("../_fixture");
const {
  defaultSonicFixture,
  filterAndParseRewardAddedEvents,
  getPoolBoosterContractFromPoolAddress,
} = require("../_fixture-sonic");
const { expect } = require("chai");
const addresses = require("../../utils/addresses");
const { deployWithConfirmation } = require("../../utils/deploy.js");
const { ethers } = hre;
const { oethUnits } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers.js");

const sonicFixture = createFixtureLoader(defaultSonicFixture);

describe("ForkTest: Pool Booster", function () {
  let fixture, strategist;
  beforeEach(async () => {
    fixture = await sonicFixture();
    const { oSonicVault, nick } = fixture;
    // mint some OS
    await oSonicVault.connect(nick).mint(oethUnits("1000"));
    strategist = await impersonateAndFund(addresses.multichainStrategist);
  });

  it("Should have the correct initial state", async () => {
    const { oSonic, poolBoosterDoubleFactoryV1 } = fixture;

    expect(await poolBoosterDoubleFactoryV1.oSonic()).to.equal(oSonic.address);
    expect(await poolBoosterDoubleFactoryV1.governor()).to.equal(
      addresses.multichainStrategist
    );
  });

  // this section tests specific deployments of pool boosters
  describe("ForkTest: Specific pool boosters deployed", function () {
    // add newly deployed pool booster factories to this list
    const factoryConfigs = [
      {
        name: "First Ichi Factory",
        factoryName: "poolBoosterDoubleFactoryV1",
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
        expect(poolBoosterEntry.boosterType).to.equal(0); // SwapXDoubleBooster pool booster enum value
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
        expect(balanceAfter).to.equal(0);

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

        expect(balanceAfter).to.equal(0);
      });
    }
  });

  it("Should skip pool booster bribe call when pool booster on exclusion list", async () => {
    const { oSonic, poolBoosterDoubleFactoryV1, nick } = fixture;

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      poolBoosterDoubleFactoryV1,
      addresses.sonic.SwapXOsUSDCe.pool
    );
    // make sure pool booster has some balance
    await oSonic.connect(nick).transfer(poolBooster.address, oethUnits("10"));

    const balanceBefore = await oSonic.balanceOf(poolBooster.address);
    await poolBoosterDoubleFactoryV1.bribeAll([poolBooster.address]);

    // balance before and after should be the same (no bribes have been executed)
    expect(await oSonic.balanceOf(poolBooster.address)).to.eq(balanceBefore);
  });

  it("Should be able to remove a pool booster", async () => {
    const { poolBoosterDoubleFactoryV1, poolBoosterCentralRegistry } = fixture;

    // create another pool booster (which is placed as the last entry in
    // the poolBoosters array in poolBoosterDoubleFactoryV1)
    await poolBoosterDoubleFactoryV1
      .connect(strategist)
      .createPoolBoosterSwapxDouble(
        addresses.sonic.SwapXOsUSDCeMultisigBooster, //_bribeAddress
        addresses.sonic.SwapXOsUSDCeMultisigBooster, //_bribeAddressOther
        addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
        oethUnits("0.5"), //_split
        oethUnits("1") //_salt
      );

    const osUsdcePoolBooster =
      await poolBoosterDoubleFactoryV1.poolBoosterFromPool(
        addresses.sonic.SwapXOsUSDCe.pool
      );
    const initialLength = await poolBoosterDoubleFactoryV1.poolBoosterLength();

    // remove the pool booster. This step should also copy last entry in the pool
    // booster list over the deleted one
    const tx = await poolBoosterDoubleFactoryV1
      .connect(strategist)
      .removePoolBooster(osUsdcePoolBooster.boosterAddress);

    await expect(tx)
      .to.emit(poolBoosterCentralRegistry, "PoolBoosterRemoved")
      .withArgs(osUsdcePoolBooster.boosterAddress);

    expect(await poolBoosterDoubleFactoryV1.poolBoosterLength()).to.equal(
      initialLength.sub(ethers.BigNumber.from("1"))
    );

    const poolBooster = await poolBoosterDoubleFactoryV1.poolBoosterFromPool(
      addresses.sonic.SwapXOsUSDCe.pool
    );
    expect(poolBooster.boosterAddress).to.equal(addresses.zero);

    // verify the newly added pool booster has had its data correctly copied
    const osGemsxPoolBooster =
      await poolBoosterDoubleFactoryV1.poolBoosterFromPool(
        addresses.sonic.SwapXOsGEMSx.pool
      );

    expect(osGemsxPoolBooster.boosterAddress).to.not.equal(addresses.zero);
    expect(osGemsxPoolBooster.ammPoolAddress).to.equal(
      addresses.sonic.SwapXOsGEMSx.pool
    );
    expect(osGemsxPoolBooster.boosterType).to.equal(ethers.BigNumber.from("0")); // SwapXSingleBooster
  });

  it("Should be able to create an Ichi pool booster", async () => {
    const { oSonic, poolBoosterDoubleFactoryV1, poolBoosterCentralRegistry } =
      fixture;

    const tx = await poolBoosterDoubleFactoryV1
      .connect(strategist)
      // the addresses below are not suitable for pool boosting. Still they will serve the
      // purpose of confirming correct setup.
      .createPoolBoosterSwapxDouble(
        addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
        addresses.sonic.SwapXOsUSDCe.extBribeUSDC, //_bribeAddressOther
        addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
        oethUnits("0.5"), //_split
        oethUnits("1") //_salt
      );

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      poolBoosterDoubleFactoryV1,
      addresses.sonic.SwapXOsGEMSx.pool
    );

    await expect(tx)
      .to.emit(poolBoosterCentralRegistry, "PoolBoosterCreated")
      .withArgs(
        poolBooster.address,
        addresses.sonic.SwapXOsGEMSx.pool,
        ethers.BigNumber.from("0"), // PoolBoosterType.SwapXDoubleBooster
        poolBoosterDoubleFactoryV1.address
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

  it("When creating Double pool booster the computed and actual deployed address should match", async () => {
    const { poolBoosterDoubleFactoryV1 } = fixture;

    const creationParams = [
      addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
      addresses.sonic.SwapXOsUSDCe.extBribeUSDC, //_bribeAddressOther
      addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
      oethUnits("0.5"), //_split
      oethUnits("1337"), //_salt
    ];

    await poolBoosterDoubleFactoryV1
      .connect(strategist)
      // the addresses below are not suitable for pool boosting. Still they will serve the
      // purpose of confirming correct setup.
      .createPoolBoosterSwapxDouble(...creationParams);

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      poolBoosterDoubleFactoryV1,
      addresses.sonic.SwapXOsGEMSx.pool
    );

    const computedAddress =
      await poolBoosterDoubleFactoryV1.computePoolBoosterAddress(
        ...creationParams
      );

    expect(poolBooster.address).to.equal(computedAddress);
  });

  it("When creating Single pool booster the computed and actual deployed address should match", async () => {
    const { poolBoosterSingleFactoryV1, governor } = fixture;

    const creationParams = [
      addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddress
      addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
      oethUnits("12345"), //_salt
    ];

    await poolBoosterSingleFactoryV1
      .connect(governor)
      // the addresses below are not suitable for pool boosting. Still they will serve the
      // purpose of confirming correct setup.
      .createPoolBoosterSwapxSingle(...creationParams);

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      poolBoosterSingleFactoryV1,
      addresses.sonic.SwapXOsGEMSx.pool
    );

    const computedAddress =
      await poolBoosterSingleFactoryV1.computePoolBoosterAddress(
        ...creationParams
      );

    expect(poolBooster.address).to.equal(computedAddress);
  });

  it("Should be able to create a pair pool booster", async () => {
    const {
      oSonic,
      poolBoosterSingleFactoryV1,
      governor,
      poolBoosterCentralRegistry,
    } = fixture;

    const tx = await poolBoosterSingleFactoryV1
      .connect(governor)
      .createPoolBoosterSwapxSingle(
        addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddress
        addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
        oethUnits("1") //_salt
      );

    const poolBooster = await getPoolBoosterContractFromPoolAddress(
      poolBoosterSingleFactoryV1,
      addresses.sonic.SwapXOsGEMSx.pool
    );

    await expect(tx)
      .to.emit(poolBoosterCentralRegistry, "PoolBoosterCreated")
      .withArgs(
        poolBooster.address,
        addresses.sonic.SwapXOsGEMSx.pool,
        ethers.BigNumber.from("1"), // PoolBoosterType.SwapXSingleBooster
        poolBoosterSingleFactoryV1.address
      );

    expect(await poolBooster.osToken()).to.equal(oSonic.address);
    expect(await poolBooster.bribeContract()).to.equal(
      addresses.sonic.SwapXOsUSDCe.extBribeOS
    );
  });

  describe("Should test require checks", async () => {
    it("Should throw an error when invalid params are passed to swapx pair booster creation function", async () => {
      const {
        poolBoosterSingleFactoryV1,
        poolBoosterDoubleFactoryV1,
        timelock,
      } = fixture;

      await expect(
        poolBoosterSingleFactoryV1
          .connect(timelock)
          .createPoolBoosterSwapxSingle(
            addresses.zero, //_bribeAddress
            addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
            oethUnits("1") //_salt
          )
        // Invalid bribeContract address
      ).to.be.revertedWith("Failed creating a pool booster");

      await expect(
        poolBoosterSingleFactoryV1
          .connect(timelock)
          .createPoolBoosterSwapxSingle(
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddress
            addresses.zero, //_ammPoolAddress
            oethUnits("1") //_salt
          )
      ).to.be.revertedWith("Invalid ammPoolAddress address");

      await expect(
        poolBoosterSingleFactoryV1
          .connect(timelock)
          .createPoolBoosterSwapxSingle(
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddress
            addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
            oethUnits("0") //_salt
          )
      ).to.be.revertedWith("Invalid salt");

      await expect(
        poolBoosterDoubleFactoryV1
          .connect(strategist)
          .createPoolBoosterSwapxDouble(
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
            addresses.zero, //_ammPoolAddress
            oethUnits("0.7"), //_split
            oethUnits("1") //_salt
          )
      ).to.be.revertedWith("Invalid ammPoolAddress address");

      await expect(
        poolBoosterDoubleFactoryV1
          .connect(strategist)
          .createPoolBoosterSwapxDouble(
            addresses.zero, //_bribeAddressOS
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
            addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
            oethUnits("0.7"), //_split
            oethUnits("1") //_salt
          )
        // Invalid bribeContractOS address
      ).to.be.revertedWith("Failed creating a pool booster");

      await expect(
        poolBoosterDoubleFactoryV1
          .connect(strategist)
          .createPoolBoosterSwapxDouble(
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
            addresses.zero, //_bribeAddressOther
            addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
            oethUnits("0.7"), //_split
            oethUnits("1") //_salt
          )
        // Invalid bribeContractOther address
      ).to.be.revertedWith("Failed creating a pool booster");

      await expect(
        poolBoosterDoubleFactoryV1
          .connect(strategist)
          .createPoolBoosterSwapxDouble(
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
            addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
            oethUnits("1"), //_split
            oethUnits("1") //_salt
          )
        // Unexpected split amount
      ).to.be.revertedWith("Failed creating a pool booster");

      await expect(
        poolBoosterDoubleFactoryV1
          .connect(strategist)
          .createPoolBoosterSwapxDouble(
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
            addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
            oethUnits("0.009"), //_split
            oethUnits("1") //_salt
          )
        // Unexpected split amount
      ).to.be.revertedWith("Failed creating a pool booster");

      await expect(
        poolBoosterDoubleFactoryV1
          .connect(strategist)
          .createPoolBoosterSwapxDouble(
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOS
            addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddressOther
            addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
            oethUnits("0.7"), //_split
            oethUnits("0") //_salt
          )
        // Unexpected split amount
      ).to.be.revertedWith("Invalid salt");
    });

    it("Should throw an error when non governor is trying to create a pool booster", async () => {
      const { poolBoosterSingleFactoryV1, poolBoosterDoubleFactoryV1, nick } =
        fixture;

      await expect(
        poolBoosterSingleFactoryV1.connect(nick).createPoolBoosterSwapxSingle(
          addresses.sonic.SwapXOsUSDCe.extBribeOS, //_bribeAddress
          addresses.sonic.SwapXOsGEMSx.pool, //_ammPoolAddress
          oethUnits("1") //_salt
        )
      ).to.be.revertedWith("Caller is not the Governor");

      await expect(
        poolBoosterDoubleFactoryV1.connect(nick).createPoolBoosterSwapxDouble(
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

    it("Can not approve a zero address factory", async () => {
      const { poolBoosterCentralRegistry, governor } = fixture;

      await expect(
        poolBoosterCentralRegistry
          .connect(governor)
          .approveFactory(addresses.zero)
      ).to.be.revertedWith("Invalid address");
    });

    it("Can not remove a zero address factory", async () => {
      const { poolBoosterCentralRegistry, governor } = fixture;

      await expect(
        poolBoosterCentralRegistry
          .connect(governor)
          .removeFactory(addresses.zero)
      ).to.be.revertedWith("Invalid address");
    });

    it("Can not remove a factory that hasn't been approved", async () => {
      const { poolBoosterCentralRegistry, governor } = fixture;
      const someFactoryAddress = addresses.sonic.SwapXOsUSDCe.extBribeOS;

      await expect(
        poolBoosterCentralRegistry
          .connect(governor)
          .removeFactory(someFactoryAddress)
      ).to.be.revertedWith("Not an approved factory");
    });

    it("Can not call emit pool booster created if not a factory", async () => {
      const { poolBoosterCentralRegistry, nick } = fixture;

      await expect(
        poolBoosterCentralRegistry
          .connect(nick)
          .emitPoolBoosterCreated(addresses.zero, addresses.zero, 0)
      ).to.be.revertedWith("Not an approved factory");
    });

    it("Can not call emit pool booster removed if not a factory", async () => {
      const { poolBoosterCentralRegistry, nick } = fixture;

      await expect(
        poolBoosterCentralRegistry
          .connect(nick)
          .emitPoolBoosterRemoved(addresses.zero)
      ).to.be.revertedWith("Not an approved factory");
    });
  });

  describe("Deploying the new pool boosters", async () => {
    it("Can not deploy a factory with zero sonic address", async () => {
      const { poolBoosterCentralRegistry } = fixture;
      await expect(
        deployWithConfirmation(
          "PoolBoosterFactorySwapxSingle_v1",
          [
            addresses.zero,
            addresses.sonic.timelock,
            poolBoosterCentralRegistry.address,
          ],
          "PoolBoosterFactorySwapxSingle"
        )
      ).to.be.revertedWith("Invalid oToken address");
    });

    it("Can not deploy a factory with zero governor address", async () => {
      const { poolBoosterCentralRegistry } = fixture;
      await expect(
        deployWithConfirmation(
          "PoolBoosterFactorySwapxSingle_v1",
          [
            addresses.sonic.OSonicProxy,
            addresses.zero,
            poolBoosterCentralRegistry.address,
          ],
          "PoolBoosterFactorySwapxSingle"
        )
      ).to.be.revertedWith("Invalid governor address");
    });

    it("Can not deploy a factory with zero central registry address", async () => {
      await expect(
        deployWithConfirmation(
          "PoolBoosterFactorySwapxSingle_v1",
          [
            addresses.sonic.OSonicProxy,
            addresses.sonic.timelock,
            addresses.zero,
          ],
          "PoolBoosterFactorySwapxSingle"
        )
      ).to.be.revertedWith("Invalid central registry address");
    });
  });
});
