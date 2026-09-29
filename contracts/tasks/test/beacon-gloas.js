const { expect } = require("chai");

const { assertGloasProgressiveSsz } = require("../../utils/beacon");
const esmImport = new Function("specifier", "return import(specifier)");

describe("Glamsterdam beacon proof support", () => {
  it("uses Lodestar Gloas Progressive SSZ types for strategy proof paths", async () => {
    await assertGloasProgressiveSsz();

    const { ssz } = await esmImport("@lodestar/types");
    const fields = ssz.gloas.BeaconState.fields;

    expect(fields.validators.constructor.name).to.equal(
      "ProgressiveListCompositeType"
    );
    expect(fields.balances.constructor.name).to.equal(
      "ProgressiveListBasicType"
    );
    expect(fields.pendingDeposits.constructor.name).to.equal(
      "ProgressiveListCompositeType"
    );
  });

  it("gets list-relative generalized indices from Lodestar list types", async () => {
    const { ssz } = await esmImport("@lodestar/types");
    const fields = ssz.gloas.BeaconState.fields;

    expect(fields.validators.getPropertyGindex(100).toString()).to.equal(
      "24079"
    );
    expect(fields.balances.getPropertyGindex(100).toString()).to.equal("2948");
    expect(fields.pendingDeposits.getPropertyGindex(100).toString()).to.equal(
      "24079"
    );
  });
});
