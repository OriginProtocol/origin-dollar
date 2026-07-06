const { expect } = require("chai");
const { ethers } = require("hardhat");
const { impersonateAndFund } = require("../../../utils/signers");

/**
 * Unit coverage for SuperbridgeAdapter exact-amount delivery semantics and
 * multi-tenant routing via the envelope-sender whitelist.
 *
 * Under the new envelope shape `(sender, intendedAmount, payload)`:
 *   - Split delivery is driven by `intendedAmount`: > 0 means tokens accompany the
 *     message via the canonical bridge; 0 means message-only.
 *   - The adapter waits in a per-target pending slot until WETH balance covers
 *     `intendedAmount`, then forwards via `receiveMessage`.
 *   - Inbound trust: transport sender must equal `address(this)` (CREATE3 parity),
 *     envelope sender must be authorised, source chain must match the lane config.
 */
describe("Unit: SuperbridgeAdapter split delivery", function () {
  let governor, routerSigner, otherSigner;
  let receiver, strategy, strategy2, wethMock;

  // Ethereum CCIP selector (mirrors `addresses.mainnet.CCIPChainSelector`).
  // Inlined as a literal because this test only needs the value, not the
  // address resolution; `BigNumber.from(string)` avoids the BigInt literal
  // syntax (`n` suffix) that eslint refuses to parse in this repo.
  const PEER_CHAIN = ethers.BigNumber.from("5009297550715157269");
  const DEST_GAS_LIMIT = 500000;

  // Build the CCIP message struct (Client.Any2EVMMessage). The transport `sender`
  // field must equal the receiving adapter's own address — CREATE3 parity binds the
  // peer adapter to the same address. Tests default to that.
  function buildAny2EvmMessage({
    messageId = ethers.utils.hexZeroPad("0x1", 32),
    transportSender,
    data,
    destTokenAmounts = [],
  }) {
    return {
      messageId,
      sourceChainSelector: PEER_CHAIN,
      sender: ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [transportSender]
      ),
      data,
      destTokenAmounts,
    };
  }

  // Wire envelope: 20-byte sender + 32-byte intendedAmount + payload.
  function wrapEnvelope(sender, intendedAmount, payload) {
    return ethers.utils.solidityPack(
      ["address", "uint256", "bytes"],
      [sender, intendedAmount, payload]
    );
  }

  // Strategy-level payload — opaque to the adapter; we pass arbitrary bytes here.
  function packPayload(label) {
    return ethers.utils.defaultAbiCoder.encode(["string"], [label]);
  }

  beforeEach(async () => {
    [governor, routerSigner, otherSigner] = await ethers.getSigners();

    // Mock CCIP router (we'll impersonate it to call ccipReceive directly).
    const RouterFactory = await ethers.getContractFactory("MockCCIPRouter");
    const router = await RouterFactory.connect(governor).deploy();

    const WETHFactory = await ethers.getContractFactory("MockWETH");
    wethMock = await WETHFactory.connect(governor).deploy();

    const ReceiverFactory = await ethers.getContractFactory(
      "SuperbridgeAdapter"
    );
    // Inbound-only deployment: pass address(0) for the L1StandardBridge (unused on
    // the L2 side; outbound entrypoints revert when invoked). The L2-side `receive()`
    // wraps incoming native ETH to WETH (the adapter's `weth` immutable).
    receiver = await ReceiverFactory.connect(governor).deploy(
      ethers.constants.AddressZero,
      router.address,
      wethMock.address
    );

    const StrategyFactory = await ethers.getContractFactory(
      "MockBridgeReceiver"
    );
    strategy = await StrategyFactory.connect(governor).deploy();
    strategy2 = await StrategyFactory.connect(governor).deploy();

    // Lane config for each authorised sender: paused=false, chain=mainnet, gas=500k.
    const cfg = {
      paused: false,
      chainSelector: PEER_CHAIN,
      destGasLimit: DEST_GAS_LIMIT,
    };
    await receiver.connect(governor).authorise(strategy.address, cfg);
  });

  // Simulate the OP Stack canonical bridge delivering native ETH to the adapter.
  // The adapter's `receive()` wraps the ETH into the local WETH automatically.
  const deliverBridgeEth = async (amount) => {
    await governor.sendTransaction({ to: receiver.address, value: amount });
  };

  it("token-carrying message with tokens already on adapter delivers atomically", async () => {
    const amount = ethers.utils.parseUnits("100", 6);
    await deliverBridgeEth(amount);

    const data = wrapEnvelope(
      strategy.address,
      amount,
      packPayload("claim-ack")
    );

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver
      .connect(sRouter)
      .ccipReceive(
        buildAny2EvmMessage({ data, transportSender: receiver.address })
      );

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastAmount()).to.equal(amount);
    expect(await strategy.lastToken()).to.equal(wethMock.address);
    expect(await wethMock.balanceOf(strategy.address)).to.equal(amount);
    expect(await wethMock.balanceOf(receiver.address)).to.equal(0);
  });

  it("message-first: stores until tokens land, then exact delivery", async () => {
    const amount = ethers.utils.parseUnits("250", 6);
    const data = wrapEnvelope(strategy.address, amount, packPayload("pending"));

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver
      .connect(sRouter)
      .ccipReceive(
        buildAny2EvmMessage({ data, transportSender: receiver.address })
      );

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(true);
    expect(await strategy.callCount()).to.equal(0);

    await expect(
      receiver.processStoredMessage(strategy.address)
    ).to.be.revertedWith("Super: tokens not yet landed");

    // Tokens arrive (canonical bridge credits native ETH to the adapter; `receive()`
    // wraps to WETH). Donate one extra wei to confirm the receiver delivers exactly
    // `intendedAmount` rather than the full balance.
    await deliverBridgeEth(amount.add(1));

    await receiver.processStoredMessage(strategy.address);

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastAmount()).to.equal(amount);
    expect(await wethMock.balanceOf(strategy.address)).to.equal(amount);
    expect(await wethMock.balanceOf(receiver.address)).to.equal(1);
  });

  it("intendedAmount=0 is message-only — delivers immediately, no token leg", async () => {
    const data = wrapEnvelope(strategy.address, 0, packPayload("message-only"));

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await receiver
      .connect(sRouter)
      .ccipReceive(
        buildAny2EvmMessage({ data, transportSender: receiver.address })
      );

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastAmount()).to.equal(0);
    expect(await strategy.lastToken()).to.equal(ethers.constants.AddressZero);
  });

  it("rejects an envelope whose sender is not whitelisted", async () => {
    const data = wrapEnvelope(otherSigner.address, 0, packPayload("evil"));

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await expect(
      receiver
        .connect(sRouter)
        .ccipReceive(
          buildAny2EvmMessage({ data, transportSender: receiver.address })
        )
    ).to.be.revertedWith("Adapter: not authorised");

    // Direct call from a non-router caller is rejected by the modifier.
    const authData = wrapEnvelope(strategy.address, 0, packPayload("noop"));
    await expect(
      receiver.connect(routerSigner).ccipReceive(
        buildAny2EvmMessage({
          data: authData,
          transportSender: receiver.address,
        })
      )
    ).to.be.revertedWith("Super: not router");
  });

  it("rejects a message whose transport sender is not the peer adapter", async () => {
    // CREATE3 parity: transport sender must equal address(this). A spoofed source-chain
    // contract that managed to craft a CCIP message with a forged envelope sender still
    // fails this check.
    const data = wrapEnvelope(strategy.address, 0, packPayload("spoof"));

    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await expect(
      receiver.connect(sRouter).ccipReceive(
        buildAny2EvmMessage({
          data,
          transportSender: otherSigner.address,
        })
      )
    ).to.be.revertedWith("Adapter: not from peer adapter");
  });

  it("respects per-lane pause for inbound delivery", async () => {
    await receiver.connect(governor).pauseLane(strategy.address);

    const data = wrapEnvelope(strategy.address, 0, packPayload("paused"));
    const sRouter = await impersonateAndFund(await receiver.ccipRouter());
    await expect(
      receiver
        .connect(sRouter)
        .ccipReceive(
          buildAny2EvmMessage({ data, transportSender: receiver.address })
        )
    ).to.be.revertedWith("Adapter: lane paused");

    // Unpause restores delivery.
    await receiver.connect(governor).unpauseLane(strategy.address);
    await receiver
      .connect(sRouter)
      .ccipReceive(
        buildAny2EvmMessage({ data, transportSender: receiver.address })
      );
    expect(await strategy.callCount()).to.equal(1);
  });

  it("stored message honours a pause/revoke issued after it was stored (incident response)", async () => {
    const amount = ethers.utils.parseUnits("250", 6);
    const data = wrapEnvelope(strategy.address, amount, packPayload("pending"));
    const sRouter = await impersonateAndFund(await receiver.ccipRouter());

    // Message stored while the lane is healthy (token leg not yet landed).
    await receiver
      .connect(sRouter)
      .ccipReceive(
        buildAny2EvmMessage({ data, transportSender: receiver.address })
      );
    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(true);

    // Canonical-bridge ETH lands and `receive()` wraps it to WETH.
    await deliverBridgeEth(amount);

    // Incident: governance pauses the lane. Deferred delivery must be blocked too, not just
    // the atomic ccipReceive path.
    await receiver.connect(governor).pauseLane(strategy.address);
    await expect(
      receiver.processStoredMessage(strategy.address)
    ).to.be.revertedWith("Super: lane paused");

    // Revoke leaves `paused` untouched, so this exercises the `authorised` check.
    await receiver.connect(governor).unpauseLane(strategy.address);
    await receiver.connect(governor).revoke(strategy.address);
    await expect(
      receiver.processStoredMessage(strategy.address)
    ).to.be.revertedWith("Super: not authorised");

    // The message + its WETH were held, not lost: re-authorise + unpause and delivery resumes.
    await receiver.connect(governor).authorise(strategy.address, {
      paused: false,
      chainSelector: PEER_CHAIN,
      destGasLimit: DEST_GAS_LIMIT,
    });
    await receiver.processStoredMessage(strategy.address);
    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.callCount()).to.equal(1);
    expect(await strategy.lastAmount()).to.equal(amount);
    expect(await wethMock.balanceOf(strategy.address)).to.equal(amount);
  });

  it("multi-tenant: one adapter routes messages to distinct targets by envelope sender", async () => {
    const cfg = {
      paused: false,
      chainSelector: PEER_CHAIN,
      destGasLimit: DEST_GAS_LIMIT,
    };
    await receiver.connect(governor).authorise(strategy2.address, cfg);

    const amount1 = ethers.utils.parseUnits("100", 6);
    const amount2 = ethers.utils.parseUnits("250", 6);
    const sRouter = await impersonateAndFund(await receiver.ccipRouter());

    await receiver.connect(sRouter).ccipReceive(
      buildAny2EvmMessage({
        data: wrapEnvelope(strategy.address, amount1, packPayload("a")),
        transportSender: receiver.address,
      })
    );
    await receiver.connect(sRouter).ccipReceive(
      buildAny2EvmMessage({
        data: wrapEnvelope(strategy2.address, amount2, packPayload("b")),
        transportSender: receiver.address,
      })
    );

    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(true);
    expect(await receiver.hasPendingMessage(strategy2.address)).to.equal(true);

    // Fund the bridge-ETH leg for the second tenant first and process — confirms slots
    // don't collide and tokens credit the right target.
    await deliverBridgeEth(amount2);
    await receiver.processStoredMessage(strategy2.address);
    expect(await receiver.hasPendingMessage(strategy2.address)).to.equal(false);
    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(true);
    expect(await strategy2.lastAmount()).to.equal(amount2);
    expect(await wethMock.balanceOf(strategy2.address)).to.equal(amount2);
    expect(await strategy.callCount()).to.equal(0);

    // Now fund the bridge-ETH leg for the first tenant and process.
    await deliverBridgeEth(amount1);
    await receiver.processStoredMessage(strategy.address);
    expect(await receiver.hasPendingMessage(strategy.address)).to.equal(false);
    expect(await strategy.lastAmount()).to.equal(amount1);
    expect(await wethMock.balanceOf(strategy.address)).to.equal(amount1);
  });
});
