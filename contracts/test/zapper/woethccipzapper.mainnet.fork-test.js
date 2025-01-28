const { expect } = require("chai");
const { parseUnits } = require("ethers").utils;
const {
  createFixtureLoader,
  woethCcipZapperFixture,
  loadDefaultFixture,
} = require("../_fixture");
const addresses = require("../../utils/addresses");

const loadFixture = createFixtureLoader(woethCcipZapperFixture);

describe("ForkTest: WOETH CCIP Zapper", function () {
  this.timeout(0);

  let fixture;

  beforeEach(async () => {
    fixture = await loadFixture();
  });

  after(async () => {
    await loadDefaultFixture();
  });

  it("zap(): Should zap ETH  and send WOETH to CCIP TokenPool", async () => {
    const { woethZapper, woethOnSourceChain, woeth, josh } = fixture;
    const depositAmount = parseUnits("5");
    const feeAmount = await woethZapper.getFee(depositAmount, josh.address);
    const expectedAmountToBeSentToPool = await woeth.convertToShares(
      depositAmount.sub(feeAmount)
    );
    const poolBalanceBefore = await woethOnSourceChain.balanceOf(
      addresses.mainnet.ccipWoethTokenPool
    );
    await woethZapper.connect(josh).zap(josh.address, { value: depositAmount });
    const poolBalanceAfter = await woethOnSourceChain.balanceOf(
      addresses.mainnet.ccipWoethTokenPool
    );
    expect(poolBalanceAfter.sub(poolBalanceBefore)).to.approxEqualTolerance(
      expectedAmountToBeSentToPool,
      1
    );
  });
  it("zap(): Should emit Zap event with args", async () => {
    const { woethZapper, josh, anna } = fixture;
    const depositAmount = parseUnits("5");

    const feeAmount = await woethZapper.getFee(depositAmount, josh.address);
    const expectedAmountInEvent = depositAmount.sub(feeAmount);
    let tx = await woethZapper
      .connect(josh)
      .zap(anna.address, { value: depositAmount });
    await expect(tx).to.emit(woethZapper, "Zap").withNamedArgs({
      sender: josh.address,
      recipient: anna.address,
      amount: expectedAmountInEvent,
    });
  });

  it("zap(): Should be reverted with 'AmountLessThanFee'", async () => {
    const { woethZapper, josh } = fixture;

    const tx = woethZapper.connect(josh).zap(josh.address, { value: "1" });
    // Current HH version is not compatible with Custom errors.
    await expect(tx).to.be.reverted;
  });

  it("zap(): Should zap ETH (< 1) and emit Zap event with args", async () => {
    const { woethZapper, josh, anna } = fixture;
    const depositAmount = parseUnits("0.5");

    const feeAmount = await woethZapper.getFee(depositAmount, josh.address);
    const expectedAmountInEvent = depositAmount.sub(feeAmount);
    let tx = await woethZapper
      .connect(josh)
      .zap(anna.address, { value: depositAmount });
    await expect(tx).to.emit(woethZapper, "Zap").withNamedArgs({
      sender: josh.address,
      recipient: anna.address,
      amount: expectedAmountInEvent,
    });
  });
  it("receive(): Should zap ETH and send WOETH to CCIP TokenPool", async () => {
    const { woethZapper, woethOnSourceChain, woeth, josh } = fixture;
    const depositAmount = parseUnits("5");
    const feeAmount = await woethZapper.getFee(depositAmount, josh.address);
    const expectedAmountToBeSentToPool = await woeth.convertToShares(
      depositAmount.sub(feeAmount)
    );
    const poolBalanceBefore = await woethOnSourceChain.balanceOf(
      addresses.mainnet.ccipWoethTokenPool
    );
    await josh.sendTransaction({
      to: woethZapper.address,
      value: depositAmount, // Send ether to zapper contract
    });
    const poolBalanceAfter = await woethOnSourceChain.balanceOf(
      addresses.mainnet.ccipWoethTokenPool
    );
    expect(poolBalanceAfter.sub(poolBalanceBefore)).to.approxEqualTolerance(
      expectedAmountToBeSentToPool,
      1
    );
  });
  it("receive(): Should emit Zap event with args", async () => {
    const { woethZapper, josh } = fixture;
    const depositAmount = parseUnits("5");
    const feeAmount = await woethZapper.getFee(depositAmount, josh.address);
    const expectedAmountInEvent = depositAmount.sub(feeAmount);
    let tx = await josh.sendTransaction({
      to: woethZapper.address,
      value: depositAmount, // Send ether to zapper contract
    });
    await expect(tx).to.emit(woethZapper, "Zap").withNamedArgs({
      sender: josh.address,
      recipient: josh.address,
      amount: expectedAmountInEvent,
    });
  });
});
