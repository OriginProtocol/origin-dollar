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
  if (isFork) {
    this.timeout(0);
  }

  describe("Query Keeper", () => {
    it("Keeper returns run indicator and associated data", async () => {
      const { keeper } = await loadFixture(loadedKeeper);
      let dummyBytes = utils.defaultAbiCoder.encode(["string"], ["NA"]);
      const output = await keeper.checkUpkeep(dummyBytes);
      expect(output).to.equal(false);
    })
  });
});

async function loadedKeeper() {
  const fixture = await loadFixture(defaultFixture);
  const { keeper, vault, matt } = fixture;

  await keeper.connect(matt);
  await vault.connect(matt);

  return fixture;
}