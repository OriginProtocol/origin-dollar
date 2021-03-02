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

describe("Keeper", async function () {

  const KEEPER_EVENT_TYPE_CHECK = 'check';
  const KEEPER_EVENT_TYPE_EXECUTE = 'execute';

  if (isFork) {
    this.timeout(0);
  }

  describe("Keeper Calls", () => {

    it("Active jobs should be detected and executed", async () => {
      const fixture = await loadFixture(defaultFixture);
      const { keeper, vault, matt } = fixture;

      let dummyBytes = utils.defaultAbiCoder.encode(["string"], ["NA"]);

      let txCheck = keeper.populateTransaction.checkUpkeep(dummyBytes);
      let data = await hre.ethers.provider.call(txCheck);

      let returnValue = utils.defaultAbiCoder.decode([ 'bool', 'bytes' ], data);
      
      let txRun = await keeper.performUpkeep(returnValue[1]);
    });

  });
});