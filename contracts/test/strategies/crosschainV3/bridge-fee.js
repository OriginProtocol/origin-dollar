const { expect } = require("chai");
const { ethers } = require("hardhat");

const { MSG } = require("./_helpers");

/**
 * Covers bridgeFeeBps on the bridge channel:
 *   - default 0
 *   - capped at MAX_BRIDGE_FEE_BPS (10%)
 *   - governor-only setter
 *   - burn-full / deliver-net semantics: source burns _amount, the envelope payload carries
 *     `net = _amount - fee`, bridgeAdjustment captures `net`.
 */
describe("Unit: AbstractWOTokenStrategy bridge fee (burn-full / deliver-net)", function () {
  let deployer, governor, alice;
  let bridgeAsset, oToken, mockVault, master;
  let outboundAdapter, inboundAdapter;

  const ONE_K = ethers.utils.parseUnits("1000", 6);

  beforeEach(async () => {
    [deployer, governor, , alice] = await ethers.getSigners();

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

    const AdapterFactory = await ethers.getContractFactory("MockBridgeAdapter");
    outboundAdapter = await AdapterFactory.deploy();
    inboundAdapter = await AdapterFactory.deploy();
    await outboundAdapter.setSender(master.address);
    await inboundAdapter.setPeer(master.address);
    await master.connect(governor).setOutboundAdapter(outboundAdapter.address);
    await master.connect(governor).setInboundAdapter(inboundAdapter.address);

    // Seed Remote balance so bridge-out has liquidity.
    await bridgeAsset.mintTo(master.address, ONE_K);
    await mockVault.callDeposit(master.address, bridgeAsset.address, ONE_K);
    const ackBody = ethers.utils.defaultAbiCoder.encode(["uint256"], [ONE_K]);
    const ackEnvelope = ethers.utils.defaultAbiCoder.encode(
      ["uint32", "uint64", "bytes"],
      [2, 1, ackBody] // DEPOSIT_ACK, nonce 1
    );
    await inboundAdapter.sendMessage(ackEnvelope);
  });

  const mintAndApprove = async (signer, amount) => {
    const bridgeId = ethers.utils.id("seed-" + Math.random());
    const body = ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "uint256", "address", "bytes", "uint32"],
      [bridgeId, amount, signer.address, "0x", 0]
    );
    const envelope = ethers.utils.defaultAbiCoder.encode(
      ["uint32", "uint64", "bytes"],
      [11, 0, body] // BRIDGE_IN, nonceless
    );
    await inboundAdapter.sendMessage(envelope);
    await oToken.connect(signer).approve(master.address, amount);
  };

  it("defaults to 0 (no fee)", async () => {
    expect(await master.bridgeFeeBps()).to.equal(0);
  });

  it("caps fee at MAX_BRIDGE_FEE_BPS (10%)", async () => {
    expect(await master.MAX_BRIDGE_FEE_BPS()).to.equal(1000);
    await expect(
      master.connect(governor).setBridgeFeeBps(1001)
    ).to.be.revertedWith("WOT: fee too high");
  });

  it("only governor can set bridgeFeeBps", async () => {
    await expect(master.connect(alice).setBridgeFeeBps(100)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });

  it("burn-full / deliver-net: bridges burn the full amount but the peer envelope carries `net`", async () => {
    await master.connect(governor).setBridgeFeeBps(100); // 1%

    const amount = ethers.utils.parseUnits("100", 6);
    const fee = amount.div(100);
    const net = amount.sub(fee);

    await mintAndApprove(alice, amount);

    const adjBefore = await master.bridgeAdjustment();
    const totalSupplyBefore = await oToken.totalSupply();

    await expect(
      master
        .connect(alice)
        .bridgeOTokenToPeer(amount, ethers.constants.AddressZero, "0x", 0)
    ).to.emit(master, "BridgeRequested");

    // Master burned the FULL amount.
    expect(await oToken.totalSupply()).to.equal(totalSupplyBefore.sub(amount));

    // bridgeAdjustment captured only `net` (peer's obligation).
    expect(await master.bridgeAdjustment()).to.equal(adjBefore.sub(net));

    // Envelope payload carries `net`, not `amount`.
    const stored = await outboundAdapter.lastMessageSent();
    const [msgType, , body] = ethers.utils.defaultAbiCoder.decode(
      ["uint32", "uint64", "bytes"],
      stored
    );
    expect(msgType).to.equal(MSG.BRIDGE_OUT);
    const [, decodedAmount] = ethers.utils.defaultAbiCoder.decode(
      ["bytes32", "uint256", "address", "bytes", "uint32"],
      body
    );
    expect(decodedAmount).to.equal(net);
  });

  it("net=0 after fee is rejected", async () => {
    // With max 10% fee, net only goes to zero if amount is 0 (already caught by zero-bridge guard)
    // — so test the boundary: max-fee 1000bps and amount of 1 produces net=1, never zero.
    // Direct test: try amount=0 (caught earlier).
    await expect(
      master
        .connect(alice)
        .bridgeOTokenToPeer(0, ethers.constants.AddressZero, "0x", 0)
    ).to.be.revertedWith("WOT: zero bridge");
  });
});
