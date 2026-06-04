const { expect } = require("chai");
const { ethers } = require("hardhat");

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
    //   - adapterRM called master.receiveFromBridge with the ack
    //   - Master cleared pendingAmount and set remoteStrategyBalance = newBalance

    expect(await master.pendingAmount()).to.equal(0);
    expect(await master.remoteStrategyBalance()).to.equal(AMOUNT);
    expect(await master.isYieldOpInFlight()).to.equal(false);

    // checkBalance on Master == AMOUNT (Remote balance is reflected here).
    expect(await master.checkBalance(bridgeAsset.address)).to.equal(AMOUNT);

    // Remote actually holds the wOToken shares.
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(AMOUNT);

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
});
