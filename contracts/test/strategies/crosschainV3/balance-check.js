const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * End-to-end exercise of the operator-driven balance-check round-trip:
 * `requestBalanceCheck` → BALANCE_CHECK_RESPONSE, which refreshes
 * `remoteStrategyBalance` from Remote's `previewRedeem`.
 *
 * Verifies the checkBalance invariant across yield accrual (mocked by sending OToken to
 * the 4626 vault to inflate previewRedeem).
 */

describe("Unit: V3 balance check", function () {
  let deployer, governor, alice;
  let bridgeAsset, mockL2Vault;
  let oTokenEth, woTokenEth, ethVault;
  let master, remote;

  const SEED = ethers.utils.parseUnits("5000", 18);
  // The pair accounts in a single 18-decimal domain, so no scaling is needed.
  const SCALE = ethers.BigNumber.from(1);

  beforeEach(async () => {
    [deployer, governor, alice] = await ethers.getSigners();

    const ERC20Factory = await ethers.getContractFactory("MockDAI");
    bridgeAsset = await ERC20Factory.deploy();

    const L2VaultFactory = await ethers.getContractFactory("MockOTokenVault");
    mockL2Vault = await L2VaultFactory.deploy();
    const OTokenFactory = await ethers.getContractFactory(
      "MockMintableBurnableOToken"
    );

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
      bridgeAsset.address
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

    // Seed Remote with SEED via a deposit round-trip.
    await bridgeAsset.mintTo(master.address, SEED);
    await mockL2Vault.callDeposit(master.address, bridgeAsset.address, SEED);
  });

  it("requestBalanceCheck picks up yield accrued on the wOToken", async () => {
    // Simulate yield: airdrop OToken to the wOToken vault to inflate previewRedeem. Mint
    // YIELD USDC → YIELD*SCALE OToken (18dp), then donate all of it to the vault so the
    // increase is meaningful at the bridgeAsset scale.
    const YIELD = ethers.utils.parseUnits("100", 18);
    await bridgeAsset.mintTo(deployer.address, YIELD);
    await bridgeAsset.approve(ethVault.address, YIELD);
    await ethVault.mint(YIELD);
    await oTokenEth.transfer(woTokenEth.address, YIELD.mul(SCALE));
    // Now previewRedeem(SEED shares) > SEED.

    // Before: Master's cached balance still equals the seeded baseline (18dp).
    expect(await master.remoteStrategyBalance()).to.equal(SEED.mul(SCALE));

    await master.connect(governor).requestBalanceCheck();

    // After: balance reflects the yield.
    expect(await master.remoteStrategyBalance()).to.be.gt(SEED.mul(SCALE));
    expect(await master.checkBalance(bridgeAsset.address)).to.be.gt(SEED);
  });

  it("balance check does NOT advance the yield nonce", async () => {
    // Locked design: balance check is non-blocking and nonce-echo. It uses
    // `lastYieldNonce` as an epoch marker without incrementing it.
    const nonceBefore = await master.lastYieldNonce();
    await master.connect(governor).requestBalanceCheck();
    await master.connect(governor).requestBalanceCheck();
    expect(await master.lastYieldNonce()).to.equal(nonceBefore);
  });

  it("requestBalanceCheck is non-blocking even when a withdrawal is pending", async () => {
    // Old design rejected with "Master: withdrawal pending"; new design is non-blocking.
    // The response is filtered at acceptance time (three guards in
    // _processBalanceCheckResponse) — pending op skips, nonce mismatch skips,
    // stale timestamp skips.
    await mockL2Vault.callWithdraw(
      master.address,
      mockL2Vault.address,
      bridgeAsset.address,
      ethers.utils.parseUnits("100", 18)
    );

    await expect(master.connect(governor).requestBalanceCheck()).to.not.be
      .reverted;
  });

  it("governor can sweep native ETH from the strategy via transferNative", async () => {
    // Send some ETH to Master (simulating operator top-up of the fee pool).
    const POOL = ethers.utils.parseEther("0.5");
    await deployer.sendTransaction({ to: master.address, value: POOL });
    expect(await ethers.provider.getBalance(master.address)).to.equal(POOL);

    const govBefore = await ethers.provider.getBalance(governor.address);
    const tx = await master.connect(governor).transferNative(POOL);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);
    const govAfter = await ethers.provider.getBalance(governor.address);

    // Governor received POOL - gas spent on the call.
    expect(govAfter.sub(govBefore)).to.equal(POOL.sub(gasCost));
    expect(await ethers.provider.getBalance(master.address)).to.equal(0);
  });

  it("non-governor cannot call transferNative", async () => {
    await deployer.sendTransaction({
      to: master.address,
      value: ethers.utils.parseEther("0.1"),
    });
    await expect(master.connect(alice).transferNative(1)).to.be.revertedWith(
      "Caller is not the Governor"
    );
  });
});
