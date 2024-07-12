const { expect } = require("chai");
const hre = require("hardhat");

const { createFixtureLoader, oethDefaultFixture } = require("../_fixture");
const { parseUnits } = require("ethers/lib/utils");
const { deployWithConfirmation } = require("../../utils/deploy");
const { oethUnits, advanceTime } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const addresses = require("../../utils/addresses");

const oethFixture = createFixtureLoader(oethDefaultFixture);

describe("OETH Vault", function () {
  let fixture;
  beforeEach(async () => {
    fixture = await oethFixture();
  });

  const snapData = async (fixture) => {
    const { oeth, oethVault, weth, user } = fixture;

    const oethTotal = await oeth.totalSupply();
    const userOeth = await oeth.balanceOf(user.address);
    const userWeth = await weth.balanceOf(user.address);
    const vaultWeth = await weth.balanceOf(oethVault.address);
    const queue = await oethVault.withdrawalQueueMetadata();

    return {
      oethTotal,
      userOeth,
      userWeth,
      vaultWeth,
      queue,
    };
  };

  const assertChangedData = async (dataBefore, delta, fixture) => {
    const { oeth, oethVault, weth, user } = fixture;

    expect(await oeth.totalSupply()).to.equal(
      dataBefore.oethTotal.add(delta.oethTotal),
      "OETH Total Supply"
    );
    expect(await oeth.balanceOf(user.address)).to.equal(
      dataBefore.userOeth.add(delta.userOeth),
      "user's OETH balance"
    );
    expect(await weth.balanceOf(user.address)).to.equal(
      dataBefore.userWeth.add(delta.userWeth),
      "user's WETH balance"
    );
    expect(await weth.balanceOf(oethVault.address)).to.equal(
      dataBefore.vaultWeth.add(delta.vaultWeth),
      "Vault WETH balance"
    );

    const queueAfter = await oethVault.withdrawalQueueMetadata();
    expect(queueAfter.queued).to.equal(
      dataBefore.queue.queued.add(delta.queued)
    );
    expect(queueAfter.claimable).to.equal(
      dataBefore.queue.claimable.add(delta.claimable)
    );
    expect(queueAfter.claimed).to.equal(
      dataBefore.queue.claimed.add(delta.claimed)
    );
    expect(queueAfter.nextWithdrawalIndex).to.equal(
      dataBefore.queue.nextWithdrawalIndex.add(delta.nextWithdrawalIndex)
    );
  };

  describe("Mint", () => {
    it("should mint with WETH", async () => {
      const { oethVault, weth, josh } = fixture;

      const fixtureWithUser = { ...fixture, user: josh };
      const dataBefore = await snapData(fixtureWithUser);

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      await weth.connect(josh).approve(oethVault.address, amount);

      const tx = await oethVault
        .connect(josh)
        .mint(weth.address, amount, minOeth);

      await expect(tx)
        .to.emit(oethVault, "Mint")
        .withArgs(josh.address, amount);

      await assertChangedData(
        dataBefore,
        {
          oethTotal: amount,
          userOeth: amount,
          userWeth: amount.mul(-1),
          vaultWeth: amount,
          queued: 0,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });

    it("should not mint with any other asset", async () => {
      const { oethVault, frxETH, stETH, reth, josh } = fixture;

      const amount = parseUnits("1", 18);
      const minOeth = parseUnits("0.8", 18);

      for (const asset of [frxETH, stETH, reth]) {
        await asset.connect(josh).approve(oethVault.address, amount);
        const tx = oethVault.connect(josh).mint(asset.address, amount, minOeth);

        await expect(tx).to.be.revertedWith("Unsupported asset for minting");
      }
    });

    it("should revert if mint amount is zero", async () => {
      const { oethVault, weth, josh } = fixture;

      const tx = oethVault.connect(josh).mint(weth.address, "0", "0");
      await expect(tx).to.be.revertedWith("Amount must be greater than 0");
    });

    it("should revert if capital is paused", async () => {
      const { oethVault, weth, governor } = fixture;

      await oethVault.connect(governor).pauseCapital();
      expect(await oethVault.capitalPaused()).to.equal(true);

      const tx = oethVault
        .connect(governor)
        .mint(weth.address, oethUnits("10"), "0");
      await expect(tx).to.be.revertedWith("Capital paused");
    });

    it("Should allocate if beyond allocate threshold", async () => {
      const { oethVault, weth, domen, governor } = fixture;

      const mockStrategy = await deployWithConfirmation("MockStrategy");
      await oethVault.connect(governor).approveStrategy(mockStrategy.address);
      await oethVault
        .connect(governor)
        .setAssetDefaultStrategy(weth.address, mockStrategy.address);

      // Mint some WETH
      await weth.connect(domen).approve(oethVault.address, oethUnits("10000"));
      await oethVault.connect(domen).mint(weth.address, oethUnits("100"), "0");

      expect(await weth.balanceOf(mockStrategy.address)).to.eq(
        oethUnits("100")
      );
    });
  });

  describe("Redeem", () => {
    it("should return only WETH in redeem calculations", async () => {
      const { oethVault, weth } = fixture;

      const outputs = await oethVault.calculateRedeemOutputs(
        oethUnits("1234.43")
      );

      const assets = await oethVault.getAllAssets();

      expect(assets.length).to.equal(outputs.length);

      for (let i = 0; i < assets.length; i++) {
        expect(outputs[i]).to.equal(
          assets[i] == weth.address ? oethUnits("1234.43") : "0"
        );
      }
    });

    it("should revert if WETH index isn't cached", async () => {
      const { frxETH, weth } = fixture;

      await deployWithConfirmation("MockOETHVault", [weth.address]);
      const mockVault = await hre.ethers.getContract("MockOETHVault");

      await mockVault.supportAsset(frxETH.address);

      const tx = mockVault.calculateRedeemOutputs(oethUnits("12343"));
      await expect(tx).to.be.revertedWith("WETH Asset index not cached");
    });

    it("should update total supply correctly without redeem fee", async () => {
      const { oethVault, oeth, weth, daniel } = fixture;
      await oethVault.connect(daniel).mint(weth.address, oethUnits("10"), "0");

      const userBalanceBefore = await weth.balanceOf(daniel.address);
      const vaultBalanceBefore = await weth.balanceOf(oethVault.address);
      const supplyBefore = await oeth.totalSupply();

      await oethVault.connect(daniel).redeem(oethUnits("10"), "0");

      const userBalanceAfter = await weth.balanceOf(daniel.address);
      const vaultBalanceAfter = await weth.balanceOf(oethVault.address);
      const supplyAfter = await oeth.totalSupply();

      // Make sure the total supply went down
      expect(userBalanceAfter.sub(userBalanceBefore)).to.eq(oethUnits("10"));
      expect(vaultBalanceBefore.sub(vaultBalanceAfter)).to.eq(oethUnits("10"));
      expect(supplyBefore.sub(supplyAfter)).to.eq(oethUnits("10"));
    });

    it("should update total supply correctly with redeem fee", async () => {
      const { oethVault, oeth, weth, daniel } = fixture;
      await oethVault.connect(daniel).mint(weth.address, oethUnits("10"), "0");

      await oethVault
        .connect(await impersonateAndFund(await oethVault.governor()))
        .setRedeemFeeBps(100);

      const userBalanceBefore = await weth.balanceOf(daniel.address);
      const vaultBalanceBefore = await weth.balanceOf(oethVault.address);
      const supplyBefore = await oeth.totalSupply();

      await oethVault.connect(daniel).redeem(oethUnits("10"), "0");

      const userBalanceAfter = await weth.balanceOf(daniel.address);
      const vaultBalanceAfter = await weth.balanceOf(oethVault.address);
      const supplyAfter = await oeth.totalSupply();

      // Make sure the total supply went down
      expect(userBalanceAfter.sub(userBalanceBefore)).to.eq(
        oethUnits("10").sub(oethUnits("0.1"))
      );
      expect(vaultBalanceBefore.sub(vaultBalanceAfter)).to.eq(
        oethUnits("10").sub(oethUnits("0.1"))
      );
      expect(supplyBefore.sub(supplyAfter)).to.eq(oethUnits("10"));
    });

    it("Should withdraw from strategy if necessary", async () => {
      const { oethVault, weth, domen, governor } = fixture;

      const mockStrategy = await deployWithConfirmation("MockStrategy");
      await oethVault.connect(governor).approveStrategy(mockStrategy.address);
      await oethVault
        .connect(governor)
        .setAssetDefaultStrategy(weth.address, mockStrategy.address);

      // Mint some WETH
      await weth.connect(domen).approve(oethVault.address, oethUnits("10000"));
      await oethVault.connect(domen).mint(weth.address, oethUnits("100"), "0");

      // Mint a small amount that won't get allocated to the strategy
      await oethVault.connect(domen).mint(weth.address, oethUnits("1.23"), "0");

      const vaultBalanceBefore = await weth.balanceOf(oethVault.address);
      const stratBalanceBefore = await weth.balanceOf(mockStrategy.address);
      const userBalanceBefore = await weth.balanceOf(domen.address);

      // Withdraw something more than what the Vault holds
      await oethVault.connect(domen).redeem(oethUnits("12.55"), "0");

      const vaultBalanceAfter = await weth.balanceOf(oethVault.address);
      const stratBalanceAfter = await weth.balanceOf(mockStrategy.address);
      const userBalanceAfter = await weth.balanceOf(domen.address);

      expect(userBalanceAfter.sub(userBalanceBefore)).to.eq(oethUnits("12.55"));

      expect(stratBalanceBefore.sub(stratBalanceAfter)).to.eq(
        oethUnits("12.55")
      );

      expect(vaultBalanceBefore).to.eq(vaultBalanceAfter);
    });

    it("should redeem zero amount without revert", async () => {
      const { oethVault, daniel } = fixture;

      await oethVault.connect(daniel).redeem(0, 0);
    });

    it("should revert on liquidity error", async () => {
      const { oethVault, daniel } = fixture;
      const tx = oethVault
        .connect(daniel)
        .redeem(oethUnits("1023232323232"), "0");
      await expect(tx).to.be.revertedWith("Liquidity error");
    });
  });

  describe("Config", () => {
    it("should allow caching WETH index", async () => {
      const { oethVault, weth, governor } = fixture;

      await oethVault.connect(governor).cacheWETHAssetIndex();

      const index = (await oethVault.wethAssetIndex()).toNumber();

      const assets = await oethVault.getAllAssets();

      expect(assets[index]).to.equal(weth.address);
    });

    it("should not allow anyone other than Governor to change cached index", async () => {
      const { oethVault, strategist } = fixture;

      const tx = oethVault.connect(strategist).cacheWETHAssetIndex();
      await expect(tx).to.be.revertedWith("Caller is not the Governor");
    });

    it("should revert if WETH is not an supported asset", async () => {
      const { frxETH, weth } = fixture;
      const { deployerAddr } = await hre.getNamedAccounts();
      const sDeployer = hre.ethers.provider.getSigner(deployerAddr);

      await deployWithConfirmation("MockOETHVault", [weth.address]);
      const mockVault = await hre.ethers.getContract("MockOETHVault");

      await mockVault.supportAsset(frxETH.address);

      const tx = mockVault.connect(sDeployer).cacheWETHAssetIndex();
      await expect(tx).to.be.revertedWith("Invalid WETH Asset Index");
    });
  });

  describe("Remove Asset", () => {
    it("should allow removing a single asset", async () => {
      const { oethVault, frxETH, governor } = fixture;

      const vaultAdmin = await ethers.getContractAt(
        "OETHVaultAdmin",
        oethVault.address
      );
      const assetCount = (await oethVault.getAssetCount()).toNumber();

      const tx = await oethVault.connect(governor).removeAsset(frxETH.address);

      await expect(tx)
        .to.emit(vaultAdmin, "AssetRemoved")
        .withArgs(frxETH.address);
      await expect(tx)
        .to.emit(vaultAdmin, "AssetDefaultStrategyUpdated")
        .withArgs(frxETH.address, addresses.zero);

      expect(await oethVault.isSupportedAsset(frxETH.address)).to.be.false;
      expect(await oethVault.checkBalance(frxETH.address)).to.equal(0);
      expect(await oethVault.assetDefaultStrategies(frxETH.address)).to.equal(
        addresses.zero
      );

      const allAssets = await oethVault.getAllAssets();
      expect(allAssets.length).to.equal(assetCount - 1);

      expect(allAssets).to.not.contain(frxETH.address);

      const config = await oethVault.getAssetConfig(frxETH.address);
      expect(config.isSupported).to.be.false;
    });

    it("should only allow governance to remove assets", async () => {
      const { oethVault, weth, strategist, josh } = fixture;

      for (const signer of [strategist, josh]) {
        let tx = oethVault.connect(signer).removeAsset(weth.address);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");

        tx = oethVault.connect(signer).removeAsset(weth.address);
        await expect(tx).to.be.revertedWith("Caller is not the Governor");
      }
    });

    it("should revert if asset is not supported", async () => {
      const { oethVault, dai, governor } = fixture;
      const tx = oethVault.connect(governor).removeAsset(dai.address);

      await expect(tx).to.be.revertedWith("Asset not supported");
    });

    it("should revert if vault still holds the asset", async () => {
      const { oethVault, weth, governor, daniel } = fixture;

      await oethVault.connect(daniel).mint(weth.address, oethUnits("1"), "0");

      const tx = oethVault.connect(governor).removeAsset(weth.address);

      await expect(tx).to.be.revertedWith("Vault still holds asset");
    });

    it("should not revert for smaller dust", async () => {
      const { oethVault, weth, governor, daniel } = fixture;

      await oethVault.connect(daniel).mint(weth.address, "500000000000", "0");

      const tx = oethVault.connect(governor).removeAsset(weth.address);

      await expect(tx).to.not.be.revertedWith("Vault still holds asset");
    });
  });

  describe("with withdrawal queue", () => {
    beforeEach(async () => {
      const { oethVault, weth, daniel, josh, matt } = fixture;
      // Mint some OETH to three users
      await oethVault.connect(daniel).mint(weth.address, oethUnits("10"), "0");
      await oethVault.connect(josh).mint(weth.address, oethUnits("20"), "0");
      await oethVault.connect(matt).mint(weth.address, oethUnits("30"), "0");
      await oethVault
        .connect(await impersonateAndFund(await oethVault.governor()))
        .setMaxSupplyDiff(oethUnits("0.03"));
    });
    const firstRequestAmount = oethUnits("5");
    const secondRequestAmount = oethUnits("18");
    const delayPeriod = 30 * 60; // 30 minutes
    it("should request first withdrawal by Daniel", async () => {
      const { oethVault, daniel } = fixture;
      const fixtureWithUser = { ...fixture, user: daniel };
      const dataBefore = await snapData(fixtureWithUser);

      const tx = await oethVault
        .connect(daniel)
        .requestWithdrawal(firstRequestAmount);

      await expect(tx)
        .to.emit(oethVault, "WithdrawalRequested")
        .withArgs(daniel.address, 0, firstRequestAmount, firstRequestAmount);

      await assertChangedData(
        dataBefore,
        {
          oethTotal: firstRequestAmount.mul(-1),
          userOeth: firstRequestAmount.mul(-1),
          userWeth: 0,
          vaultWeth: 0,
          queued: firstRequestAmount,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 1,
        },
        fixtureWithUser
      );
    });
    it("should request withdrawal of zero amount", async () => {
      const { oethVault, josh } = fixture;
      const fixtureWithUser = { ...fixture, user: josh };
      await oethVault.connect(josh).requestWithdrawal(firstRequestAmount);
      const dataBefore = await snapData(fixtureWithUser);

      const tx = await oethVault.connect(josh).requestWithdrawal(0);

      await expect(tx)
        .to.emit(oethVault, "WithdrawalRequested")
        .withArgs(josh.address, 1, 0, firstRequestAmount);

      await assertChangedData(
        dataBefore,
        {
          oethTotal: 0,
          userOeth: 0,
          userWeth: 0,
          vaultWeth: 0,
          queued: 0,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 1,
        },
        fixtureWithUser
      );
    });
    it("should request first and second withdrawals with no WETH in the Vault", async () => {
      const { oethVault, governor, josh, matt, weth } = fixture;
      const fixtureWithUser = { ...fixture, user: josh };

      const mockStrategy = await deployWithConfirmation("MockStrategy");
      await oethVault.connect(governor).approveStrategy(mockStrategy.address);

      // Deposit all 10 + 20 + 30 = 60 WETH to strategy
      await oethVault
        .connect(governor)
        .depositToStrategy(
          mockStrategy.address,
          [weth.address],
          [oethUnits("60")]
        );

      const dataBefore = await snapData(fixtureWithUser);

      await oethVault.connect(josh).requestWithdrawal(firstRequestAmount);
      const tx = await oethVault
        .connect(matt)
        .requestWithdrawal(secondRequestAmount);

      await expect(tx)
        .to.emit(oethVault, "WithdrawalRequested")
        .withArgs(
          matt.address,
          1,
          secondRequestAmount,
          firstRequestAmount.add(secondRequestAmount)
        );

      await assertChangedData(
        dataBefore,
        {
          oethTotal: firstRequestAmount.add(secondRequestAmount).mul(-1),
          userOeth: firstRequestAmount.mul(-1),
          userWeth: 0,
          vaultWeth: 0,
          queued: firstRequestAmount.add(secondRequestAmount),
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 2,
        },
        fixtureWithUser
      );
    });
    it("should request second withdrawal by matt", async () => {
      const { oethVault, daniel, matt } = fixture;
      const fixtureWithUser = { ...fixture, user: matt };
      await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
      const dataBefore = await snapData(fixtureWithUser);

      const tx = await oethVault
        .connect(matt)
        .requestWithdrawal(secondRequestAmount);

      await expect(tx)
        .to.emit(oethVault, "WithdrawalRequested")
        .withArgs(
          matt.address,
          1,
          secondRequestAmount,
          firstRequestAmount.add(secondRequestAmount)
        );

      await assertChangedData(
        dataBefore,
        {
          oethTotal: secondRequestAmount.mul(-1),
          userOeth: secondRequestAmount.mul(-1),
          userWeth: 0,
          vaultWeth: 0,
          queued: secondRequestAmount,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 1,
        },
        fixtureWithUser
      );
    });
    it("Should add claimable liquidity to the withdrawal queue", async () => {
      const { oethVault, daniel, josh } = fixture;
      const fixtureWithUser = { ...fixture, user: josh };
      await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
      await oethVault.connect(josh).requestWithdrawal(secondRequestAmount);
      const dataBefore = await snapData(fixtureWithUser);

      const tx = await oethVault.connect(josh).addWithdrawalQueueLiquidity();

      await expect(tx)
        .to.emit(oethVault, "WithdrawalClaimable")
        .withArgs(
          firstRequestAmount.add(secondRequestAmount),
          firstRequestAmount.add(secondRequestAmount)
        );

      await assertChangedData(
        dataBefore,
        {
          oethTotal: 0,
          userOeth: 0,
          userWeth: 0,
          vaultWeth: 0,
          queued: 0,
          claimable: firstRequestAmount.add(secondRequestAmount),
          claimed: 0,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });
    it("Should claim second request with enough liquidity", async () => {
      const { oethVault, daniel, josh } = fixture;
      const fixtureWithUser = { ...fixture, user: josh };
      await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
      await oethVault.connect(josh).requestWithdrawal(secondRequestAmount);
      const requestId = 1; // ids start at 0 so the second request is at index 1
      const dataBefore = await snapData(fixtureWithUser);

      await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

      const tx = await oethVault.connect(josh).claimWithdrawal(requestId);

      await expect(tx)
        .to.emit(oethVault, "WithdrawalClaimed")
        .withArgs(josh.address, requestId, secondRequestAmount);
      await expect(tx)
        .to.emit(oethVault, "WithdrawalClaimable")
        .withArgs(
          firstRequestAmount.add(secondRequestAmount),
          firstRequestAmount.add(secondRequestAmount)
        );

      await assertChangedData(
        dataBefore,
        {
          oethTotal: 0,
          userOeth: 0,
          userWeth: secondRequestAmount,
          vaultWeth: secondRequestAmount.mul(-1),
          queued: 0,
          claimable: firstRequestAmount.add(secondRequestAmount),
          claimed: secondRequestAmount,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });
    it("Should claim multiple requests with enough liquidity", async () => {
      const { oethVault, matt } = fixture;
      const fixtureWithUser = { ...fixture, user: matt };
      await oethVault.connect(matt).requestWithdrawal(firstRequestAmount);
      await oethVault.connect(matt).requestWithdrawal(secondRequestAmount);
      const dataBefore = await snapData(fixtureWithUser);

      await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

      const tx = await oethVault.connect(matt).claimWithdrawals([0, 1]);

      await expect(tx)
        .to.emit(oethVault, "WithdrawalClaimed")
        .withArgs(matt.address, 0, firstRequestAmount);
      await expect(tx)
        .to.emit(oethVault, "WithdrawalClaimed")
        .withArgs(matt.address, 1, secondRequestAmount);
      await expect(tx)
        .to.emit(oethVault, "WithdrawalClaimable")
        .withArgs(
          firstRequestAmount.add(secondRequestAmount),
          firstRequestAmount.add(secondRequestAmount)
        );

      await assertChangedData(
        dataBefore,
        {
          oethTotal: 0,
          userOeth: 0,
          userWeth: firstRequestAmount.add(secondRequestAmount),
          vaultWeth: firstRequestAmount.add(secondRequestAmount).mul(-1),
          queued: 0,
          claimable: firstRequestAmount.add(secondRequestAmount),
          claimed: firstRequestAmount.add(secondRequestAmount),
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
      );
    });
    it("Should claim single big request as a whale", async () => {
      const { oethVault, oeth, matt } = fixture;

      const oethBalanceBefore = await oeth.balanceOf(matt.address);
      const totalValueBefore = await oethVault.totalValue();

      await oethVault.connect(matt).requestWithdrawal(oethUnits("30"));

      const oethBalanceAfter = await oeth.balanceOf(matt.address);
      const totalValueAfter = await oethVault.totalValue();
      await expect(oethBalanceBefore).to.equal(oethUnits("30"));
      await expect(oethBalanceAfter).to.equal(oethUnits("0"));
      await expect(totalValueBefore.sub(totalValueAfter)).to.equal(
        oethUnits("30")
      );

      const oethTotalSupply = await oeth.totalSupply();
      await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
      const tx = await oethVault.connect(matt).claimWithdrawal(0); // Claim withdrawal for 50% of the supply

      await expect(tx)
        .to.emit(oethVault, "WithdrawalClaimed")
        .withArgs(matt.address, 0, oethUnits("30"));

      await expect(oethTotalSupply).to.equal(await oeth.totalSupply());
      await expect(totalValueAfter).to.equal(await oethVault.totalValue());
    });

    it("Should fail claim request because of not enough time passed", async () => {
      const { oethVault, daniel } = fixture;

      // Daniel requests 5 OETH to be withdrawn
      await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
      const requestId = 0;

      // Daniel claimWithdraw request in the same block as the request
      const tx = oethVault.connect(daniel).claimWithdrawal(requestId);

      await expect(tx).to.revertedWith("Claim delay not met");
    });
    it("Should fail request withdrawal because of solvency check too high", async () => {
      const { oethVault, daniel, weth } = fixture;

      await weth.connect(daniel).transfer(oethVault.address, oethUnits("10"));

      const tx = oethVault
        .connect(daniel)
        .requestWithdrawal(firstRequestAmount);

      await expect(tx).to.revertedWith("Backing supply liquidity error");
    });
    it("Should fail claim request because of solvency check too high", async () => {
      const { oethVault, daniel, weth } = fixture;

      // Request withdrawal of 5 OETH
      await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);

      // Transfer 10 WETH to the vault
      await weth.connect(daniel).transfer(oethVault.address, oethUnits("10"));

      await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

      // Claim the withdrawal
      const tx = oethVault.connect(daniel).claimWithdrawal(0);

      await expect(tx).to.revertedWith("Backing supply liquidity error");
    });
    it("Should fail multiple claim requests because of solvency check too high", async () => {
      const { oethVault, matt, weth } = fixture;

      // Request withdrawal of 5 OETH
      await oethVault.connect(matt).requestWithdrawal(firstRequestAmount);
      await oethVault.connect(matt).requestWithdrawal(secondRequestAmount);

      // Transfer 10 WETH to the vault
      await weth.connect(matt).transfer(oethVault.address, oethUnits("10"));

      await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

      // Claim the withdrawal
      const tx = oethVault.connect(matt).claimWithdrawals([0, 1]);

      await expect(tx).to.revertedWith("Backing supply liquidity error");
    });

    it("Should fail request withdrawal because of solvency check too low", async () => {
      const { oethVault, daniel, weth } = fixture;

      // Simulate a loss of funds from the vault
      await weth
        .connect(await impersonateAndFund(oethVault.address))
        .transfer(daniel.address, oethUnits("10"));

      const tx = oethVault
        .connect(daniel)
        .requestWithdrawal(firstRequestAmount);

      await expect(tx).to.revertedWith("Backing supply liquidity error");
    });

    describe("when deposit some WETH to a strategy", () => {
      let mockStrategy;
      beforeEach(async () => {
        const { oethVault, weth, governor, daniel, josh } = fixture;

        const dMockStrategy = await deployWithConfirmation("MockStrategy");
        mockStrategy = await ethers.getContractAt(
          "MockStrategy",
          dMockStrategy.address
        );
        await mockStrategy.setWithdrawAll(weth.address, oethVault.address);
        await oethVault.connect(governor).approveStrategy(mockStrategy.address);

        // Deposit 15 WETH of 10 + 20 + 30 = 60 WETH to strategy
        // This leave 60 - 15 = 45 WETH in the vault
        await oethVault
          .connect(governor)
          .depositToStrategy(
            mockStrategy.address,
            [weth.address],
            [oethUnits("15")]
          );
        // Request withdrawal of 5 + 18 = 23 OETH
        // This leave 45 - 23 = 22 WETH unallocated to the withdrawal queue
        await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
        await oethVault.connect(josh).requestWithdrawal(secondRequestAmount);
      });
      it("Should not deposit allocated WETH to a strategy", async () => {
        const { oethVault, weth, governor } = fixture;

        // WETH in the vault = 60 - 15 = 45 WETH
        // unallocated WETH in the Vault = 45 - 23 = 22 WETH
        // 23 WETH to deposit > the 22 WETH available so it should revert
        const depositAmount = oethUnits("23");
        const tx = oethVault
          .connect(governor)
          .depositToStrategy(
            mockStrategy.address,
            [weth.address],
            [depositAmount]
          );
        await expect(tx).to.be.revertedWith("Not enough WETH available");
      });
      it("Should deposit unallocated WETH to a strategy", async () => {
        const { oethVault, weth, governor } = fixture;

        // WETH in the vault = 60 - 15 = 45 WETH
        // unallocated WETH in the Vault = 45 - 23 = 22 WETH
        const depositAmount = oethUnits("22");
        await oethVault
          .connect(governor)
          .depositToStrategy(
            mockStrategy.address,
            [weth.address],
            [depositAmount]
          );
      });
      it("Should claim first request with enough liquidity", async () => {
        const { oethVault, daniel } = fixture;
        const fixtureWithUser = { ...fixture, user: daniel };
        const dataBefore = await snapData(fixtureWithUser);

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = await oethVault.connect(daniel).claimWithdrawal(0);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(daniel.address, 0, firstRequestAmount);

        await assertChangedData(
          dataBefore,
          {
            oethTotal: 0,
            userOeth: 0,
            userWeth: firstRequestAmount,
            vaultWeth: firstRequestAmount.mul(-1),
            queued: 0,
            claimable: firstRequestAmount.add(secondRequestAmount),
            claimed: firstRequestAmount,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should claim a new request with enough WETH liquidity", async () => {
        const { oethVault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };

        // Set the claimable amount to the queued amount
        await oethVault.addWithdrawalQueueLiquidity();

        // WETH in the vault = 60 - 15 = 45 WETH
        // unallocated WETH in the Vault = 45 - 23 = 22 WETH
        // Matt request all unallocated WETH to be withdrawn
        const requestAmount = oethUnits("22");
        await oethVault.connect(matt).requestWithdrawal(requestAmount);

        const dataBefore = await snapData(fixtureWithUser);

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = await oethVault.connect(matt).claimWithdrawal(2);

        await expect(tx)
          .to.emit(oethVault, "WithdrawalClaimed")
          .withArgs(matt.address, 2, requestAmount);

        await assertChangedData(
          dataBefore,
          {
            oethTotal: 0,
            userOeth: 0,
            userWeth: requestAmount,
            vaultWeth: requestAmount.mul(-1),
            queued: 0,
            claimable: requestAmount,
            claimed: requestAmount,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should fail to claim a new request with NOT enough WETH liquidity", async () => {
        const { oethVault, matt } = fixture;

        // Matt request 23 OETH to be withdrawn when only 22 WETH is unallocated to existing requests
        const requestAmount = oethUnits("23");
        await oethVault.connect(matt).requestWithdrawal(requestAmount);

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = oethVault.connect(matt).claimWithdrawal(2);
        await expect(tx).to.be.revertedWith("Queue pending liquidity");
      });
      it("Should claim a new request after withdraw from strategy adds enough liquidity", async () => {
        const { oethVault, daniel, matt, strategist, weth } = fixture;

        // Set the claimable amount to the queued amount
        await oethVault.addWithdrawalQueueLiquidity();

        // Matt requests all 30 OETH to be withdrawn which is currently 8 WETH short
        const requestAmount = oethUnits("30");
        await oethVault.connect(matt).requestWithdrawal(requestAmount);

        const fixtureWithUser = { ...fixture, user: daniel };
        const dataBeforeMint = await snapData(fixtureWithUser);

        // WETH in the vault = 60 - 15 = 45 WETH
        // unallocated WETH in the Vault = 45 - 23 = 22 WETH
        // Add another 8 WETH so the unallocated WETH is 22 + 8 = 30 WETH
        const withdrawAmount = oethUnits("8");
        await oethVault
          .connect(strategist)
          .withdrawFromStrategy(
            mockStrategy.address,
            [weth.address],
            [withdrawAmount]
          );

        await assertChangedData(
          dataBeforeMint,
          {
            oethTotal: 0,
            userOeth: 0,
            userWeth: 0,
            vaultWeth: withdrawAmount,
            queued: 0,
            claimable: requestAmount,
            claimed: 0,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        await oethVault.connect(matt).claimWithdrawal(2);
      });
      it("Should claim a new request after withdrawAllFromStrategy adds enough liquidity", async () => {
        const { oethVault, daniel, matt, strategist, weth } = fixture;

        // Set the claimable amount to the queued amount
        await oethVault.addWithdrawalQueueLiquidity();

        // Matt requests all 30 OETH to be withdrawn which is currently 8 WETH short
        const requestAmount = oethUnits("30");
        await oethVault.connect(matt).requestWithdrawal(requestAmount);

        const fixtureWithUser = { ...fixture, user: daniel };
        const dataBeforeMint = await snapData(fixtureWithUser);
        const strategyBalanceBefore = await weth.balanceOf(
          mockStrategy.address
        );

        // WETH in the vault = 60 - 15 = 45 WETH
        // unallocated WETH in the Vault = 45 - 23 = 22 WETH
        // Add another 8 WETH so the unallocated WETH is 22 + 8 = 30 WETH
        await oethVault
          .connect(strategist)
          .withdrawAllFromStrategy(mockStrategy.address);

        await assertChangedData(
          dataBeforeMint,
          {
            oethTotal: 0,
            userOeth: 0,
            userWeth: 0,
            vaultWeth: strategyBalanceBefore,
            queued: 0,
            claimable: requestAmount,
            claimed: 0,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        await oethVault.connect(matt).claimWithdrawal(2);
      });
      it("Should claim a new request after withdrawAll from strategies adds enough liquidity", async () => {
        const { oethVault, daniel, matt, strategist, weth } = fixture;

        // Set the claimable amount to the queued amount
        await oethVault.addWithdrawalQueueLiquidity();

        // Matt requests all 30 OETH to be withdrawn which is currently 8 WETH short
        const requestAmount = oethUnits("30");
        await oethVault.connect(matt).requestWithdrawal(requestAmount);

        const fixtureWithUser = { ...fixture, user: daniel };
        const dataBeforeMint = await snapData(fixtureWithUser);
        const strategyBalanceBefore = await weth.balanceOf(
          mockStrategy.address
        );

        // WETH in the vault = 60 - 15 = 45 WETH
        // unallocated WETH in the Vault = 45 - 23 = 22 WETH
        // Add another 8 WETH so the unallocated WETH is 22 + 8 = 30 WETH
        await oethVault.connect(strategist).withdrawAllFromStrategies();

        await assertChangedData(
          dataBeforeMint,
          {
            oethTotal: 0,
            userOeth: 0,
            userWeth: 0,
            vaultWeth: strategyBalanceBefore,
            queued: 0,
            claimable: requestAmount,
            claimed: 0,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        await oethVault.connect(matt).claimWithdrawal(2);
      });
      it("Should fail to claim a new request after mint with NOT enough liquidity", async () => {
        const { oethVault, daniel, matt, weth } = fixture;

        // Matt requests all 30 OETH to be withdrawn which is not enough liquidity
        const requestAmount = oethUnits("30");
        await oethVault.connect(matt).requestWithdrawal(requestAmount);

        // WETH in the vault = 60 - 15 = 45 WETH
        // unallocated WETH in the Vault = 45 - 23 = 22 WETH
        // Add another 6 WETH so the unallocated WETH is 22 + 6 = 28 WETH
        await oethVault.connect(daniel).mint(weth.address, oethUnits("6"), 0);

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = oethVault.connect(matt).claimWithdrawal(2);
        await expect(tx).to.be.revertedWith("Queue pending liquidity");
      });
      it("Should claim a new request after mint adds enough liquidity", async () => {
        const { oethVault, daniel, matt, weth } = fixture;

        // Set the claimable amount to the queued amount
        await oethVault.addWithdrawalQueueLiquidity();

        // Matt requests all 30 OETH to be withdrawn which is currently 8 WETH short
        const requestAmount = oethUnits("30");
        await oethVault.connect(matt).requestWithdrawal(requestAmount);

        const fixtureWithUser = { ...fixture, user: daniel };
        const dataBeforeMint = await snapData(fixtureWithUser);

        // WETH in the vault = 60 - 15 = 45 WETH
        // unallocated WETH in the Vault = 45 - 23 = 22 WETH
        // Add another 8 WETH so the unallocated WETH is 22 + 8 = 30 WETH
        const mintAmount = oethUnits("8");
        await oethVault.connect(daniel).mint(weth.address, mintAmount, 0);

        await assertChangedData(
          dataBeforeMint,
          {
            oethTotal: mintAmount,
            userOeth: mintAmount,
            userWeth: mintAmount.mul(-1),
            vaultWeth: mintAmount,
            queued: 0,
            claimable: requestAmount,
            claimed: 0,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        await oethVault.connect(matt).claimWithdrawal(2);
      });
    });

    describe("Should fail when", () => {
      it("request doesn't have enough OETH", async () => {
        const { oethVault, josh } = fixture;
        const fixtureWithUser = { ...fixture, user: josh };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = oethVault
          .connect(josh)
          .requestWithdrawal(dataBefore.userOeth.add(1));

        await expect(tx).to.revertedWith("Remove exceeds balance");
      });
      it("capital is paused", async () => {
        const { oethVault, governor, josh } = fixture;

        await oethVault.connect(governor).pauseCapital();

        const tx = oethVault
          .connect(josh)
          .requestWithdrawal(firstRequestAmount);

        await expect(tx).to.be.revertedWith("Capital paused");
      });
    });
  });
});
