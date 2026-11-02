const { expect } = require("chai");
const { ethers } = require("ethers");

const { bridgeTopUp } = require("../lib/baseFeeBridge");

const eth = (v) => ethers.utils.parseEther(v);
const FEE = eth("0.019");
const TARGET = eth("0.0228"); // fee + 20%

describe("Base fee bridge", () => {
  describe("bridgeTopUp", () => {
    it("covers the fee plus headroom for an empty Safe", () => {
      expect(bridgeTopUp(eth("0"), FEE).toString()).to.equal(TARGET.toString());
    });

    it("sends only the shortfall when the Safe is below target", () => {
      expect(bridgeTopUp(eth("0.01"), FEE).toString()).to.equal(
        TARGET.sub(eth("0.01")).toString()
      );
    });

    it("sends nothing when the Safe is exactly at target", () => {
      expect(bridgeTopUp(TARGET, FEE).isZero()).to.equal(true);
    });

    it("sends nothing when the Safe is above target", () => {
      expect(bridgeTopUp(eth("1"), FEE).isZero()).to.equal(true);
    });
  });
});
