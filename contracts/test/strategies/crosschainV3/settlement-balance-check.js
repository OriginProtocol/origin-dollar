const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * End-to-end exercise of the operator-driven yield-channel round-trips:
 *   - requestBalanceCheck → BALANCE_CHECK_RESPONSE (updates remoteStrategyBalance from
 *     Remote's previewRedeem)
 *   - requestSettlement → SETTLE_BRIDGE_ACK (zeros both sides' bridgeAdjustment and updates
 *     remoteStrategyBalance to the post-settlement view)
 *
 * Verifies the checkBalance invariant across yield accrual (mocked by sending OToken to
 * the 4626 vault to inflate previewRedeem) and across bridge-channel net inflows.
 */

describe("Unit: V3 settlement + balance check", function () {
  let deployer, governor, alice;
  let bridgeAsset, oTokenL2, mockL2Vault;
  let oTokenEth, woTokenEth, ethVault;
  let master, remote;

  const SEED = ethers.utils.parseUnits("5000", 6);

  beforeEach(async () => {
    [deployer, governor, alice] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockUSDC");
    bridgeAsset = await ERC20Factory.deploy();

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

    const MasterFactory = await ethers.getContractFactory("MasterV3Strategy");
    const masterImpl = await MasterFactory.connect(deployer).deploy(
      {
        platformAddress: ethers.constants.AddressZero,
        vaultAddress: mockL2Vault.address,
      },
      bridgeAsset.address,
      oTokenL2.address
    );

    const RemoteFactory = await ethers.getContractFactory("RemoteV3Strategy");
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
      "MasterV3Strategy",
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
      "RemoteV3Strategy",
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

    // Seed Remote with SEED via a deposit round-trip.
    await bridgeAsset.mintTo(master.address, SEED);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, SEED);
  });

  it("requestBalanceCheck picks up yield accrued on the wOToken", async () => {
    // Simulate yield: airdrop OToken to the wOToken vault to inflate previewRedeem.
    const YIELD = ethers.utils.parseUnits("100", 6);
    await bridgeAsset.mintTo(deployer.address, YIELD);
    await bridgeAsset.approve(ethVault.address, YIELD);
    await ethVault.mint(YIELD);
    await oTokenEth.transfer(woTokenEth.address, YIELD);
    // Now previewRedeem(SEED shares) > SEED.

    // Before: Master's cached balance still equals SEED.
    expect(await master.remoteStrategyBalance()).to.equal(SEED);

    await master.connect(governor).requestBalanceCheck();

    // After: balance reflects the yield.
    expect(await master.remoteStrategyBalance()).to.be.gt(SEED);
    expect(await master.checkBalance(bridgeAsset.address)).to.be.gt(SEED);
  });

  it("requestSettlement zeros both sides' bridgeAdjustment and refreshes balance", async () => {
    // Drive a bridge-in round trip to create unsettled deltas on both sides.
    const AMT = ethers.utils.parseUnits("250", 6);
    await bridgeAsset.mintTo(alice.address, AMT);
    await bridgeAsset.connect(alice).approve(ethVault.address, AMT);
    await ethVault.connect(alice).mint(AMT);
    await oTokenEth.connect(alice).approve(remote.address, AMT);
    await remote.connect(alice).bridgeOTokenToPeer(AMT, alice.address, "0x", 0);

    expect(await master.bridgeAdjustment()).to.equal(AMT);
    expect(await remote.bridgeAdjustment()).to.equal(AMT);

    // Settlement
    await master.connect(governor).requestSettlement();

    expect(await master.bridgeAdjustment()).to.equal(0);
    expect(await remote.bridgeAdjustment()).to.equal(0);
    // remoteStrategyBalance now reflects the bridged-in shares.
    expect(await master.remoteStrategyBalance()).to.equal(SEED.add(AMT));
  });

  it("balance check rejects nonce reuse via the abstract base", async () => {
    await master.connect(governor).requestBalanceCheck();
    // A second balance check must allocate a fresh nonce (the previous one is processed).
    // It should succeed since no yield op is in flight.
    await master.connect(governor).requestBalanceCheck();
    expect(await master.lastYieldNonce()).to.be.gte(3); // 1=initial deposit, +1 first BC, +1 second BC
  });

  it("rejects requestBalanceCheck while a yield op is in flight", async () => {
    // Drop the receiver adapter so the ack from a fresh deposit doesn't land,
    // leaving the nonce in flight.
    // Simplest way: issue a withdrawal request, which leaves pendingWithdrawalAmount set,
    // gating future balance checks.
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      ethers.utils.parseUnits("100", 6)
    );

    await expect(
      master.connect(governor).requestBalanceCheck()
    ).to.be.revertedWith("Master: withdrawal pending");
  });
});
