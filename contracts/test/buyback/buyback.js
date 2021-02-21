const { expect } = require("chai");

const { defaultFixture } = require("../_fixture");
const { loadFixture } = require("../helpers");

describe("OGN Buyback", function () {
  before(async () => {});

  it("Should allow Governor to set Trustee address", async () => {
    const { vault, governor, ousd } = await loadFixture(defaultFixture);
    // Pretend OUSD is trustee
    await vault.connect(governor).setTrusteeAddress(ousd.address);
  });

  it("Should not allow non-Governor to set Trustee address");

  it("Should swap OUSD balance for OGN");

  it("Should allow withdrawal of arbitrary token by Governor");

  it("Should not allow withdrawal of arbitrary token by non-Governor");
});
