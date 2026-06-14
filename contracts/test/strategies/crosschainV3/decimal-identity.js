const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * 18/18 identity sanity check for the OETHb deployment config (bridgeAsset and OToken share
 * 18 decimals, like WETH/OETH). With matched decimals every scaleBy in the strategy is the
 * identity, so deposit / checkBalance / bridge magnitudes must show NO scale factor — i.e.
 * the deployed OETHb behaviour is unchanged by the decimal-scaling work added for OUSD V3.
 *
 * Uses MockDAI (18dp) as the bridgeAsset. The 6/18 (USDC/OUSD) scaling is covered by the
 * rest of the crosschainV3 suite, which now runs against the scaling MockEthOTokenVault.
 */
describe("Unit: V3 decimal identity (18/18, OETHb config)", function () {
  let deployer, governor, alice;
  let bridgeAsset, oTokenL2, mockL2Vault;
  let oTokenEth, woTokenEth, ethVault;
  let master, remote;

  const AMOUNT = ethers.utils.parseUnits("1000", 18);

  beforeEach(async () => {
    [deployer, governor, alice] = await ethers.getSigners();

    // bridgeAsset is 18dp (DAI-like, standing in for WETH on the OETHb lane).
    const DAIFactory = await ethers.getContractFactory("MockDAI");
    bridgeAsset = await DAIFactory.deploy();

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

    const ProxyFactory = await ethers.getContractFactory(
      "InitializeGovernedUpgradeabilityProxy"
    );
    const masterProxy = await ProxyFactory.connect(deployer).deploy();
    await masterProxy
      .connect(deployer)
      .initialize(
        masterImpl.address,
        governor.address,
        masterImpl.interface.encodeFunctionData("initialize", [
          governor.address,
        ])
      );
    master = await ethers.getContractAt(
      "MasterWOTokenStrategy",
      masterProxy.address
    );

    const remoteProxy = await ProxyFactory.connect(deployer).deploy();
    await remoteProxy
      .connect(deployer)
      .initialize(
        remoteImpl.address,
        governor.address,
        remoteImpl.interface.encodeFunctionData("initialize", [
          governor.address,
        ])
      );
    remote = await ethers.getContractAt(
      "RemoteWOTokenStrategy",
      remoteProxy.address
    );

    await mockL2Vault.whitelistStrategy(master.address);

    const AdapterFactory = await ethers.getContractFactory("MockBridgeAdapter");
    const adapterME = await AdapterFactory.deploy();
    const adapterRM = await AdapterFactory.deploy();
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

  it("stores matched 18/18 decimals on both legs", async () => {
    expect(await master.bridgeAssetDecimals()).to.equal(18);
    expect(await master.oTokenDecimals()).to.equal(18);
    expect(await remote.bridgeAssetDecimals()).to.equal(18);
    expect(await remote.oTokenDecimals()).to.equal(18);
  });

  it("deposit round-trip has no scale factor (rsb / checkBalance / shares all == AMOUNT)", async () => {
    await bridgeAsset.mintTo(master.address, AMOUNT);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, AMOUNT);

    // No 1e12 factor anywhere: every value equals AMOUNT.
    expect(await master.remoteStrategyBalance()).to.equal(AMOUNT);
    expect(await master.checkBalance(bridgeAsset.address)).to.equal(AMOUNT);
    expect(await remote.checkBalance(bridgeAsset.address)).to.equal(AMOUNT);
    expect(await woTokenEth.balanceOf(remote.address)).to.equal(AMOUNT);
    expect(await master.availableBridgeLiquidity()).to.equal(AMOUNT);
  });

  it("bridge-in adds to checkBalance 1:1 at matched decimals", async () => {
    const BRIDGE = ethers.utils.parseUnits("250", 18);
    await bridgeAsset.mintTo(alice.address, BRIDGE);
    await bridgeAsset.connect(alice).approve(ethVault.address, BRIDGE);
    await ethVault.connect(alice).mint(BRIDGE);
    await oTokenEth.connect(alice).approve(remote.address, BRIDGE);
    await remote
      .connect(alice)
      .bridgeOTokenToPeer(BRIDGE, alice.address, "0x", 0);

    // bridgeAdjustment and the resulting checkBalance contribution are 1:1 (no scaling).
    expect(await master.bridgeAdjustment()).to.equal(BRIDGE);
    expect(await master.checkBalance(bridgeAsset.address)).to.equal(BRIDGE);
  });
});
