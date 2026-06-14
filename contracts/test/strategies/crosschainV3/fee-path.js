const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Adapter fee-path coverage for the new uniform model: `msg.value` covers the bridge fee
 * and any excess is refunded back to the caller. There is no pre-funded native pool —
 * operators fund their own yield-channel msg.value, users fund their own user-initiated
 * msg.value.
 */
describe("Unit: CCIPAdapter fee path", function () {
  let governor, sender;
  let adapter, router;
  const CCIP_DEST = ethers.BigNumber.from("5009297550715157269");
  const GAS_LIMIT = 200000;

  beforeEach(async () => {
    [governor, sender] = await ethers.getSigners();

    const RouterFactory = await ethers.getContractFactory("MockCCIPRouter");
    router = await RouterFactory.connect(governor).deploy();

    const AdapterFactory = await ethers.getContractFactory("CCIPAdapter");
    adapter = await AdapterFactory.connect(governor).deploy(router.address);

    // Authorise sender with the lane config.
    await adapter.connect(governor).authorise(sender.address, {
      paused: false,
      chainSelector: CCIP_DEST,
      destGasLimit: GAS_LIMIT,
    });
  });

  it("msg.value exactly covers fee — no refund needed", async () => {
    const fee = ethers.utils.parseEther("0.03");
    await router.setFee(fee);

    await expect(adapter.connect(sender).sendMessage("0xabcd", { value: fee }))
      .to.not.be.reverted;
    expect(await ethers.provider.getBalance(adapter.address)).to.equal(0);
  });

  it("msg.value above fee retains the excess on the adapter (no refund)", async () => {
    // Locked design: no refunds. Overpayment stays on the adapter for governor sweep
    // via `transferToken(address(0), amount)`. Rationale: refunds add code surface; the
    // caller can quote exact fee via `quoteFee` to avoid donations.
    const fee = ethers.utils.parseEther("0.03");
    const overpay = ethers.utils.parseEther("0.1");
    await router.setFee(fee);

    const tx = await adapter
      .connect(sender)
      .sendMessage("0xabcd", { value: overpay });
    await tx.wait();

    // Adapter balance increased by the FULL overpay (not just fee — the router consumed
    // `fee`, the rest stayed put).
    expect(await ethers.provider.getBalance(adapter.address)).to.equal(
      overpay.sub(fee)
    );
    expect(await router.sentMessagesLength()).to.equal(1);
  });

  it("reverts when msg.value < fee", async () => {
    const fee = ethers.utils.parseEther("0.05");
    await router.setFee(fee);

    await expect(
      adapter.connect(sender).sendMessage("0xabcd", { value: fee.sub(1) })
    ).to.be.revertedWith("Adapter: insufficient fee");
  });

  it("reverts when called by a non-authorised sender", async () => {
    const [, , stranger] = await ethers.getSigners();
    await expect(
      adapter.connect(stranger).sendMessage("0xabcd", { value: 1 })
    ).to.be.revertedWith("Adapter: not authorised");
  });

  it("respects per-lane pause", async () => {
    const fee = ethers.utils.parseEther("0.01");
    await router.setFee(fee);
    await adapter.connect(governor).pauseLane(sender.address);
    await expect(
      adapter.connect(sender).sendMessage("0xabcd", { value: fee })
    ).to.be.revertedWith("Adapter: lane paused");
  });
});
