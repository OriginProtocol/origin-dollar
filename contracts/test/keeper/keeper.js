const hre = require("hardhat");
const { defaultFixture } = require("../_fixture");
const { expect } = require("chai");
const { utils } = require("ethers");
const {
  daiUnits,
  ousdUnits,
  usdcUnits,
  usdtUnits,
  loadFixture,
  isFork,
  isTest,
} = require("../helpers");
const { parseUnits } = require("ethers/lib/utils");

describe("Upkeep", async function () {
  const KEEPER_EVENT_TYPE_CHECK = "check";
  const KEEPER_EVENT_TYPE_EXECUTE = "execute";

  if (isFork) {
    this.timeout(0);
  }

  describe("Keeper Calls", () => {
    it("Rebase and Allocate should be run with upkeepId: `rebasePlusAllocate`", async () => {
      const fixture = await loadFixture(defaultFixture);
      const { keeper } = fixture;
      const REBASE_ALLOCATE_UPKEEP_ID = "rebasePlusAllocate";
      const upkeepId = utils.defaultAbiCoder.encode(
        ["string"],
        [REBASE_ALLOCATE_UPKEEP_ID]
      );

      // Note that we call a non-view function to get a value without a tx - aka `simulate`
      // This saves on gas costs for the keeper as they will call this `check` often
      const txCheck = keeper.populateTransaction.checkUpkeep(upkeepId);
      const checkData = await hre.ethers.provider.call(txCheck);

      const checkValues = utils.defaultAbiCoder.decode(
        ["bool", "bytes"],
        checkData
      );

      const shouldRun = checkValues[0];
      expect(shouldRun).to.be.true;

      const performData = checkValues[1];
      const performDataString = utils.defaultAbiCoder.decode(
        ["string"],
        performData
      );
      expect(performDataString[0]).to.equal(REBASE_ALLOCATE_UPKEEP_ID);

      let txRun = await keeper.performUpkeep(performData);
    });

    it("Rebase should be run with upkeepId: `rebase`", async () => {
      const fixture = await loadFixture(defaultFixture);
      const { keeper } = fixture;
      const REBASE_UPKEEP_ID = "rebase";
      const upkeepId = utils.defaultAbiCoder.encode(
        ["string"],
        [REBASE_UPKEEP_ID]
      );

      // Note that we call a non-view function to get a value without a tx - aka `simulate`
      // This saves on gas costs for the keeper as they will call this `check` often
      const txCheck = keeper.populateTransaction.checkUpkeep(upkeepId);
      const checkData = await hre.ethers.provider.call(txCheck);

      const checkValues = utils.defaultAbiCoder.decode(
        ["bool", "bytes"],
        checkData
      );

      const shouldRun = checkValues[0];
      expect(shouldRun).to.be.true;

      const performData = checkValues[1];
      const performDataString = utils.defaultAbiCoder.decode(
        ["string"],
        performData
      );
      expect(performDataString[0]).to.equal(REBASE_UPKEEP_ID);

      let txRun = await keeper.performUpkeep(performData);
    });

    it("Allocate should be run with upkeepId: `allocate`", async () => {
      const fixture = await loadFixture(defaultFixture);
      const { keeper } = fixture;
      const ALLOCATE_UPKEEP_ID = "allocate";
      const upkeepId = utils.defaultAbiCoder.encode(
        ["string"],
        [ALLOCATE_UPKEEP_ID]
      );

      // Note that we call a non-view function to get a value without a tx - aka `simulate`
      // This saves on gas costs for the keeper as they will call this `check` often
      const txCheck = keeper.populateTransaction.checkUpkeep(upkeepId);
      const checkData = await hre.ethers.provider.call(txCheck);

      const checkValues = utils.defaultAbiCoder.decode(
        ["bool", "bytes"],
        checkData
      );

      const shouldRun = checkValues[0];
      expect(shouldRun).to.be.true;

      const performData = checkValues[1];
      const performDataString = utils.defaultAbiCoder.decode(
        ["string"],
        performData
      );
      expect(performDataString[0]).to.equal(ALLOCATE_UPKEEP_ID);

      let txRun = await keeper.performUpkeep(performData);
    });
  });
});
