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

    let executeData;

    it("Querying keeper returns run indicator and associated data", async () => {
      const { keeper } = await loadFixture(loadedKeeper);

      let dummyBytes = utils.defaultAbiCoder.encode(["string"], ["NA"]);
      let result = await keeper.checkUpkeep(dummyBytes);
      executeData = result.dynamicData;
    });

    it("Executing keeper returns run indicator and associated data", async () => {
      const { keeper } = await loadFixture(loadedKeeper);
      let tx = await keeper.performUpkeep(executeData);
   });

  });
});

async function loadedKeeper() {
  const fixture = await loadFixture(defaultFixture);
  const { keeper, vault, matt } = fixture;

  await keeper.connect(matt);
  await vault.connect(matt);

  return fixture;
}