const { expect } = require("chai");
const { ethers } = require("hardhat");
const { impersonateAndFund } = require("../../../utils/signers");

/**
 * Coverage for the adapter-level transfer caps + CCTPAdapter-specific behaviour
 * (MAX_TRANSFER_AMOUNT constant, minTransferAmount setter, minFinalityThreshold
 * pre-init guard, fast-finality unfinalised handler).
 *
 * Separated from `fee-path.js` because the caps mechanism is orthogonal to fee
 * plumbing and warrants standalone coverage.
 */
describe("Unit: Adapter transfer caps", function () {
  describe("AbstractAdapter (via CCIPAdapter)", function () {
    let governor, sender, alice;
    let router, weth, adapter;
    const CCIP_DEST = ethers.BigNumber.from("5009297550715157269");

    beforeEach(async () => {
      [governor, sender, , alice] = await ethers.getSigners();

      const RouterFactory = await ethers.getContractFactory("MockCCIPRouter");
      router = await RouterFactory.connect(governor).deploy();

      const WETHFactory = await ethers.getContractFactory("MockWETH");
      weth = await WETHFactory.connect(governor).deploy();

      const AdapterFactory = await ethers.getContractFactory("CCIPAdapter");
      adapter = await AdapterFactory.connect(governor).deploy(router.address);
      await adapter.connect(governor).authorise(sender.address, {
        paused: false,
        chainSelector: CCIP_DEST,
        destGasLimit: 200000,
      });
    });

    it("default maxTransferAmount = 0 disables the cap", async () => {
      expect(await adapter.maxTransferAmount()).to.equal(0);

      // Mint a large amount and approve; the router will accept any size at fee=0.
      await router.setFee(0);
      const big = ethers.utils.parseEther("999999");
      await weth.connect(sender).deposit({ value: 0 });
      // MockWETH supports mintTo; use it for convenience.
      await weth.mintTo(sender.address, big);
      await weth.connect(sender).approve(adapter.address, big);

      await expect(
        adapter
          .connect(sender)
          .sendMessageAndTokens(weth.address, big, "0xdead")
      ).to.not.be.reverted;
    });

    it("enforces maxTransferAmount when set", async () => {
      await router.setFee(0);
      const cap = ethers.utils.parseEther("1000");
      await adapter.connect(governor).setMaxTransferAmount(cap);

      const tooBig = cap.add(1);
      await weth.mintTo(sender.address, tooBig);
      await weth.connect(sender).approve(adapter.address, tooBig);

      await expect(
        adapter.connect(sender).sendMessageAndTokens(weth.address, tooBig, "0x")
      ).to.be.revertedWith("Adapter: amount above max");

      // Exactly at the cap succeeds.
      await weth.connect(sender).approve(adapter.address, cap);
      await expect(
        adapter.connect(sender).sendMessageAndTokens(weth.address, cap, "0x")
      ).to.not.be.reverted;
    });

    it("setMaxTransferAmount is governor-only and emits", async () => {
      await expect(
        adapter.connect(alice).setMaxTransferAmount(1)
      ).to.be.revertedWith("Caller is not the Governor");

      await expect(adapter.connect(governor).setMaxTransferAmount(123))
        .to.emit(adapter, "MaxTransferAmountUpdated")
        .withArgs(0, 123);
      expect(await adapter.maxTransferAmount()).to.equal(123);
    });
  });

  describe("CCTPAdapter — constant cap + min + threshold + fast finality", function () {
    let governor, operator, alice;
    let usdc, transmitter, tokenMessenger, adapter, strategy;
    const SOURCE_DOMAIN = 6;
    const TEN_MILLION = ethers.utils.parseUnits("10000000", 6);

    function addrToBytes32(addr) {
      return ethers.utils.hexZeroPad(addr, 32);
    }

    function buildCCTPMessage({
      version = 1,
      sourceDomain = SOURCE_DOMAIN,
      sender,
      recipient,
      body,
    }) {
      return ethers.utils.solidityPack(
        [
          "uint32",
          "uint32",
          "uint32",
          "bytes32",
          "bytes32",
          "bytes32",
          "bytes32",
          "uint32",
          "uint32",
          "bytes",
        ],
        [
          version,
          sourceDomain,
          0,
          ethers.constants.HashZero,
          addrToBytes32(sender),
          addrToBytes32(recipient),
          ethers.constants.HashZero,
          0,
          0,
          body,
        ]
      );
    }

    function appEnvelope(envSender, intendedAmount, payload) {
      return ethers.utils.solidityPack(
        ["address", "uint256", "bytes"],
        [envSender, intendedAmount, payload]
      );
    }

    beforeEach(async () => {
      [governor, operator, alice] = await ethers.getSigners();

      const USDCFactory = await ethers.getContractFactory("MockUSDC");
      usdc = await USDCFactory.deploy();

      const TransmitterFactory = await ethers.getContractFactory(
        "MockCCTPRelayTransmitter"
      );
      transmitter = await TransmitterFactory.deploy();

      const TokenMessengerFactory = await ethers.getContractFactory(
        "CCTPTokenMessengerMock"
      );
      tokenMessenger = await TokenMessengerFactory.deploy(
        usdc.address,
        transmitter.address
      );

      const AdapterFactory = await ethers.getContractFactory("CCTPAdapter");
      adapter = await AdapterFactory.connect(governor).deploy(
        usdc.address,
        tokenMessenger.address,
        transmitter.address
      );

      await adapter.connect(governor).setOperator(operator.address);

      const StrategyFactory = await ethers.getContractFactory(
        "MockBridgeReceiver"
      );
      strategy = await StrategyFactory.connect(governor).deploy();
      await adapter.connect(governor).authorise(strategy.address, {
        paused: false,
        chainSelector: SOURCE_DOMAIN,
        destGasLimit: 500000,
      });
    });

    it("exposes MAX_TRANSFER_AMOUNT = 10M USDC as a constant", async () => {
      expect(await adapter.MAX_TRANSFER_AMOUNT()).to.equal(TEN_MILLION);
    });

    it("_sendMessage reverts when minFinalityThreshold is not set", async () => {
      await adapter.connect(governor).authorise(alice.address, {
        paused: false,
        chainSelector: SOURCE_DOMAIN,
        destGasLimit: 500000,
      });
      await expect(
        adapter.connect(alice).sendMessage("0xdeadbeef")
      ).to.be.revertedWith("CCTP: threshold not set");
    });

    it("_sendMessageAndTokens reverts when below min, above CCTP cap, and when threshold unset", async () => {
      const sender = await impersonateAndFund(strategy.address);

      // Threshold unset → revert
      await usdc.mintTo(strategy.address, TEN_MILLION);
      await usdc.connect(sender).approve(adapter.address, TEN_MILLION);
      await expect(
        adapter.connect(sender).sendMessageAndTokens(usdc.address, 1000, "0x")
      ).to.be.revertedWith("CCTP: threshold not set");

      // Set threshold + min, now bounds apply
      await adapter.connect(governor).setMinFinalityThreshold(2000);
      await adapter.connect(governor).setMinTransferAmount(1000);

      // Below min
      await expect(
        adapter.connect(sender).sendMessageAndTokens(usdc.address, 999, "0x")
      ).to.be.revertedWith("CCTP: amount below min");

      // Above CCTP cap (10M + 1 wei)
      const tooBig = TEN_MILLION.add(1);
      await usdc.mintTo(strategy.address, tooBig);
      await usdc.connect(sender).approve(adapter.address, tooBig);
      await expect(
        adapter.connect(sender).sendMessageAndTokens(usdc.address, tooBig, "0x")
      ).to.be.revertedWith("CCTP: amount above CCTP cap");

      // We don't assert the in-bounds happy path here — the TokenMessenger mock used by
      // these tests (MockCCTPRelayTransmitter) is wired for inbound-relay testing and
      // doesn't accept the outbound burn callback. Coverage for successful burns lives
      // in the broader cctp-relay test using the v2 mock transmitter family.
    });

    it("setMinFinalityThreshold rejects out-of-range values + governor-only", async () => {
      await expect(
        adapter.connect(governor).setMinFinalityThreshold(999)
      ).to.be.revertedWith("CCTP: bad threshold");
      await expect(
        adapter.connect(governor).setMinFinalityThreshold(2001)
      ).to.be.revertedWith("CCTP: bad threshold");
      await expect(
        adapter.connect(alice).setMinFinalityThreshold(2000)
      ).to.be.revertedWith("Caller is not the Governor");
    });

    it("handleReceiveUnfinalizedMessage requires finalityThresholdExecuted >= minFinalityThreshold", async () => {
      // Set fast finality at 1500.
      await adapter.connect(governor).setMinFinalityThreshold(1500);

      // We can't easily drive handleReceiveUnfinalizedMessage from MockCCTPRelayTransmitter
      // because the mock always calls handleReceiveFinalizedMessage. Call it directly
      // by impersonating the transmitter.
      const sTransmitter = await impersonateAndFund(transmitter.address);

      const body = appEnvelope(strategy.address, 0, "0x");
      // Build only the message body (not the full CCTP wire frame) — the handler takes
      // it as the `messageBody` parameter.

      // Below threshold → revert
      await expect(
        adapter
          .connect(sTransmitter)
          .handleReceiveUnfinalizedMessage(
            SOURCE_DOMAIN,
            addrToBytes32(adapter.address),
            1499,
            body
          )
      ).to.be.revertedWith("CCTP: insufficient finality");

      // At threshold → accepted
      await adapter
        .connect(sTransmitter)
        .handleReceiveUnfinalizedMessage(
          SOURCE_DOMAIN,
          addrToBytes32(adapter.address),
          1500,
          body
        );
      expect(await strategy.callCount()).to.equal(1);

      // Above threshold but below 2000 (still unfinalised path) → accepted
      await adapter
        .connect(sTransmitter)
        .handleReceiveUnfinalizedMessage(
          SOURCE_DOMAIN,
          addrToBytes32(adapter.address),
          1999,
          body
        );
      expect(await strategy.callCount()).to.equal(2);
    });

    it("handleReceiveUnfinalizedMessage reverts when threshold not set", async () => {
      const sTransmitter = await impersonateAndFund(transmitter.address);
      const body = appEnvelope(strategy.address, 0, "0x");
      await expect(
        adapter
          .connect(sTransmitter)
          .handleReceiveUnfinalizedMessage(
            SOURCE_DOMAIN,
            addrToBytes32(adapter.address),
            1500,
            body
          )
      ).to.be.revertedWith("CCTP: threshold not set");
    });

    it("handleReceiveFinalizedMessage still works at finalityThresholdExecuted=2000", async () => {
      // Even without setMinFinalityThreshold being called, finalized handler accepts
      // (it doesn't check minFinalityThreshold).
      const message = buildCCTPMessage({
        sender: adapter.address,
        recipient: adapter.address,
        body: appEnvelope(strategy.address, 0, "0x"),
      });
      await adapter.connect(governor).setMinFinalityThreshold(2000); // for relay path
      await adapter.connect(operator).relay(message, "0x");
      expect(await strategy.callCount()).to.equal(1);
    });
  });

  describe("Master.depositAll / withdrawAll clamping by adapter caps", function () {
    let deployer, governor;
    let bridgeAsset, oTokenL2, mockL2Vault, master;
    let outbound, inbound;

    const ONE_K = ethers.utils.parseUnits("1000", 6);

    beforeEach(async () => {
      [deployer, governor] = await ethers.getSigners();

      const ERC20Factory = await ethers.getContractFactory("MockUSDC");
      bridgeAsset = await ERC20Factory.deploy();

      const VaultFactory = await ethers.getContractFactory("MockOTokenVault");
      mockL2Vault = await VaultFactory.deploy();

      const OTokenFactory = await ethers.getContractFactory(
        "MockMintableBurnableOToken"
      );
      oTokenL2 = await OTokenFactory.deploy(
        "Mock OToken",
        "mOT",
        mockL2Vault.address
      );
      await mockL2Vault.setOToken(oTokenL2.address);

      const MasterFactory = await ethers.getContractFactory(
        "MasterWOTokenStrategy"
      );
      const impl = await MasterFactory.connect(deployer).deploy(
        {
          platformAddress: ethers.constants.AddressZero,
          vaultAddress: mockL2Vault.address,
        },
        bridgeAsset.address,
        oTokenL2.address
      );
      const ProxyFactory = await ethers.getContractFactory(
        "InitializeGovernedUpgradeabilityProxy"
      );
      const proxy = await ProxyFactory.connect(deployer).deploy();
      await proxy
        .connect(deployer)
        .initialize(
          impl.address,
          governor.address,
          impl.interface.encodeFunctionData("initialize", [governor.address])
        );
      master = await ethers.getContractAt(
        "MasterWOTokenStrategy",
        proxy.address
      );
      await mockL2Vault.whitelistStrategy(master.address);

      const AdapterFactory = await ethers.getContractFactory(
        "MockBridgeAdapter"
      );
      outbound = await AdapterFactory.deploy();
      inbound = await AdapterFactory.deploy();
      await outbound.setSender(master.address);
      await inbound.setPeer(master.address);
      await master.connect(governor).setOutboundAdapter(outbound.address);
      await master.connect(governor).setInboundAdapter(inbound.address);
    });

    it("depositAll clamps localBalance by outboundAdapter.maxTransferAmount", async () => {
      // Fund Master with 3000 USDC (vault-style).
      await bridgeAsset.mintTo(master.address, ONE_K.mul(3));
      // Cap the outbound at 1000.
      await outbound.setMaxTransferAmountOverride(ONE_K);

      await mockL2Vault.callDepositAll(master.address);

      // Adapter saw exactly 1000.
      expect(await outbound.lastAmountSent()).to.equal(ONE_K);
      // Remainder still on Master for the next depositAll cycle.
      expect(await bridgeAsset.balanceOf(master.address)).to.equal(
        ONE_K.mul(2)
      );
    });

    it("depositAll sends the full balance when cap is 0 (unlimited)", async () => {
      await bridgeAsset.mintTo(master.address, ONE_K.mul(3));
      await outbound.setMaxTransferAmountOverride(0);
      await mockL2Vault.callDepositAll(master.address);
      expect(await outbound.lastAmountSent()).to.equal(ONE_K.mul(3));
    });

    it("withdrawAll clamps remoteStrategyBalance by inboundAdapter.maxTransferAmount", async () => {
      // Seed Master with a remoteStrategyBalance of 5000 via a fake deposit+ack cycle.
      // Simplest: directly call deposit + flush the ack envelope via the mock adapter.
      await bridgeAsset.mintTo(master.address, ONE_K.mul(5));
      await mockL2Vault.callDeposit(
        master.address,
        bridgeAsset.address,
        ONE_K.mul(5)
      );
      // Send DEPOSIT_ACK back so pendingAmount clears and remoteStrategyBalance = 5000.
      const ackBody = ethers.utils.defaultAbiCoder.encode(
        ["uint256"],
        [ONE_K.mul(5)]
      );
      const ackEnvelope = ethers.utils.defaultAbiCoder.encode(
        ["uint32", "uint64", "bytes"],
        [2, 1, ackBody] // DEPOSIT_ACK msgType=2, nonce=1
      );
      await inbound.sendMessage(ackEnvelope);
      expect(await master.remoteStrategyBalance()).to.equal(ONE_K.mul(5));

      // Cap the inbound at 2000. withdrawAll clamps.
      await inbound.setMaxTransferAmountOverride(ONE_K.mul(2));
      await mockL2Vault.callWithdrawAll(master.address);

      // Master sent WITHDRAW_REQUEST with amount = 2000 via outbound.
      const sentEnvelope = await outbound.lastMessageSent();
      const [msgType, , body] = ethers.utils.defaultAbiCoder.decode(
        ["uint32", "uint64", "bytes"],
        sentEnvelope
      );
      expect(msgType).to.equal(3); // WITHDRAW_REQUEST
      const [amount] = ethers.utils.defaultAbiCoder.decode(["uint256"], body);
      expect(amount).to.equal(ONE_K.mul(2));
      expect(await master.pendingWithdrawalAmount()).to.equal(ONE_K.mul(2));
    });
  });
});
