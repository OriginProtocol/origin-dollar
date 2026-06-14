const { expect } = require("chai");
const { ethers } = require("hardhat");

// bridgeAsset (MockUSDC) is 6dp; oToken / wOToken are 18dp. The strategy keeps the OToken
// domain (remoteStrategyBalance, wOToken shares, bridgeAdjustment) in 18dp and scales to
// bridgeAsset units only at the vault edge (checkBalance). SCALE is the 6→18 factor.
const SCALE = ethers.BigNumber.from(10).pow(12);

/**
 * Paired Master+Remote loopback integration test.
 *
 * Two MockBridgeAdapters wire the strategies in-process:
 *   - adapterME ("Master → Remote") : sender = master, peer = remote
 *   - adapterRM ("Remote → Master") : sender = remote, peer = master
 *
 * remote.outboundAdapter = adapterRM ; remote.inboundAdapter = adapterME
 * master.outboundAdapter = adapterME ; master.inboundAdapter = adapterRM
 *
 * That way, when Master sends, adapterME forwards to Remote, and Remote's onlyInboundAdapter
 * gate accepts the call. When Remote replies, adapterRM forwards to Master, and Master's gate
 * accepts.
 */

describe("Unit: V3 Master+Remote loopback", function () {
  let deployer, governor, alice;
  let bridgeAsset, oTokenL2, mockL2Vault;
  let oTokenEth, woTokenEth, ethVault;
  let master, remote;
  let adapterME, adapterRM;

  beforeEach(async () => {
    [deployer, governor, alice] = await ethers.getSigners();

    // --- bridgeAsset (shared, both sides) ---
    const ERC20Factory = await ethers.getContractFactory("MockUSDC");
    bridgeAsset = await ERC20Factory.deploy();

    // --- L2 side: Master + L2 vault + L2 OToken ---
    const L2VaultFactory = await ethers.getContractFactory("MockOTokenVault");
    mockL2Vault = await L2VaultFactory.deploy();
    const OTokenFactory = await ethers.getContractFactory(
      "MockMintableBurnableOToken"
    );
    oTokenL2 = await OTokenFactory.deploy(
      "Mock OToken L2",
      "mOTL2",
      mockL2Vault.address
    );
    await mockL2Vault.setOToken(oTokenL2.address);

    const MasterFactory = await ethers.getContractFactory(
      "MasterWOTokenStrategy"
    );
    const masterImpl = await MasterFactory.connect(deployer).deploy(
      {
        platformAddress: ethers.constants.AddressZero,
        vaultAddress: mockL2Vault.address,
      },
      bridgeAsset.address,
      oTokenL2.address
    );

    // --- Ethereum side: Remote + ETH vault + ETH OToken + wOToken ---
    const EthVaultFactory = await ethers.getContractFactory(
      "MockEthOTokenVault"
    );
    const ethNonce = await ethers.provider.getTransactionCount(
      deployer.address
    );
    const futureEthVault = ethers.utils.getContractAddress({
      from: deployer.address,
      nonce: ethNonce + 1,
    });
    oTokenEth = await OTokenFactory.deploy(
      "Mock OToken Eth",
      "mOTEth",
      futureEthVault
    );
    ethVault = await EthVaultFactory.deploy(
      bridgeAsset.address,
      oTokenEth.address
    );

    const WoFactory = await ethers.getContractFactory("MockERC4626Vault");
    woTokenEth = await WoFactory.deploy(oTokenEth.address);

    const RemoteFactory = await ethers.getContractFactory(
      "RemoteWOTokenStrategy"
    );
    const remoteImpl = await RemoteFactory.connect(deployer).deploy(
      {
        platformAddress: woTokenEth.address,
        vaultAddress: ethers.constants.AddressZero,
      },
      bridgeAsset.address,
      oTokenEth.address,
      woTokenEth.address,
      ethVault.address
    );

    // --- Proxies ---
    const ProxyFactory = await ethers.getContractFactory(
      "InitializeGovernedUpgradeabilityProxy"
    );
    const masterProxy = await ProxyFactory.connect(deployer).deploy();
    const masterInitData = masterImpl.interface.encodeFunctionData(
      "initialize",
      [governor.address]
    );
    await masterProxy
      .connect(deployer)
      .initialize(masterImpl.address, governor.address, masterInitData);
    master = await ethers.getContractAt(
      "MasterWOTokenStrategy",
      masterProxy.address
    );

    const remoteProxy = await ProxyFactory.connect(deployer).deploy();
    const remoteInitData = remoteImpl.interface.encodeFunctionData(
      "initialize",
      [governor.address]
    );
    await remoteProxy
      .connect(deployer)
      .initialize(remoteImpl.address, governor.address, remoteInitData);
    remote = await ethers.getContractAt(
      "RemoteWOTokenStrategy",
      remoteProxy.address
    );

    await mockL2Vault.whitelistStrategy(master.address);

    // --- Adapters wiring ---
    const AdapterFactory = await ethers.getContractFactory("MockBridgeAdapter");
    adapterME = await AdapterFactory.deploy();
    adapterRM = await AdapterFactory.deploy();

    await adapterME.setSender(master.address);
    await adapterME.setPeer(remote.address);
    await adapterRM.setSender(remote.address);
    await adapterRM.setPeer(master.address);

    await master.connect(governor).setOutboundAdapter(adapterME.address);
    await master.connect(governor).setInboundAdapter(adapterRM.address);
    await remote.connect(governor).setOutboundAdapter(adapterRM.address);
    await remote.connect(governor).setInboundAdapter(adapterME.address);
    await remote.connect(governor).safeApproveAllTokens();
  });

  it("deposit flows Master → Remote and the ack updates Master in one round-trip", async () => {
    const AMOUNT = ethers.utils.parseUnits("1000", 6);

    // Vault funds Master with bridgeAsset and calls deposit.
    await bridgeAsset.mintTo(master.address, AMOUNT);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, AMOUNT);

    // After the deposit:
    //   - Master's tokens flowed: master → adapterME → remote
    //   - Remote minted OToken via ethVault, wrapped to wOToken
    //   - Remote sent DEPOSIT_ACK back via adapterRM
    //   - adapterRM called master.receiveMessage with the ack
    //   - Master cleared pendingDepositAmount and set remoteStrategyBalance = newBalance

    expect(await master.pendingDepositAmount()).to.equal(0);
    // remoteStrategyBalance is the OToken-denominated (18dp) yield baseline.
    expect(await master.remoteStrategyBalance()).to.equal(AMOUNT.mul(SCALE));
    expect(await master.isYieldOpInFlight()).to.equal(false);

    // checkBalance is bridgeAsset-denominated (6dp) — scaled back down at the vault edge.
    expect(await master.checkBalance(bridgeAsset.address)).to.equal(AMOUNT);

    // Remote holds the wOToken shares for the minted OToken (18dp, 1:1 with OToken here).
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(
      AMOUNT.mul(SCALE)
    );

    // Nonces synced on both sides.
    expect(await master.lastYieldNonce()).to.equal(1);
    expect(await remote.lastYieldNonce()).to.equal(1);
    expect(await master.nonceProcessed(1)).to.equal(true);
    expect(await remote.nonceProcessed(1)).to.equal(true);
  });

  it("Remote-initiated BRIDGE_IN mints OToken on Master to the configured recipient", async () => {
    const AMOUNT = ethers.utils.parseUnits("250", 6);

    // Alice on Ethereum buys OToken first via the eth vault and approves Remote.
    await bridgeAsset.mintTo(alice.address, AMOUNT);
    await bridgeAsset.connect(alice).approve(ethVault.address, AMOUNT);
    await ethVault.connect(alice).mint(AMOUNT);
    await oTokenEth.connect(alice).approve(remote.address, AMOUNT);

    // Alice bridges from Ethereum to L2 with a custom recipient (governor).
    await remote
      .connect(alice)
      .bridgeOTokenToPeer(AMOUNT, governor.address, "0x", 0);

    // Master should have minted AMOUNT of OTokenL2 to governor.
    expect(await oTokenL2.balanceOf(governor.address)).to.equal(AMOUNT);

    // Both sides recorded the bridge adjustment.
    expect(await remote.bridgeAdjustment()).to.equal(AMOUNT);
    expect(await master.bridgeAdjustment()).to.equal(AMOUNT);
  });

  it("Master-initiated BRIDGE_OUT releases OToken on Remote to the configured recipient", async () => {
    const SEED = ethers.utils.parseUnits("1000", 6);
    const AMOUNT = ethers.utils.parseUnits("200", 6);

    // Seed Remote with shares via a deposit round-trip.
    await bridgeAsset.mintTo(master.address, SEED);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, SEED);

    // Give Alice OTokenL2 (via a synthetic BRIDGE_IN initiated by some other user
    // would normally do it; here we just fund her directly through the same path).
    await bridgeAsset.mintTo(deployer.address, AMOUNT);
    await bridgeAsset.approve(ethVault.address, AMOUNT);
    await ethVault.mint(AMOUNT);
    await oTokenEth.approve(remote.address, AMOUNT);
    await remote.bridgeOTokenToPeer(AMOUNT, alice.address, "0x", 0);
    expect(await oTokenL2.balanceOf(alice.address)).to.equal(AMOUNT);

    // Now Alice bridges those L2 OTokens back to Ethereum to a chosen recipient.
    await oTokenL2.connect(alice).approve(master.address, AMOUNT);
    await master
      .connect(alice)
      .bridgeOTokenToPeer(AMOUNT, governor.address, "0x", 0);

    // The Ethereum side delivered AMOUNT OTokenEth to governor.
    expect(await oTokenEth.balanceOf(governor.address)).to.equal(AMOUNT);

    // Net bridge adjustment is zero on each side (one bridge-in then one bridge-out).
    expect(await master.bridgeAdjustment()).to.equal(0);
    expect(await remote.bridgeAdjustment()).to.equal(0);
  });

  it("yield ack reports the yield-only baseline — no double-count with bridge activity (P0)", async () => {
    // Deposits are bridgeAsset (USDC 6dp); the bridge channel moves OToken (18dp). The
    // bridged amount is 200 OToken (= 200 USDC of value); BRIDGE_IN_USDC is what Alice
    // spends to obtain it.
    const DEPOSIT1 = ethers.utils.parseUnits("1000", 6);
    const DEPOSIT2 = ethers.utils.parseUnits("500", 6);
    const BRIDGE_IN_USDC = ethers.utils.parseUnits("200", 6);
    const BRIDGE_IN = ethers.utils.parseUnits("200", 18);

    // 1. Deposit 1000 USDC → rsb = 1000 (18dp), bridgeAdjustment = 0.
    await bridgeAsset.mintTo(master.address, DEPOSIT1);
    await mockL2Vault.callDeposit(
      master.address,
      bridgeAsset.address,
      DEPOSIT1
    );
    expect(await master.remoteStrategyBalance()).to.equal(DEPOSIT1.mul(SCALE));
    expect(await master.bridgeAdjustment()).to.equal(0);

    // 2. A user BRIDGE_INs 200 OToken from Remote → Master. bridgeAdjustment = 200 OToken
    //    (18dp) on both sides; Remote wraps the user's OToken on top of its yield shares.
    await bridgeAsset.mintTo(alice.address, BRIDGE_IN_USDC);
    await bridgeAsset.connect(alice).approve(ethVault.address, BRIDGE_IN_USDC);
    await ethVault.connect(alice).mint(BRIDGE_IN_USDC);
    await oTokenEth.connect(alice).approve(remote.address, BRIDGE_IN);
    await remote
      .connect(alice)
      .bridgeOTokenToPeer(BRIDGE_IN, alice.address, "0x", 0);
    expect(await master.bridgeAdjustment()).to.equal(BRIDGE_IN);

    // 3. Second deposit of 500 USDC. Its DEPOSIT_ACK must report the YIELD-ONLY baseline
    //    (_viewCheckBalance - bridgeAdjustment), NOT the full balance — Master re-adds its
    //    own bridgeAdjustment in checkBalance, so a full-balance ack would double-count the
    //    200 OToken bridge.
    await bridgeAsset.mintTo(master.address, DEPOSIT2);
    await mockL2Vault.callDeposit(
      master.address,
      bridgeAsset.address,
      DEPOSIT2
    );

    // rsb = yield-only baseline = just the two deposits (18dp), bridge excluded.
    expect(await master.remoteStrategyBalance()).to.equal(
      DEPOSIT1.add(DEPOSIT2).mul(SCALE)
    );
    // checkBalance (6dp) = deposits(1500) + bridge(200) = 1700 — the bridge counted ONCE.
    expect(await master.checkBalance(bridgeAsset.address)).to.equal(
      DEPOSIT1.add(DEPOSIT2).add(BRIDGE_IN_USDC)
    );
    expect(await master.pendingDepositAmount()).to.equal(0);
  });
});
