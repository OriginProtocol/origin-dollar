const { createFixtureLoader } = require("../../_fixture");
const { defaultBaseFixture } = require("../../_fixture-base");
const { expect } = require("chai");
const { isCI } = require("../../helpers");
const { impersonateAndFund } = require("../../../utils/signers");
const addresses = require("../../../utils/addresses");

const {
  MSG,
  encodeBridgeUserPayload,
  encodePackedEnvelope,
} = require("./_helpers");

const baseFixture = createFixtureLoader(defaultBaseFixture);

/**
 * Master fork test: drives MasterWOTokenStrategy against the real Base OETHb vault.
 *
 * Master is already deployed and wired by deploy/base/101 (master proxy + adapters).
 * We impersonate the configured receiver adapter to push synthetic BRIDGE_IN messages
 * into Master, exercising the real `mintForStrategy` / `burnForStrategy` plumbing on
 * the OETHb vault.
 */
describe("ForkTest: MasterWOTokenStrategy on Base (real OETHb vault wiring)", function () {
  this.timeout(0);
  this.retries(isCI ? 3 : 0);

  let fixture;
  let master;
  let oethb;
  let inboundAdapter;
  let woethMigration;

  beforeEach(async () => {
    fixture = await baseFixture();

    woethMigration = await ethers.getContractAt(
      "BridgedWOETHMigrationStrategy",
      fixture.woethStrategy.address
    );
    const masterAddr = await woethMigration.master();
    master = await ethers.getContractAt("MasterWOTokenStrategy", masterAddr);
    oethb = fixture.oethb;

    inboundAdapter = await ethers.getContractAt(
      "SuperbridgeAdapter",
      await master.inboundAdapter()
    );
  });

  it("is wired to the deployed adapters and vault", async () => {
    expect(await master.vaultAddress()).to.equal(fixture.oethbVault.address);
    expect(await master.bridgeAsset()).to.equal(addresses.base.WETH);
    expect(await master.oToken()).to.equal(oethb.address);
    expect(await master.operator()).to.equal(addresses.talosRelayer);
    expect((await master.outboundAdapter()).toLowerCase()).to.match(
      /^0x[0-9a-f]+$/
    );
    expect((await master.inboundAdapter()).toLowerCase()).to.equal(
      inboundAdapter.address.toLowerCase()
    );
  });

  it("receiving BRIDGE_IN mints OETHb via the real vault and credits the recipient", async () => {
    const recipient = fixture.governor.address;
    const amount = ethers.utils.parseEther("100");

    const balanceBefore = await oethb.balanceOf(recipient);
    const totalSupplyBefore = await oethb.totalSupply();

    // Impersonate the receiver adapter (only address allowed to call receiveMessage).
    const sAdapter = await impersonateAndFund(inboundAdapter.address);

    const bridgeId = ethers.utils.id("master-fork-1");
    const body = encodeBridgeUserPayload({
      bridgeId,
      amount,
      recipient,
    });
    const envelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, body);

    await master
      .connect(sAdapter)
      .receiveMessage(
        master.address,
        ethers.constants.AddressZero,
        0,
        0,
        envelope
      );

    expect(await oethb.balanceOf(recipient)).to.equal(
      balanceBefore.add(amount)
    );
    expect(await oethb.totalSupply()).to.equal(totalSupplyBefore.add(amount));
    expect(await master.consumedBridgeIds(bridgeId)).to.equal(true);
    expect(await master.bridgeAdjustment()).to.equal(amount);
  });

  it("user bridgeOTokenToPeer burns OETHb via the real vault and emits BridgeRequested", async () => {
    // Swap the production CCIP outbound for a mock so the test doesn't hit the real CCIP router
    // (the peer adapter on Ethereum hasn't been wired in this single-chain fork).
    const MockAdapterF = await ethers.getContractFactory("MockBridgeAdapter");
    const mockOut = await MockAdapterF.deploy();
    await mockOut.deployed();
    await mockOut.setSender(master.address);

    const sTimelock = await impersonateAndFund(addresses.base.timelock);
    await master.connect(sTimelock).setOutboundAdapter(mockOut.address);

    // First seed Master's remoteStrategyBalance + alice's OETHb via a BRIDGE_IN.
    const sAdapter = await impersonateAndFund(inboundAdapter.address);
    const seedAmount = ethers.utils.parseEther("500");
    const aliceAddr = fixture.governor.address;

    const seedBody = encodeBridgeUserPayload({
      bridgeId: ethers.utils.id("master-fork-seed"),
      amount: seedAmount,
      recipient: aliceAddr,
    });
    const seedEnvelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, seedBody);
    await master
      .connect(sAdapter)
      .receiveMessage(
        master.address,
        ethers.constants.AddressZero,
        0,
        0,
        seedEnvelope
      );

    // Now alice bridges 100 back to Ethereum. Liquidity check: bridgeAdjustment alone covers it.
    const bridgeAmount = ethers.utils.parseEther("100");
    await oethb.connect(fixture.governor).approve(master.address, bridgeAmount);

    const supplyBefore = await oethb.totalSupply();
    const adjBefore = await master.bridgeAdjustment();

    await expect(
      master
        .connect(fixture.governor)
        .bridgeOTokenToPeer(bridgeAmount, aliceAddr, "0x", 0)
    ).to.emit(master, "BridgeRequested");

    expect(await oethb.totalSupply()).to.equal(supplyBefore.sub(bridgeAmount));
    expect(await master.bridgeAdjustment()).to.equal(
      adjBefore.sub(bridgeAmount)
    );
  });

  it("rejects BRIDGE_IN replay using the same bridgeId", async () => {
    const sAdapter = await impersonateAndFund(inboundAdapter.address);
    const bridgeId = ethers.utils.id("master-fork-replay");
    const body = encodeBridgeUserPayload({
      bridgeId,
      amount: ethers.utils.parseEther("1"),
      recipient: fixture.governor.address,
    });
    const envelope = encodePackedEnvelope(MSG.BRIDGE_IN, 0, body);
    await master
      .connect(sAdapter)
      .receiveMessage(
        master.address,
        ethers.constants.AddressZero,
        0,
        0,
        envelope
      );
    await expect(
      master
        .connect(sAdapter)
        .receiveMessage(
          master.address,
          ethers.constants.AddressZero,
          0,
          0,
          envelope
        )
    ).to.be.revertedWith("WOT: bridgeId replayed");
  });
});
