const { expect } = require("chai");
const { ethers } = require("hardhat");

const {
  MSG,
  encodePackedEnvelope,
  encodeNewBalancePayload,
} = require("./_helpers");

describe("Unit: MasterWOTokenStrategy", function () {
  let deployer, governor, alice;
  let bridgeAsset, oToken, mockVault, master;
  let outboundAdapter, inboundAdapter;

  beforeEach(async () => {
    [deployer, governor, , alice] = await ethers.getSigners();

    // --- Tokens & mock vault ---
    const ERC20Factory = await ethers.getContractFactory("MockDAI");
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

    // --- Master strategy: deploy impl behind the standard proxy ---
    const ImplFactory = await ethers.getContractFactory(
      "MasterWOTokenStrategy"
    );
    const impl = await ImplFactory.connect(deployer).deploy(
      {
        platformAddress: ethers.constants.AddressZero,
        vaultAddress: mockVault.address,
      },
      bridgeAsset.address
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
    const ONE_K = ethers.utils.parseUnits("1000", 18);

    it("vault.deposit assigns a yield nonce, sets pendingDepositAmount, sends DEPOSIT", async () => {
      await bridgeAsset.mintTo(master.address, ONE_K);

      await mockVault.callDeposit(master.address, bridgeAsset.address, ONE_K);

      expect(await master.pendingDepositAmount()).to.equal(ONE_K);
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
      ).to.be.revertedWith("Master: deposit or withdrawal pending");
    });

    it("non-vault callers cannot deposit", async () => {
      await bridgeAsset.mintTo(master.address, ONE_K);
      await expect(
        master.connect(alice).deposit(bridgeAsset.address, ONE_K)
      ).to.be.revertedWith("Caller is not the Vault");
    });

    it("DEPOSIT_ACK clears pendingDepositAmount and updates remoteStrategyBalance", async () => {
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

      expect(await master.pendingDepositAmount()).to.equal(0);
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

  describe("balance check (operator-driven)", () => {
    it("rejects requestBalanceCheck from non-operator non-governor", async () => {
      await expect(
        master.connect(alice).requestBalanceCheck()
      ).to.be.revertedWith("WOT: not authorised");
    });
  });
});
