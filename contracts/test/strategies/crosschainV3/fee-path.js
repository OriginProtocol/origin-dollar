const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Adapter fee-path coverage for `_consumeFee`.
 *
 * Two source paths the adapter must honor:
 *   - `msg.value == 0` → pre-funded capital. The adapter has ETH from a prior `receive()`
 *     deposit and pays the bridge fee out of its own balance. Used for protocol-driven
 *     yield-channel ops where the strategy entrypoint is non-payable.
 *   - `msg.value > 0` → user-paid. The caller supplied the fee; excess refunds to caller.
 *     Used for user-driven bridge-channel ops.
 *
 * Both paths revert when the relevant source can't cover the fee.
 */
describe("Unit: CCIPAdapter fee path", function () {
  let governor, sender, refundReceiver;
  let adapter, router;
  const DESTINATION = 1234567890;
  const GAS_LIMIT = 200000;

  beforeEach(async () => {
    [governor, sender, refundReceiver] = await ethers.getSigners();

    const RouterFactory = await ethers.getContractFactory("MockCCIPRouter");
    router = await RouterFactory.connect(governor).deploy();

    const AdapterFactory = await ethers.getContractFactory("CCIPAdapter");
    adapter = await AdapterFactory.connect(governor).deploy(router.address);

    // Authorise the sender EOA so it can call sendMessage directly.
    await adapter
      .connect(governor)
      .authoriseSender(sender.address, DESTINATION, refundReceiver.address);
    await adapter.connect(governor).setDestGasLimit(sender.address, GAS_LIMIT);
  });

  it("pre-funded path: msg.value=0 covers fee from adapter balance", async () => {
    const fee = ethers.utils.parseEther("0.05");
    await router.setFee(fee);

    // Fund the adapter via a plain ETH transfer (hits `receive()`).
    await governor.sendTransaction({
      to: adapter.address,
      value: fee.mul(2),
    });
    expect(await ethers.provider.getBalance(adapter.address)).to.equal(
      fee.mul(2)
    );

    const message = "0x1234";
    await expect(adapter.connect(sender).sendMessage(message)).to.not.be
      .reverted;

    // Adapter spent `fee` from its balance.
    expect(await ethers.provider.getBalance(adapter.address)).to.equal(fee);
    expect(await router.sentMessagesLength()).to.equal(1);
  });

  it("pre-funded path: msg.value=0 reverts when adapter is unfunded", async () => {
    await router.setFee(ethers.utils.parseEther("0.05"));

    await expect(
      adapter.connect(sender).sendMessage("0xdeadbeef")
    ).to.be.revertedWith("Fee: unfunded");
  });

  it("user-paid path: msg.value exactly covers fee", async () => {
    const fee = ethers.utils.parseEther("0.03");
    await router.setFee(fee);

    await expect(adapter.connect(sender).sendMessage("0xabcd", { value: fee }))
      .to.not.be.reverted;
    // Adapter retains no surplus (msg.value == fee).
    expect(await ethers.provider.getBalance(adapter.address)).to.equal(0);
  });

  it("user-paid path: reverts when msg.value < fee", async () => {
    const fee = ethers.utils.parseEther("0.05");
    await router.setFee(fee);

    await expect(
      adapter.connect(sender).sendMessage("0xabcd", { value: fee.sub(1) })
    ).to.be.revertedWith("Fee: insufficient");
  });

  it("yield-channel uses pre-funded path even if adapter has both kinds of capital", async () => {
    const fee = ethers.utils.parseEther("0.02");
    await router.setFee(fee);

    // Pre-fund + an inbound from a prior overpayment that wasn't refunded (defensive).
    await governor.sendTransaction({
      to: adapter.address,
      value: fee.mul(3),
    });

    // Two yield-style sends in a row (msg.value=0) consume from the pre-funded balance.
    await adapter.connect(sender).sendMessage("0x11");
    await adapter.connect(sender).sendMessage("0x22");

    expect(await ethers.provider.getBalance(adapter.address)).to.equal(
      fee.mul(1) // 3*fee − 2*fee
    );
  });
});
