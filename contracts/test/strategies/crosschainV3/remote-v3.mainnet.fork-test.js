const { createFixtureLoader, defaultFixture } = require("../../_fixture");
const { expect } = require("chai");
const { isCI } = require("../../helpers");
const { impersonateAndFund } = require("../../../utils/signers");
const addresses = require("../../../utils/addresses");
const { getCreate2ProxyAddress } = require("../../../deploy/deployActions");

const mainnetFixture = createFixtureLoader(defaultFixture);

const MSG = {
  DEPOSIT: 1,
  DEPOSIT_ACK: 2,
  BRIDGE_IN: 11,
  BRIDGE_OUT: 12,
};

const encodeBridgeUserPayload = ({
  bridgeId,
  amount,
  recipient,
  callData = "0x",
  callGasLimit = 0,
}) =>
  ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "uint256", "address", "bytes", "uint32"],
    [bridgeId, amount, recipient, callData, callGasLimit]
  );

/**
 * Mainnet fork test covering RemoteWOTokenStrategy against the real wOETH (ERC-4626) and
 * the real OETH vault.
 *
 * The withdrawal flow (leg 1 + queue + leg 2) is covered by
 * `withdrawal.mainnet.fork-test.js`. This file focuses on:
 *   - Wiring sanity against the typed contract refs.
 *   - The YIELD_DEPOSIT pipeline (WETH → OETH via vault → wOETH via 4626).
 *   - The user-initiated BRIDGE_IN outbound path (OETH → wOETH wrap; envelope round-trip).
 *
 * Both functional tests swap Remote's adapters to a fresh impersonated inbound signer +
 * MockBridgeAdapter outbound so we don't need to drive the real CCIP router on a fork.
 */
describe("ForkTest: RemoteWOTokenStrategy on mainnet (real wOETH + OETH vault)", function () {
  this.timeout(0);
  this.retries(isCI ? 3 : 0);

  let remote;
  let woeth;
  let oeth;
  let weth;
  let oethVault;
  let outboundAdapter;
  let inboundAdapter;

  beforeEach(async () => {
    await mainnetFixture();

    const proxyAddr = await getCreate2ProxyAddress("OETHbV3RemoteProxy");
    remote = await ethers.getContractAt("RemoteWOTokenStrategy", proxyAddr);

    woeth = await ethers.getContractAt(
      "IERC4626",
      addresses.mainnet.WOETHProxy
    );
    oeth = await ethers.getContractAt(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      addresses.mainnet.OETHProxy
    );
    weth = await ethers.getContractAt("IWETH9", addresses.mainnet.WETH);
    oethVault = await ethers.getContractAt(
      "IVault",
      addresses.mainnet.OETHVaultProxy
    );

    outboundAdapter = await ethers.getContractAt(
      "SuperbridgeAdapter",
      await remote.outboundAdapter()
    );
    inboundAdapter = await ethers.getContractAt(
      "CCIPAdapter",
      await remote.inboundAdapter()
    );
  });

  it("is wired to the real mainnet wOETH / OETH / OETH vault", async () => {
    expect(await remote.bridgeAsset()).to.equal(weth.address);
    expect(await remote.oToken()).to.equal(oeth.address);
    expect(await remote.woToken()).to.equal(woeth.address);
    expect(await remote.oTokenVault()).to.equal(oethVault.address);
    expect(await remote.operator()).to.equal(addresses.talosRelayer);

    // The 4626 wraps the same OETH that the strategy holds.
    expect(await woeth.asset()).to.equal(oeth.address);
  });

  it("claimRemoteWithdrawal is idempotent when nothing is outstanding", async () => {
    await expect(remote.claimRemoteWithdrawal()).to.not.be.reverted;
    expect(await remote.outstandingRequestId()).to.equal(0);
    expect(await remote.queuedAmount()).to.equal(0);
  });

  it("checkBalance is zero on a freshly deployed Remote", async () => {
    expect(await remote.checkBalance(weth.address)).to.equal(0);
  });

  describe("YIELD_DEPOSIT pipeline (WETH → OETH → wOETH)", () => {
    const DEPOSIT_AMOUNT = ethers.utils.parseEther("1");

    it("mints OETH via the vault, wraps to wOETH, emits DEPOSIT_ACK", async () => {
      // Swap adapters: fresh impersonated inbound signer + MockBridgeAdapter outbound.
      const sTimelock = await impersonateAndFund(addresses.mainnet.Timelock);
      const MockAdapterF = await ethers.getContractFactory("MockBridgeAdapter");
      const mockOut = await MockAdapterF.deploy();
      await mockOut.deployed();
      await mockOut.setSender(remote.address);
      await remote.connect(sTimelock).setOutboundAdapter(mockOut.address);

      const [deployer] = await ethers.getSigners();
      const inboundSigner = await impersonateAndFund(deployer.address);
      await remote.connect(sTimelock).setInboundAdapter(deployer.address);

      // Fund Remote with WETH (wrap native via WETH9).
      await deployer.sendTransaction({
        to: weth.address,
        value: DEPOSIT_AMOUNT,
      });
      await weth.connect(deployer).transfer(remote.address, DEPOSIT_AMOUNT);
      expect(await weth.balanceOf(remote.address)).to.equal(DEPOSIT_AMOUNT);

      const sharesBefore = await woeth.balanceOf(remote.address);

      // Drive the inbound DEPOSIT.
      await remote
        .connect(inboundSigner)
        .receiveFromBridge(1, DEPOSIT_AMOUNT, MSG.DEPOSIT, "0x");

      // WETH was consumed by the vault mint.
      expect(await weth.balanceOf(remote.address)).to.equal(0);
      // OETH was wrapped into wOETH — share count grew.
      expect(await woeth.balanceOf(remote.address)).to.be.gt(sharesBefore);
      // No bare OETH left on Remote.
      expect(await oeth.balanceOf(remote.address)).to.equal(0);

      // checkBalance reflects the wrapped value (within 1 wei rounding).
      const total = await remote.checkBalance(weth.address);
      expect(total).to.be.closeTo(DEPOSIT_AMOUNT, 1);

      // The outbound MockBridgeAdapter recorded the DEPOSIT_ACK envelope.
      const sent = await mockOut.lastMessageSent();
      const msgType = parseInt(sent.slice(2 + 8, 2 + 16), 16);
      expect(msgType).to.equal(MSG.DEPOSIT_ACK);
    });
  });

  describe("BRIDGE_IN outbound (user wraps OETH on Ethereum)", () => {
    const BRIDGE_AMOUNT = ethers.utils.parseEther("0.5");

    it("wraps user OETH to wOETH and emits a BRIDGE_IN envelope to the outbound adapter", async () => {
      // Swap the outbound adapter to MockBridgeAdapter so the test doesn't drive the real CCIP.
      const sTimelock = await impersonateAndFund(addresses.mainnet.Timelock);
      const MockAdapterF = await ethers.getContractFactory("MockBridgeAdapter");
      const mockOut = await MockAdapterF.deploy();
      await mockOut.deployed();
      await mockOut.setSender(remote.address);
      await remote.connect(sTimelock).setOutboundAdapter(mockOut.address);

      // A user signer mints OETH via the real vault, then bridges it.
      const [, user] = await ethers.getSigners();
      await user.sendTransaction({
        to: weth.address,
        value: BRIDGE_AMOUNT,
      });
      await weth.connect(user).approve(oethVault.address, BRIDGE_AMOUNT);
      await oethVault.connect(user)["mint(uint256)"](BRIDGE_AMOUNT);
      const userOETH = await oeth.balanceOf(user.address);
      expect(userOETH).to.be.gte(BRIDGE_AMOUNT);

      const sharesBefore = await woeth.balanceOf(remote.address);

      // User approves Remote and bridges.
      await oeth.connect(user).approve(remote.address, BRIDGE_AMOUNT);
      await expect(
        remote
          .connect(user)
          .bridgeOTokenToPeer(BRIDGE_AMOUNT, user.address, "0x", 0)
      ).to.emit(remote, "BridgeRequested");

      // wOETH share count on Remote grew (4626 deposit landed).
      expect(await woeth.balanceOf(remote.address)).to.be.gt(sharesBefore);

      // The outbound adapter recorded a BRIDGE_IN envelope.
      const sent = await mockOut.lastMessageSent();
      // 36-byte header: 4 version + 4 msgType + 8 nonce + 20 sender.
      const msgType = parseInt(sent.slice(2 + 8, 2 + 16), 16);
      expect(msgType).to.equal(MSG.BRIDGE_IN);

      // Payload is the BridgeUserPayload, decoded via the helper.
      const payloadHex = "0x" + sent.slice(2 + 72);
      const decoded = ethers.utils.defaultAbiCoder.decode(
        ["bytes32", "uint256", "address", "bytes", "uint32"],
        payloadHex
      );
      expect(decoded[1]).to.equal(BRIDGE_AMOUNT); // amount
      expect(decoded[2].toLowerCase()).to.equal(user.address.toLowerCase());

      // Sanity: encodeBridgeUserPayload helper produces matching bytes for the same fields.
      const roundTrip = encodeBridgeUserPayload({
        bridgeId: decoded[0],
        amount: decoded[1],
        recipient: decoded[2],
        callData: decoded[3],
        callGasLimit: decoded[4],
      });
      expect(roundTrip).to.equal(payloadHex);
    });
  });

  describe("SuperbridgeAdapter (outbound, real deployment)", () => {
    it("has WETH mapped to Base WETH for the canonical bridge", async () => {
      expect(
        await outboundAdapter.remoteTokenOf(addresses.mainnet.WETH)
      ).to.equal(addresses.base.WETH);
    });

    it("is governed by the mainnet Timelock", async () => {
      expect(await outboundAdapter.governor()).to.equal(
        addresses.mainnet.Timelock
      );
    });

    it("has Remote authorised as a sender", async () => {
      expect(await outboundAdapter.authorised(remote.address)).to.equal(true);
    });
  });

  describe("CCIPAdapter (inbound, real deployment)", () => {
    it("only the CCIP router can drive ccipReceive", async () => {
      const [a] = await ethers.getSigners();
      await expect(
        inboundAdapter.connect(a).ccipReceive({
          messageId: ethers.utils.hexZeroPad("0x0", 32),
          sourceChainSelector: 0,
          sender: "0x",
          data: "0x",
          destTokenAmounts: [],
        })
      ).to.be.revertedWith("CCIP: not router");
    });
  });
});
