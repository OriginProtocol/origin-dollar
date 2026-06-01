const { expect } = require("chai");
const { ethers } = require("hardhat");

const ORIGIN_V3_MESSAGE_VERSION = 2010;

const MSG = {
  YIELD_DEPOSIT: 1,
  YIELD_DEPOSIT_ACK: 2,
  WITHDRAW_REQUEST: 3,
  WITHDRAW_REQUEST_ACK: 4,
  WITHDRAW_CLAIM: 5,
  WITHDRAW_CLAIM_ACK: 6,
  BALANCE_CHECK_REQUEST: 7,
  BALANCE_CHECK_RESPONSE: 8,
  SETTLE_BRIDGE: 9,
  SETTLE_BRIDGE_ACK: 10,
  BRIDGE_IN: 11,
  BRIDGE_OUT: 12,
};

const encodePackedEnvelope = (msgType, nonce, payloadHex) =>
  ethers.utils.solidityPack(
    ["uint32", "uint32", "uint64", "bytes"],
    [ORIGIN_V3_MESSAGE_VERSION, msgType, nonce, payloadHex]
  );

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

describe("Unit: RemoteV3Strategy", function () {
  let deployer, governor, alice;
  let bridgeAsset, oToken, woToken, ethVault, remote;
  let outboundAdapter, receiverAdapter;

  beforeEach(async () => {
    [deployer, governor, alice] = await ethers.getSigners();

    // bridgeAsset (USDC stand-in)
    const ERC20Factory = await ethers.getContractFactory("MockUSDC");
    bridgeAsset = await ERC20Factory.deploy();

    // OToken + Ethereum vault
    const VaultFactory = await ethers.getContractFactory("MockEthOTokenVault");
    const OTokenFactory = await ethers.getContractFactory(
      "MockMintableBurnableOToken"
    );

    // Two-step bootstrap: vault refers to oToken, oToken refers to vault.
    // We deploy oToken with a placeholder vault, then redeploy vault with the real
    // oToken, but since oToken's vault is immutable we must compute the vault
    // address first. Easier: deploy oToken with deployer as a temporary vault.
    // Simplest fix: deploy vault first with a placeholder oToken, then patch oToken
    // separately. But oToken vault is immutable too. Use CREATE2-style two-pass:
    //   1) compute vault address; 2) deploy oToken bound to that address; 3) deploy vault.
    // For mocks we cheat with a self-deployment helper: deploy vault first with a known
    // oToken slot we'll write to, but that's hacky.
    // Cleanest workable approach: rebuild the mock pair so that oToken's vault is also a
    // constructor arg passed at deploy time, and the vault stores oToken via setter.
    // (Our MockEthOTokenVault has oToken as immutable via constructor arg — see below.)
    // Two-pass deployment with pre-computed address:
    const nonce = await ethers.provider.getTransactionCount(deployer.address);
    const futureVaultAddress = ethers.utils.getContractAddress({
      from: deployer.address,
      nonce: nonce + 1, // oToken is deployed first (nonce), vault next (nonce+1)
    });
    oToken = await OTokenFactory.deploy(
      "Mock OToken",
      "mOT",
      futureVaultAddress
    );
    ethVault = await VaultFactory.deploy(bridgeAsset.address, oToken.address);
    expect(ethVault.address).to.equal(futureVaultAddress);

    // wOToken (ERC-4626 over OToken)
    const WoFactory = await ethers.getContractFactory("MockERC4626Vault");
    woToken = await WoFactory.deploy(oToken.address);

    // RemoteV3Strategy behind proxy
    const ImplFactory = await ethers.getContractFactory("RemoteV3Strategy");
    const impl = await ImplFactory.connect(deployer).deploy(
      {
        platformAddress: woToken.address,
        vaultAddress: ethers.constants.AddressZero,
      },
      bridgeAsset.address,
      oToken.address,
      woToken.address,
      ethVault.address
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

    remote = await ethers.getContractAt("RemoteV3Strategy", proxy.address);

    // Adapters
    const AdapterFactory = await ethers.getContractFactory("MockBridgeAdapter");
    outboundAdapter = await AdapterFactory.deploy();
    receiverAdapter = await AdapterFactory.deploy();
    await outboundAdapter.setSender(remote.address);
    await receiverAdapter.setPeer(remote.address);

    await remote.connect(governor).setOutboundAdapter(outboundAdapter.address);
    await remote.connect(governor).setReceiverAdapter(receiverAdapter.address);
  });

  describe("initialisation", () => {
    it("stores immutables and rejects unsupported assets", async () => {
      expect(await remote.bridgeAsset()).to.equal(bridgeAsset.address);
      expect(await remote.oToken()).to.equal(oToken.address);
      expect(await remote.woToken()).to.equal(woToken.address);
      expect(await remote.oTokenVault()).to.equal(ethVault.address);
      expect(await remote.supportsAsset(bridgeAsset.address)).to.equal(true);
      expect(await remote.supportsAsset(oToken.address)).to.equal(false);
    });

    it("vault-driven entry points revert (Remote is bridge-driven only)", async () => {
      await expect(
        remote.connect(governor).deposit(bridgeAsset.address, 1)
      ).to.be.revertedWith("Remote: use bridge");
      await expect(remote.connect(governor).depositAll()).to.be.revertedWith(
        "Remote: use bridge"
      );
      await expect(
        remote
          .connect(governor)
          .withdraw(governor.address, bridgeAsset.address, 1)
      ).to.be.revertedWith("Remote: use bridge");
      await expect(remote.connect(governor).withdrawAll()).to.be.revertedWith(
        "Remote: use bridge"
      );
    });
  });

  describe("checkBalance sums all state-table slots", () => {
    const FIVE = ethers.utils.parseUnits("5", 6);

    it("returns 0 when idle", async () => {
      expect(await remote.checkBalance(bridgeAsset.address)).to.equal(0);
    });

    it("includes wOToken shares (via previewRedeem)", async () => {
      await bridgeAsset.mintTo(deployer.address, FIVE);
      await bridgeAsset.approve(ethVault.address, FIVE);
      await ethVault.mint(FIVE);
      await oToken.approve(woToken.address, FIVE);
      await woToken.deposit(FIVE, remote.address);
      expect(await remote.checkBalance(bridgeAsset.address)).to.equal(FIVE);
    });

    it("includes loose OToken balance", async () => {
      await bridgeAsset.mintTo(deployer.address, FIVE);
      await bridgeAsset.approve(ethVault.address, FIVE);
      await ethVault.mint(FIVE);
      await oToken.transfer(remote.address, FIVE);
      expect(await remote.checkBalance(bridgeAsset.address)).to.equal(FIVE);
    });

    it("includes loose bridgeAsset balance", async () => {
      await bridgeAsset.mintTo(remote.address, FIVE);
      expect(await remote.checkBalance(bridgeAsset.address)).to.equal(FIVE);
    });
  });

  describe("YIELD_DEPOSIT inbound handling", () => {
    const ONE_K = ethers.utils.parseUnits("1000", 6);

    it("mints OToken, wraps to wOToken, sends YIELD_DEPOSIT_ACK with new balance", async () => {
      // Drive an atomic tokens-with-message delivery through the receiver adapter.
      // The test EOA plays the role of the bridge transport: pre-funded with
      // bridgeAsset and approves the adapter to pull it as if it had arrived from
      // the source chain.
      await bridgeAsset.mintTo(deployer.address, ONE_K);
      await bridgeAsset.approve(receiverAdapter.address, ONE_K);

      const envelope = encodePackedEnvelope(MSG.YIELD_DEPOSIT, 7, "0x");
      await receiverAdapter.sendTokensAndMessage(
        bridgeAsset.address,
        ONE_K,
        envelope
      );

      // wOToken shares minted match the deposit (1:1 in mock).
      expect(await woToken.balanceOf(remote.address)).to.equal(ONE_K);
      expect(await oToken.balanceOf(remote.address)).to.equal(0);
      expect(await bridgeAsset.balanceOf(remote.address)).to.equal(0);

      // Master would have received the ack with the new balance.
      const sent = await outboundAdapter.lastMessageSent();
      const decoded = sent.toLowerCase();
      expect(decoded.slice(0, 10)).to.equal("0x000007da");
      expect(parseInt(decoded.slice(10, 18), 16)).to.equal(
        MSG.YIELD_DEPOSIT_ACK
      );
      expect(parseInt(decoded.slice(18, 34), 16)).to.equal(7); // nonce

      expect(await remote.nonceProcessed(7)).to.equal(true);
      expect(await remote.lastYieldNonce()).to.equal(7);
    });

    it("rejects a non-monotonic yield nonce on a second inbound deposit", async () => {
      await bridgeAsset.mintTo(deployer.address, ONE_K.mul(2));
      await bridgeAsset.approve(receiverAdapter.address, ONE_K.mul(2));

      await receiverAdapter.sendTokensAndMessage(
        bridgeAsset.address,
        ONE_K,
        encodePackedEnvelope(MSG.YIELD_DEPOSIT, 5, "0x")
      );

      // Reusing nonce 5 or going backward must be rejected.
      await expect(
        receiverAdapter.sendTokensAndMessage(
          bridgeAsset.address,
          ONE_K,
          encodePackedEnvelope(MSG.YIELD_DEPOSIT, 5, "0x")
        )
      ).to.be.revertedWith("V3: nonce not monotonic");

      await expect(
        receiverAdapter.sendTokensAndMessage(
          bridgeAsset.address,
          ONE_K,
          encodePackedEnvelope(MSG.YIELD_DEPOSIT, 4, "0x")
        )
      ).to.be.revertedWith("V3: nonce not monotonic");
    });
  });

  describe("bridge channel: bridge-in (user-facing, R→M)", () => {
    const AMT = ethers.utils.parseUnits("250", 6);

    const mintOTokenToAlice = async (amount) => {
      await bridgeAsset.mintTo(alice.address, amount);
      await bridgeAsset.connect(alice).approve(ethVault.address, amount);
      await ethVault.connect(alice).mint(amount);
    };

    it("wraps OToken, emits BridgeInRequested, sends BRIDGE_IN message", async () => {
      await mintOTokenToAlice(AMT);
      await oToken.connect(alice).approve(remote.address, AMT);

      await expect(
        remote
          .connect(alice)
          .bridgeOTokenToPeer(AMT, ethers.constants.AddressZero, "0x", 0)
      ).to.emit(remote, "BridgeInRequested");

      expect(await woToken.balanceOf(remote.address)).to.equal(AMT);
      expect(await remote.bridgeAdjustment()).to.equal(AMT);

      const sent = await outboundAdapter.lastMessageSent();
      const decoded = sent.toLowerCase();
      expect(parseInt(decoded.slice(10, 18), 16)).to.equal(MSG.BRIDGE_IN);
      expect(parseInt(decoded.slice(18, 34), 16)).to.equal(0); // nonceless
    });

    it("rejects callGasLimit above MAX_BRIDGE_CALL_GAS", async () => {
      await mintOTokenToAlice(AMT);
      await oToken.connect(alice).approve(remote.address, AMT);
      await expect(
        remote
          .connect(alice)
          .bridgeOTokenToPeer(AMT, alice.address, "0xdeadbeef", 600_000)
      ).to.be.revertedWith("Remote: callGasLimit too high");
    });
  });

  describe("bridge channel: BRIDGE_OUT inbound (M→R)", () => {
    const AMT = ethers.utils.parseUnits("100", 6);

    const seedRemoteShares = async (amount) => {
      await bridgeAsset.mintTo(deployer.address, amount);
      await bridgeAsset.approve(ethVault.address, amount);
      await ethVault.mint(amount);
      await oToken.approve(woToken.address, amount);
      await woToken.deposit(amount, remote.address);
    };

    it("unwraps wOToken, transfers OToken to recipient, decrements bridgeAdjustment", async () => {
      await seedRemoteShares(AMT.mul(2));

      const bridgeId = ethers.utils.id("bridge-out-1");
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: alice.address,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_OUT, 0, payload);

      await expect(receiverAdapter.sendMessage(envelope))
        .to.emit(remote, "BridgeOutDelivered")
        .withArgs(bridgeId, alice.address, AMT);

      expect(await oToken.balanceOf(alice.address)).to.equal(AMT);
      expect(await remote.bridgeAdjustment()).to.equal(
        ethers.BigNumber.from(0).sub(AMT)
      );
      expect(await woToken.balanceOf(remote.address)).to.equal(AMT);
      expect(await remote.consumedBridgeIds(bridgeId)).to.equal(true);
    });

    it("rejects a replayed bridgeId", async () => {
      await seedRemoteShares(AMT.mul(2));
      const bridgeId = ethers.utils.id("bridge-out-replay");
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: alice.address,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_OUT, 0, payload);
      await receiverAdapter.sendMessage(envelope);
      await expect(receiverAdapter.sendMessage(envelope)).to.be.revertedWith(
        "Remote: bridgeId replayed"
      );
    });

    it("reverts with insufficient remote wOToken", async () => {
      // No shares.
      const bridgeId = ethers.utils.id("bridge-out-low");
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: alice.address,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_OUT, 0, payload);
      await expect(receiverAdapter.sendMessage(envelope)).to.be.revertedWith(
        "Remote: insufficient remote wOToken"
      );
    });

    it("invokes optional callData on the recipient", async () => {
      await seedRemoteShares(AMT.mul(2));
      const TargetFactory = await ethers.getContractFactory(
        "MockBridgeCallTarget"
      );
      const target = await TargetFactory.deploy();

      const bridgeId = ethers.utils.id("bridge-out-call");
      const iface = new ethers.utils.Interface([
        "function onBridgeDelivered(bytes32,uint256)",
      ]);
      const callData = iface.encodeFunctionData("onBridgeDelivered", [
        bridgeId,
        AMT,
      ]);
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: target.address,
        callData,
        callGasLimit: 200_000,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_OUT, 0, payload);

      await expect(receiverAdapter.sendMessage(envelope)).to.emit(
        remote,
        "BridgeOutDeliveredWithCall"
      );
      expect(await target.callCount()).to.equal(1);
    });

    it("still delivers tokens when callData reverts", async () => {
      await seedRemoteShares(AMT.mul(2));
      const TargetFactory = await ethers.getContractFactory(
        "MockBridgeCallTarget"
      );
      const target = await TargetFactory.deploy();
      await target.setAlwaysRevert(true);

      const bridgeId = ethers.utils.id("bridge-out-revert");
      const iface = new ethers.utils.Interface([
        "function onBridgeDelivered(bytes32,uint256)",
      ]);
      const callData = iface.encodeFunctionData("onBridgeDelivered", [
        bridgeId,
        AMT,
      ]);
      const payload = encodeBridgeUserPayload({
        bridgeId,
        amount: AMT,
        recipient: target.address,
        callData,
        callGasLimit: 200_000,
      });
      const envelope = encodePackedEnvelope(MSG.BRIDGE_OUT, 0, payload);
      await expect(receiverAdapter.sendMessage(envelope)).to.emit(
        remote,
        "BridgeOutCallFailed"
      );
      expect(await oToken.balanceOf(target.address)).to.equal(AMT);
    });
  });
});
