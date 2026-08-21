const { expect } = require("chai");
const { ethers } = require("hardhat");

const { MSG, encodePackedEnvelope } = require("./_helpers");

// The pair accounts in a single 18-decimal domain, so no scaling is needed.
const SCALE = ethers.BigNumber.from(1);

describe("Unit: RemoteWOTokenStrategy", function () {
  let deployer, governor, alice;
  let bridgeAsset, oToken, woToken, ethVault, remote;
  let outboundAdapter, inboundAdapter;

  beforeEach(async () => {
    [deployer, governor, alice] = await ethers.getSigners();

    // bridgeAsset (USDC stand-in)
    const ERC20Factory = await ethers.getContractFactory("MockDAI");
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

    // RemoteWOTokenStrategy behind proxy
    const ImplFactory = await ethers.getContractFactory(
      "RemoteWOTokenStrategy"
    );
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

    remote = await ethers.getContractAt("RemoteWOTokenStrategy", proxy.address);

    // Adapters
    const AdapterFactory = await ethers.getContractFactory("MockBridgeAdapter");
    outboundAdapter = await AdapterFactory.deploy();
    inboundAdapter = await AdapterFactory.deploy();
    await outboundAdapter.setSender(remote.address);
    await inboundAdapter.setPeer(remote.address);

    await remote.connect(governor).setOutboundAdapter(outboundAdapter.address);
    await remote.connect(governor).setInboundAdapter(inboundAdapter.address);
    // safeApproveAllTokens primes the static (token, spender) pairs Remote transfers
    // through (replaces the per-call _ensureApproval).
    await remote.connect(governor).safeApproveAllTokens();
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
    const FIVE = ethers.utils.parseUnits("5", 18);
    const FIVE_OT = ethers.utils.parseUnits("5", 18); // 5 OToken (18dp) == 5 USDC of value

    it("returns 0 when idle", async () => {
      expect(await remote.checkBalance(bridgeAsset.address)).to.equal(0);
    });

    it("includes wOToken shares (via previewRedeem)", async () => {
      // mint(FIVE) USDC produces FIVE_OT OToken (scaled); wrap all of it.
      await bridgeAsset.mintTo(deployer.address, FIVE);
      await bridgeAsset.approve(ethVault.address, FIVE);
      await ethVault.mint(FIVE);
      await oToken.approve(woToken.address, FIVE_OT);
      await woToken.deposit(FIVE_OT, remote.address);
      expect(await remote.checkBalance(bridgeAsset.address)).to.equal(FIVE);
    });

    it("includes loose OToken balance", async () => {
      await bridgeAsset.mintTo(deployer.address, FIVE);
      await bridgeAsset.approve(ethVault.address, FIVE);
      await ethVault.mint(FIVE);
      await oToken.transfer(remote.address, FIVE_OT);
      expect(await remote.checkBalance(bridgeAsset.address)).to.equal(FIVE);
    });

    it("includes loose bridgeAsset balance", async () => {
      await bridgeAsset.mintTo(remote.address, FIVE);
      expect(await remote.checkBalance(bridgeAsset.address)).to.equal(FIVE);
    });
  });

  describe("DEPOSIT inbound handling", () => {
    const ONE_K = ethers.utils.parseUnits("1000", 18);

    it("mints OToken, wraps to wOToken, sends DEPOSIT_ACK with new balance", async () => {
      // Drive an atomic tokens-with-message delivery through the receiver adapter.
      // The test EOA plays the role of the bridge transport: pre-funded with
      // bridgeAsset and approves the adapter to pull it as if it had arrived from
      // the source chain.
      await bridgeAsset.mintTo(deployer.address, ONE_K);
      await bridgeAsset.approve(inboundAdapter.address, ONE_K);

      const envelope = encodePackedEnvelope(MSG.DEPOSIT, 7, "0x");
      await inboundAdapter.sendMessageAndTokens(
        bridgeAsset.address,
        ONE_K,
        envelope
      );

      // ONE_K USDC mints ONE_K*SCALE OToken (18dp), all wrapped to wOToken (1:1 in mock).
      expect(await woToken.balanceOf(remote.address)).to.equal(
        ONE_K.mul(SCALE)
      );
      expect(await oToken.balanceOf(remote.address)).to.equal(0);
      expect(await bridgeAsset.balanceOf(remote.address)).to.equal(0);

      // Master would have received the ack with the new balance.
      const sent = await outboundAdapter.lastMessageSent();
      const [msgType, ackNonce] = ethers.utils.defaultAbiCoder.decode(
        ["uint32", "uint64", "bytes"],
        sent
      );
      expect(msgType).to.equal(MSG.DEPOSIT_ACK);
      expect(ackNonce).to.equal(7);

      expect(await remote.nonceProcessed(7)).to.equal(true);
      expect(await remote.lastYieldNonce()).to.equal(7);
    });

    it("rejects a non-monotonic yield nonce on a second inbound deposit", async () => {
      await bridgeAsset.mintTo(deployer.address, ONE_K.mul(2));
      await bridgeAsset.approve(inboundAdapter.address, ONE_K.mul(2));

      await inboundAdapter.sendMessageAndTokens(
        bridgeAsset.address,
        ONE_K,
        encodePackedEnvelope(MSG.DEPOSIT, 5, "0x")
      );

      // Reusing nonce 5 or going backward must be rejected.
      await expect(
        inboundAdapter.sendMessageAndTokens(
          bridgeAsset.address,
          ONE_K,
          encodePackedEnvelope(MSG.DEPOSIT, 5, "0x")
        )
      ).to.be.revertedWith("V3: nonce not monotonic");

      await expect(
        inboundAdapter.sendMessageAndTokens(
          bridgeAsset.address,
          ONE_K,
          encodePackedEnvelope(MSG.DEPOSIT, 4, "0x")
        )
      ).to.be.revertedWith("V3: nonce not monotonic");
    });
  });

  describe("transferToken custody protection (round-4 #17)", () => {
    it("rejects sweeping woToken / oToken / bridgeAsset", async () => {
      await expect(
        remote.connect(governor).transferToken(woToken.address, 1)
      ).to.be.revertedWith("Cannot transfer custody asset");
      await expect(
        remote.connect(governor).transferToken(oToken.address, 1)
      ).to.be.revertedWith("Cannot transfer custody asset");
      await expect(
        remote.connect(governor).transferToken(bridgeAsset.address, 1)
      ).to.be.revertedWith("Cannot transfer custody asset");
    });

    it("still rescues an unrelated token to governor, governor-only", async () => {
      const ERC20Factory = await ethers.getContractFactory("MockDAI");
      const stray = await ERC20Factory.deploy();
      const amt = ethers.utils.parseUnits("10", 18);
      await stray.mintTo(remote.address, amt);

      await expect(
        remote.connect(alice).transferToken(stray.address, amt)
      ).to.be.revertedWith("Caller is not the Governor");

      await remote.connect(governor).transferToken(stray.address, amt);
      expect(await stray.balanceOf(governor.address)).to.equal(amt);
      expect(await stray.balanceOf(remote.address)).to.equal(0);
    });
  });
});
