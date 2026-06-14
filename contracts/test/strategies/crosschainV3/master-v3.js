const { expect } = require("chai");
const { ethers } = require("hardhat");
const { impersonateAndFund } = require("../../../utils/signers");

const {
  MSG,
  encodePackedEnvelope,
  encodeBridgeUserPayload,
  encodeNewBalancePayload,
} = require("./_helpers");

// bridgeAsset (MockUSDC) is 6dp; remoteStrategyBalance is OToken-denominated (18dp). SCALE
// is the 6→18 factor used where a balance reported from Remote (18dp) meets a bridgeAsset
// (6dp) amount.
const SCALE = ethers.BigNumber.from(10).pow(12);

describe("Unit: MasterWOTokenStrategy", function () {
  let deployer, governor, alice, bob;
  let bridgeAsset, oToken, mockVault, master;
  let outboundAdapter, inboundAdapter;

  beforeEach(async () => {
    [deployer, governor, , alice, bob] = await ethers.getSigners();

    // --- Tokens & mock vault ---
    const ERC20Factory = await ethers.getContractFactory("MockUSDC");
    bridgeAsset = await ERC20Factory.deploy();

    const VaultFactory = await ethers.getContractFactory("MockOTokenVault");
    mockVault = await VaultFactory.deploy();

    const OTokenFactory = await ethers.getContractFactory(
      "MockMintableBurnableOToken"
    );
    oToken = await OTokenFactory.deploy(
      "Mock OToken",
      "mOT",
      mockVault.address
    );

    await mockVault.setOToken(oToken.address);

    // --- Master strategy: deploy impl behind the standard proxy ---
    const ImplFactory = await ethers.getContractFactory(
      "MasterWOTokenStrategy"
    );
    const impl = await ImplFactory.connect(deployer).deploy(
      {
        platformAddress: ethers.constants.AddressZero,
        vaultAddress: mockVault.address,
      },
      bridgeAsset.address,
      oToken.address
    );

    const ProxyFactory = await ethers.getContractFactory(
      "InitializeGovernedUpgradeabilityProxy"
    );
    const proxy = await ProxyFactory.connect(deployer).deploy();

    const initData = impl.interface.encodeFunctionData("initialize", [
      governor.address,
    ]);
    await proxy
      .connect(deployer)
      .initialize(impl.address, governor.address, initData);

    master = await ethers.getContractAt("MasterWOTokenStrategy", proxy.address);

    await mockVault.whitelistStrategy(master.address);

    // --- Adapters ---
    const AdapterFactory = await ethers.getContractFactory("MockBridgeAdapter");
    outboundAdapter = await AdapterFactory.deploy();
    inboundAdapter = await AdapterFactory.deploy();

    // Master is the sole authorised sender on its outbound adapter.
    await outboundAdapter.setSender(master.address);
    // Outbound has no peer in PR 2 tests — Master sends, we inspect lastMessageSent.

    // Receiver adapter forwards inbound messages to Master.
    await inboundAdapter.setPeer(master.address);
    // sender == 0 means anyone can drive the receiver in tests.

    await master.connect(governor).setOutboundAdapter(outboundAdapter.address);
    await master.connect(governor).setInboundAdapter(inboundAdapter.address);
  });

  describe("initialisation & roles", () => {
    it("stores constructor immutables", async () => {
      expect(await master.bridgeAsset()).to.equal(bridgeAsset.address);
      expect(await master.oToken()).to.equal(oToken.address);
      expect(await master.vaultAddress()).to.equal(mockVault.address);
    });

    it("supportsAsset returns true only for bridgeAsset", async () => {
      expect(await master.supportsAsset(bridgeAsset.address)).to.equal(true);
      expect(await master.supportsAsset(oToken.address)).to.equal(false);
    });

    it("only governor can set adapters / operator", async () => {
      await expect(
        master.connect(alice).setOutboundAdapter(alice.address)
      ).to.be.revertedWith("Caller is not the Governor");
      await expect(
        master.connect(alice).setInboundAdapter(alice.address)
      ).to.be.revertedWith("Caller is not the Governor");
      await expect(
        master.connect(alice).setOperator(alice.address)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("only inboundAdapter can call receiveMessage", async () => {
      await expect(
        master
          .connect(alice)
          .receiveMessage(master.address, ethers.constants.AddressZero, 0, "0x")
      ).to.be.revertedWith("V3: only inbound adapter");
    });
  });

  describe("deposit flow (DEPOSIT)", () => {
    const ONE_K = ethers.utils.parseUnits("1000", 6);

    it("vault.deposit assigns a yield nonce, sets pendingAmount, sends DEPOSIT", async () => {
      await bridgeAsset.mintTo(master.address, ONE_K);

      await mockVault.callDeposit(master.address, bridgeAsset.address, ONE_K);

      expect(await master.pendingAmount()).to.equal(ONE_K);
      expect(await master.lastYieldNonce()).to.equal(1);
      expect(await master.isYieldOpInFlight()).to.equal(true);

      // Adapter received the tokens.
      expect(await bridgeAsset.balanceOf(outboundAdapter.address)).to.equal(
        ONE_K
      );
      expect(await outboundAdapter.lastAmountSent()).to.equal(ONE_K);
      expect(await outboundAdapter.lastTokenSent()).to.equal(
        bridgeAsset.address
      );

      // Stored message decodes as DEPOSIT with nonce 1 and empty payload.
      // Master tags the envelope with its own address as the source strategy.
      const stored = await outboundAdapter.lastMessageSent();
      const expected = encodePackedEnvelope(
        MSG.DEPOSIT,
        1,
        "0x",
        master.address
      );
      expect(stored.toLowerCase()).to.equal(expected.toLowerCase());

      // checkBalance counts the in-flight amount.
      expect(await master.checkBalance(bridgeAsset.address)).to.equal(ONE_K);
    });

    it("rejects a second deposit while a yield op is in flight", async () => {
      await bridgeAsset.mintTo(master.address, ONE_K.mul(2));
      await mockVault.callDeposit(master.address, bridgeAsset.address, ONE_K);

      await expect(
        mockVault.callDeposit(master.address, bridgeAsset.address, ONE_K)
      ).to.be.revertedWith("Master: yield op in flight");
    });

    it("non-vault callers cannot deposit", async () => {
      await bridgeAsset.mintTo(master.address, ONE_K);
      await expect(
        master.connect(alice).deposit(bridgeAsset.address, ONE_K)
      ).to.be.revertedWith("Caller is not the Vault");
    });

    it("DEPOSIT_ACK clears pendingAmount and updates remoteStrategyBalance", async () => {
      await bridgeAsset.mintTo(master.address, ONE_K);
      await mockVault.callDeposit(master.address, bridgeAsset.address, ONE_K);

      // Simulate the ack arriving from Remote: encode envelope and have the receiver
      // adapter forward it to Master.
      const newBalance = ONE_K.mul(1).add(ethers.BigNumber.from("12345")); // arbitrary
      const ackEnvelope = encodePackedEnvelope(
        MSG.DEPOSIT_ACK,
        1,
        encodeNewBalancePayload(newBalance)
      );
      await inboundAdapter.sendMessage(ackEnvelope);

      expect(await master.pendingAmount()).to.equal(0);
      expect(await master.remoteStrategyBalance()).to.equal(newBalance);
      expect(await master.isYieldOpInFlight()).to.equal(false);

      // Replaying the same ack must fail (nonce already processed).
      await expect(inboundAdapter.sendMessage(ackEnvelope)).to.be.revertedWith(
        "V3: nonce already processed"
      );
    });

    it("rejects a DEPOSIT_ACK with a stale nonce", async () => {
      await bridgeAsset.mintTo(master.address, ONE_K);
      await mockVault.callDeposit(master.address, bridgeAsset.address, ONE_K);

      const bogus = encodePackedEnvelope(
        MSG.DEPOSIT_ACK,
        99,
        encodeNewBalancePayload(0)
      );
      await expect(inboundAdapter.sendMessage(bogus)).to.be.revertedWith(
        "V3: stale or unknown nonce"
      );
    });
  });

  describe("bridge-out (user-facing)", () => {
    beforeEach(async () => {
      // Seed Remote balance so the liquidity check passes via a synthetic deposit round-trip.
      const seed = ethers.utils.parseUnits("10000", 6);
      await bridgeAsset.mintTo(master.address, seed);
      await mockVault.callDeposit(master.address, bridgeAsset.address, seed);

      // Remote reports its yield baseline in OToken (18dp), so seed the ack in 18dp.
      const ack = encodePackedEnvelope(
        MSG.DEPOSIT_ACK,
        1,
        encodeNewBalancePayload(seed.mul(SCALE))
      );
      await inboundAdapter.sendMessage(ack);
    });

    const mintAndApprove = async (signer, amount) => {
      // Mint OToken to the user by simulating a BRIDGE_IN delivery first.
      const bridgeId = ethers.utils.id("seed-" + Math.random());
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount,
        recipient: signer.address,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, payload);
      await inboundAdapter.sendMessage(envelope);
      await oToken.connect(signer).approve(master.address, amount);
    };

    it("burns OToken, decreases bridgeAdjustment, emits BridgeRequested", async () => {
      const amount = ethers.utils.parseUnits("100", 6);
      await mintAndApprove(alice, amount);

      const totalSupplyBefore = await oToken.totalSupply();
      await expect(
        master
          .connect(alice)
          .bridgeOTokenToPeer(amount, ethers.constants.AddressZero, "0x", 0)
      ).to.emit(master, "BridgeRequested");

      // OToken was burned.
      expect(await oToken.totalSupply()).to.equal(
        totalSupplyBefore.sub(amount)
      );

      // bridgeAdjustment net zero: +amount from BRIDGE_IN, -amount from BRIDGE_OUT.
      expect(await master.bridgeAdjustment()).to.equal(0);

      // Outbound adapter captured a BRIDGE_OUT message — decode the strategy envelope
      // (msgType, nonce, body) which the strategy packed via CrossChainV3Helper.packPayload.
      const stored = await outboundAdapter.lastMessageSent();
      const [msgType, nonce] = ethers.utils.defaultAbiCoder.decode(
        ["uint32", "uint64", "bytes"],
        stored
      );
      expect(msgType).to.equal(MSG.BRIDGE_OUT);
      expect(nonce).to.equal(0);
    });

    it("reverts when bridge-out exceeds available liquidity", async () => {
      // Mint Alice OToken DIRECTLY via the mock vault (skipping BRIDGE_IN, which would
      // inflate bridgeAdjustment by the minted amount and defeat the test). The mock
      // vault is permissionless on `oToken.mint(addr, amount)` once it's set as the
      // OToken's `vaultAddress`.
      // tooBig is an OToken (18dp) amount that exceeds the seeded liquidity (10000 OToken).
      const tooBig = ethers.utils.parseUnits("999999999", 18);
      const sVault = await impersonateAndFund(mockVault.address);
      await oToken.connect(sVault).mint(alice.address, tooBig);
      await oToken.connect(alice).approve(master.address, tooBig);

      // Available = remoteStrategyBalance + bridgeAdjustment (OToken, 18dp). The seed flow
      // above left remoteStrategyBalance = 10000 OToken and bridgeAdjustment = 0.
      // Bridging `tooBig` exceeds available → preflight reverts.
      await expect(
        master
          .connect(alice)
          .bridgeOTokenToPeer(tooBig, ethers.constants.AddressZero, "0x", 0)
      ).to.be.revertedWith("WOT: insufficient bridge liquidity");
    });

    it("availableBridgeLiquidity subtracts an in-flight withdrawal (P1-b)", async () => {
      const seed = ethers.utils.parseUnits("10000", 6);
      // availableBridgeLiquidity is OToken-denominated (18dp) — it gates an OToken bridge.
      expect(await master.availableBridgeLiquidity()).to.equal(seed.mul(SCALE));

      // Initiate a withdrawal → pendingWithdrawalAmount = W (bridgeAsset, 6dp). Those shares
      // are committed to the queue on Remote and are NOT deliverable for a bridge-out, so the
      // preflight must exclude them (scaled up to OToken units) — otherwise a bridge could
      // burn locally what Remote can't deliver.
      const W = ethers.utils.parseUnits("3000", 6);
      await mockVault.callWithdraw(
        master.address,
        mockVault.address,
        bridgeAsset.address,
        W
      );
      expect(await master.pendingWithdrawalAmount()).to.equal(W);
      expect(await master.availableBridgeLiquidity()).to.equal(
        seed.sub(W).mul(SCALE)
      );
    });

    it("rejects bridge-out when caller has no OToken", async () => {
      // bob never received any OToken, so `bridgeOTokenToPeer` reverts on the
      // burn (transferFrom-style) regardless of liquidity. Separate concern from
      // the liquidity check above.
      const amount = ethers.utils.parseUnits("100", 6);
      await expect(
        master
          .connect(bob)
          .bridgeOTokenToPeer(amount, ethers.constants.AddressZero, "0x", 0)
      ).to.be.reverted;
    });

    it("rejects callGasLimit above MAX_BRIDGE_CALL_GAS", async () => {
      const amount = ethers.utils.parseUnits("1", 6);
      await mintAndApprove(alice, amount);
      await expect(
        master
          .connect(alice)
          .bridgeOTokenToPeer(amount, alice.address, "0xdeadbeef", 600000)
      ).to.be.revertedWith("WOT: callGasLimit too high");
    });

    it("rejects non-empty callData with zero gas", async () => {
      const amount = ethers.utils.parseUnits("1", 6);
      await mintAndApprove(alice, amount);
      await expect(
        master
          .connect(alice)
          .bridgeOTokenToPeer(amount, alice.address, "0xdeadbeef", 0)
      ).to.be.revertedWith("WOT: callData needs gas");
    });
  });

  describe("bridge-in (received from Remote)", () => {
    const AMT = ethers.utils.parseUnits("250", 6);

    it("mints OToken to recipient, increases bridgeAdjustment, marks bridgeId consumed", async () => {
      const bridgeId = ethers.utils.id("bridge-in-1");
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: alice.address,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, payload);

      await expect(inboundAdapter.sendMessage(envelope))
        .to.emit(master, "BridgeDelivered")
        .withArgs(bridgeId, alice.address, AMT);

      expect(await oToken.balanceOf(alice.address)).to.equal(AMT);
      expect(await master.bridgeAdjustment()).to.equal(AMT);
      expect(await master.consumedBridgeIds(bridgeId)).to.equal(true);
    });

    it("rejects a replayed bridgeId", async () => {
      const bridgeId = ethers.utils.id("bridge-in-replay");
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: alice.address,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, payload);
      await inboundAdapter.sendMessage(envelope);
      await expect(inboundAdapter.sendMessage(envelope)).to.be.revertedWith(
        "WOT: bridgeId replayed"
      );
    });

    it("invokes optional callData on success", async () => {
      const TargetFactory = await ethers.getContractFactory(
        "MockBridgeCallTarget"
      );
      const target = await TargetFactory.deploy();

      const iface = new ethers.utils.Interface([
        "function onBridgeDelivered(bytes32 bridgeId, uint256 tokenAmount)",
      ]);
      const bridgeId = ethers.utils.id("bridge-in-call-ok");
      const callData = iface.encodeFunctionData("onBridgeDelivered", [
        bridgeId,
        AMT,
      ]);
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: target.address,
        callData,
        callGasLimit: 200000,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, payload);

      await expect(inboundAdapter.sendMessage(envelope)).to.emit(
        master,
        "BridgeCallSucceeded"
      );

      expect(await target.callCount()).to.equal(1);
      expect(await target.lastBridgeId()).to.equal(bridgeId);
      expect(await oToken.balanceOf(target.address)).to.equal(AMT);
    });

    it("still delivers tokens when the callData reverts", async () => {
      const TargetFactory = await ethers.getContractFactory(
        "MockBridgeCallTarget"
      );
      const target = await TargetFactory.deploy();
      await target.setAlwaysRevert(true);

      const iface = new ethers.utils.Interface([
        "function onBridgeDelivered(bytes32 bridgeId, uint256 tokenAmount)",
      ]);
      const bridgeId = ethers.utils.id("bridge-in-call-revert");
      const callData = iface.encodeFunctionData("onBridgeDelivered", [
        bridgeId,
        AMT,
      ]);
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: target.address,
        callData,
        callGasLimit: 200000,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, payload);

      await expect(inboundAdapter.sendMessage(envelope)).to.emit(
        master,
        "BridgeCallFailed"
      );

      // Tokens were still delivered.
      expect(await oToken.balanceOf(target.address)).to.equal(AMT);
      expect(await master.consumedBridgeIds(bridgeId)).to.equal(true);
    });

    it("rejects callGasLimit above MAX_BRIDGE_CALL_GAS in the payload", async () => {
      const bridgeId = ethers.utils.id("bridge-in-gas-too-high");
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: alice.address,
        callData: "0xdeadbeef",
        callGasLimit: 600000,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, payload);

      await expect(inboundAdapter.sendMessage(envelope)).to.be.revertedWith(
        "WOT: callGasLimit too high"
      );
    });

    it("emits BridgeCallFailed when callback runs out of gas, still delivers tokens", async () => {
      // Exercises the real-world failure mode the bounded-gas guard exists for:
      // callee with an infinite-loop function runs out of gas inside the cap,
      // callback fails, but tokens were delivered first (CEI).
      const TargetFactory = await ethers.getContractFactory(
        "MockBridgeCallTarget"
      );
      const target = await TargetFactory.deploy();

      const iface = new ethers.utils.Interface(["function burnGas()"]);
      const bridgeId = ethers.utils.id("bridge-in-call-oom");
      const callData = iface.encodeFunctionData("burnGas");
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: target.address,
        callData,
        callGasLimit: 50000, // low enough that burnGas can't possibly complete
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, payload);

      await expect(inboundAdapter.sendMessage(envelope)).to.emit(
        master,
        "BridgeCallFailed"
      );

      // Tokens still delivered (CEI verified): target holds AMT OToken.
      expect(await oToken.balanceOf(target.address)).to.equal(AMT);
      expect(await master.consumedBridgeIds(bridgeId)).to.equal(true);
      // Callback never ran to completion (no Pinged event, callCount stays 0).
      expect(await target.callCount()).to.equal(0);
    });
  });

  describe("balance-check + settlement (operator-driven)", () => {
    it("rejects requestBalanceCheck from non-operator non-governor", async () => {
      await expect(
        master.connect(alice).requestBalanceCheck()
      ).to.be.revertedWith("WOT: not authorised");
    });

    it("rejects requestSettlement from non-operator non-governor", async () => {
      await expect(
        master.connect(alice).requestSettlement()
      ).to.be.revertedWith("WOT: not authorised");
    });
  });
});
