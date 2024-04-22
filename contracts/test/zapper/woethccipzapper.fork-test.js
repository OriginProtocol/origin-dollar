const { expect } = require("chai");
const { parseUnits } = require("ethers").utils;
const { woethCcipZapperFixture } = require("../_fixture");
describe("ForkTest: WOETH CCIP Zapper", function () {
  this.timeout(0);

  let fixture;

  beforeEach(async () => {
    fixture = await woethCcipZapperFixture();
  });

  it("zap(): Should zap ETH  and send WOETH to CCIP contract", async () => {
    const { woethZapper, woethOnSourceChain, mockCcipRouter, josh } = fixture;
    const depositAmount = parseUnits("5");

    await woethZapper.connect(josh).zap(josh.address, { value: depositAmount });
    expect(await woethOnSourceChain.balanceOf(mockCcipRouter.address)).to.gt(0);
  });

  it("zap(): Should emit Zap event with args", async () => {
    const { woethZapper, josh, alice } = fixture;
    const depositAmount = parseUnits("5");

    let tx = await woethZapper
      .connect(josh)
      .zap(alice.address, { value: depositAmount });
    await expect(tx)
      .to.emit(woethZapper, "Zap")
      .withArgs(
        "0xdeadfeed".padEnd(66, "00"),
        josh.address,
        alice.address,
        depositAmount
      );
  });
  it("receive(): Should zap ETH and send WOETH to CCIP contract", async () => {
    const { woethZapper, woethOnSourceChain, mockCcipRouter, josh } = fixture;
    const depositAmount = parseUnits("5");

    await josh.sendTransaction({
      to: woethZapper.address,
      value: depositAmount, // Send ether to zapper contract
    });

    expect(await woethOnSourceChain.balanceOf(mockCcipRouter.address)).to.gt(0);
  });

  it("receive(): Should emit Zap event with args", async () => {
    const { woethZapper, josh } = fixture;
    const depositAmount = parseUnits("5");

    let tx = await josh.sendTransaction({
      to: woethZapper.address,
      value: depositAmount, // Send ether to zapper contract
    });
    await expect(tx)
      .to.emit(woethZapper, "Zap")
      .withArgs(
        "0xdeadfeed".padEnd(66, "00"),
        josh.address,
        josh.address,
        depositAmount
      );
  });
});
