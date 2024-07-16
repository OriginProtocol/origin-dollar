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

    const oethTotalSupply = await oeth.totalSupply();
    const oethTotalValue = await oethVault.totalValue();
    const vaultCheckBalance = await oethVault.checkBalance(weth.address);
    const userOeth = await oeth.balanceOf(user.address);
    const userWeth = await weth.balanceOf(user.address);
    const vaultWeth = await weth.balanceOf(oethVault.address);
    const queue = await oethVault.withdrawalQueueMetadata();

    return {
      oethTotalSupply,
      oethTotalValue,
      vaultCheckBalance,
      userOeth,
      userWeth,
      vaultWeth,
      queue,
    };
  };

  const assertChangedData = async (dataBefore, delta, fixture) => {
    const { oeth, oethVault, weth, user } = fixture;

    expect(await oeth.totalSupply(), "OETH Total Supply").to.equal(
      dataBefore.oethTotalSupply.add(delta.oethTotalSupply)
    );
    expect(await oethVault.totalValue(), "Vault Total Value").to.equal(
      dataBefore.oethTotalValue.add(delta.oethTotalValue)
    );
    expect(
      await oethVault.checkBalance(weth.address),
      "Vault Check Balance of WETH"
    ).to.equal(dataBefore.vaultCheckBalance.add(delta.vaultCheckBalance));
    expect(await oeth.balanceOf(user.address), "user's OETH balance").to.equal(
      dataBefore.userOeth.add(delta.userOeth)
    );
    expect(await weth.balanceOf(user.address), "user's WETH balance").to.equal(
      dataBefore.userWeth.add(delta.userWeth)
    );
    expect(
      await weth.balanceOf(oethVault.address),
      "Vault WETH balance"
    ).to.equal(dataBefore.vaultWeth.add(delta.vaultWeth));

    const queueAfter = await oethVault.withdrawalQueueMetadata();
    expect(queueAfter.queued, "Queued").to.equal(
      dataBefore.queue.queued.add(delta.queued)
    );
    expect(queueAfter.claimable, "Claimable").to.equal(
      dataBefore.queue.claimable.add(delta.claimable)
    );
    expect(queueAfter.claimed, "Claimed").to.equal(
      dataBefore.queue.claimed.add(delta.claimed)
    );
    expect(queueAfter.nextWithdrawalIndex, "nextWithdrawalIndex").to.equal(
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
          oethTotalSupply: amount,
          oethTotalValue: amount,
          vaultCheckBalance: amount,
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

      const fixtureWithUser = { ...fixture, user: domen };
      const dataBefore = await snapData(fixtureWithUser);

      // Mint some WETH
      await weth.connect(domen).approve(oethVault.address, oethUnits("10000"));
      const mintAmount = oethUnits("100");
      await oethVault.connect(domen).mint(weth.address, mintAmount, "0");

      expect(await weth.balanceOf(mockStrategy.address)).to.eq(
        mintAmount,
        "Strategy has the WETH"
      );

      await assertChangedData(
        dataBefore,
        {
          oethTotalSupply: mintAmount,
          oethTotalValue: mintAmount,
          vaultCheckBalance: mintAmount,
          userOeth: mintAmount,
          userWeth: mintAmount.mul(-1),
          vaultWeth: 0,
          queued: 0,
          claimable: 0,
          claimed: 0,
          nextWithdrawalIndex: 0,
        },
        fixtureWithUser
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

    it("should return all strategies", async () => {
      // Mostly to increase coverage

      const { oethVault, weth, governor } = fixture;

      // Empty list
      await expect((await oethVault.getAllStrategies()).length).to.equal(0);

      // Add a strategy
      await oethVault.connect(governor).approveStrategy(weth.address);

      // Check the strategy list
      await expect(await oethVault.getAllStrategies()).to.deep.equal([
        weth.address,
      ]);
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

    it("should allow strategy to burnForStrategy", async () => {
      const { oethVault, oeth, weth, governor, daniel } = fixture;

      await oethVault.connect(governor).setOusdMetaStrategy(daniel.address);

      // First increase netOusdMintForStrategyThreshold
      await oethVault
        .connect(governor)
        .setNetOusdMintForStrategyThreshold(oethUnits("100"));

      // Then mint for strategy
      await oethVault.connect(daniel).mint(weth.address, oethUnits("10"), "0");

      await expect(await oeth.balanceOf(daniel.address)).to.equal(
        oethUnits("10")
      );

      // Then burn for strategy
      await oethVault.connect(daniel).burnForStrategy(oethUnits("10"));

      await expect(await oeth.balanceOf(daniel.address)).to.equal(
        oethUnits("0")
      );
    });

    it("Fail when burnForStrategy because Amoount too high", async () => {
      const { oethVault, governor, daniel } = fixture;

      await oethVault.connect(governor).setOusdMetaStrategy(daniel.address);
      const tx = oethVault
        .connect(daniel)
        .burnForStrategy(parseUnits("10", 76));

      await expect(tx).to.be.revertedWith("Amount too high");
    });

    it("Fail when burnForStrategy because Attempting to burn too much OUSD.", async () => {
      const { oethVault, governor, daniel } = fixture;

      await oethVault.connect(governor).setOusdMetaStrategy(daniel.address);

      // Then try to burn more than authorized
      const tx = oethVault.connect(daniel).burnForStrategy(oethUnits("0"));

      await expect(tx).to.be.revertedWith("Attempting to burn too much OUSD.");
    });
  });

  describe("Withdrawal Queue", () => {
    const delayPeriod = 30 * 60; // 30 minutes
    describe("with all 60 WETH in the vault", () => {
      beforeEach(async () => {
        const { oethVault, weth, daniel, josh, matt } = fixture;
        // Mint some OETH to three users
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("10"), "0");
        await oethVault.connect(josh).mint(weth.address, oethUnits("20"), "0");
        await oethVault.connect(matt).mint(weth.address, oethUnits("30"), "0");
        await oethVault
          .connect(await impersonateAndFund(await oethVault.governor()))
          .setMaxSupplyDiff(oethUnits("0.03"));
      });
      const firstRequestAmount = oethUnits("5");
      const secondRequestAmount = oethUnits("18");
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
            oethTotalSupply: firstRequestAmount.mul(-1),
            oethTotalValue: firstRequestAmount.mul(-1),
            vaultCheckBalance: firstRequestAmount.mul(-1),
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
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
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
            oethTotalSupply: firstRequestAmount
              .add(secondRequestAmount)
              .mul(-1),
            oethTotalValue: firstRequestAmount.add(secondRequestAmount).mul(-1),
            vaultCheckBalance: firstRequestAmount
              .add(secondRequestAmount)
              .mul(-1),
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
            oethTotalSupply: secondRequestAmount.mul(-1),
            oethTotalValue: secondRequestAmount.mul(-1),
            vaultCheckBalance: secondRequestAmount.mul(-1),
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
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
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
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
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
            oethTotalSupply: 0,
            oethTotalValue: 0,
            vaultCheckBalance: 0,
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

      it("Fail to claim request because of not enough time passed", async () => {
        const { oethVault, daniel } = fixture;

        // Daniel requests 5 OETH to be withdrawn
        await oethVault.connect(daniel).requestWithdrawal(firstRequestAmount);
        const requestId = 0;

        // Daniel claimWithdraw request in the same block as the request
        const tx = oethVault.connect(daniel).claimWithdrawal(requestId);

        await expect(tx).to.revertedWith("Claim delay not met");
      });
      it("Fail to request withdrawal because of solvency check too high", async () => {
        const { oethVault, daniel, weth } = fixture;

        await weth.connect(daniel).transfer(oethVault.address, oethUnits("10"));

        const tx = oethVault
          .connect(daniel)
          .requestWithdrawal(firstRequestAmount);

        await expect(tx).to.revertedWith("Backing supply liquidity error");
      });
      it("Fail to claim request because of solvency check too high", async () => {
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
      it("Fail multiple claim requests because of solvency check too high", async () => {
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

      it("Fail request withdrawal because of solvency check too low", async () => {
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

      describe("when deposit 15 WETH to a strategy, leaving 60 - 15 = 45 WETH in the vault; request withdrawal of 5 + 18 = 23 OETH, leaving 45 - 23 = 22 WETH unallocated", () => {
        let mockStrategy;
        beforeEach(async () => {
          const { oethVault, weth, governor, daniel, josh } = fixture;

          const dMockStrategy = await deployWithConfirmation("MockStrategy");
          mockStrategy = await ethers.getContractAt(
            "MockStrategy",
            dMockStrategy.address
          );
          await mockStrategy.setWithdrawAll(weth.address, oethVault.address);
          await oethVault
            .connect(governor)
            .approveStrategy(mockStrategy.address);

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
        it("should not deposit allocated WETH during allocate", async () => {
          const { oethVault, governor, weth } = fixture;

          // Set mock strategy as default strategy
          await oethVault
            .connect(governor)
            .setAssetDefaultStrategy(weth.address, mockStrategy.address);

          // and buffer to 10%
          await oethVault.connect(governor).setVaultBuffer(oethUnits("0.1"));

          // WETH in strategy = 15  WETH
          // WETH in the vault = 60 - 15 = 45 WETH
          // Unallocated WETH in the vault = 45 - 23 = 22 WETH

          await oethVault.connect(governor).allocate();

          expect(await weth.balanceOf(mockStrategy.address)).to.approxEqual(
            // 60 - 23 = 37 Unreserved WETH
            // 90% of 37 = 33.3 WETH for allocation
            oethUnits("33.3"),
            "Strategy has the reserved WETH"
          );

          expect(await weth.balanceOf(oethVault.address)).to.approxEqual(
            // 10% of 37 = 3.7 WETH for Vault buffer
            // + 23 reserved WETH
            oethUnits("23").add(oethUnits("3.7")),
            "Vault doesn't have enough WETH"
          );
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
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
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
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
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
        it("Fail to claim a new request with NOT enough WETH liquidity", async () => {
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
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
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
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
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
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
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
        it("Fail to claim a new request after mint with NOT enough liquidity", async () => {
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
              oethTotalSupply: mintAmount,
              oethTotalValue: mintAmount,
              vaultCheckBalance: mintAmount,
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

      describe("Fail when", () => {
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
    describe("with 1% vault buffer, 30 WETH in the queue, 15 WETH in the vault, 85 WETH in the strategy, 5 WETH already claimed", () => {
      let mockStrategy;
      beforeEach(async () => {
        const { governor, oethVault, weth, daniel, domen, josh, matt } =
          fixture;
        // Mint 105 OETH to four users
        await oethVault
          .connect(daniel)
          .mint(weth.address, oethUnits("15"), "0");
        await oethVault.connect(josh).mint(weth.address, oethUnits("20"), "0");
        await oethVault.connect(matt).mint(weth.address, oethUnits("30"), "0");
        await oethVault.connect(domen).mint(weth.address, oethUnits("40"), "0");
        await oethVault
          .connect(await impersonateAndFund(await oethVault.governor()))
          .setMaxSupplyDiff(oethUnits("0.03"));

        // Request and claim 2 + 3 = 5 WETH from Vault
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("2"));
        await oethVault.connect(josh).requestWithdrawal(oethUnits("3"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        await oethVault.connect(daniel).claimWithdrawal(0);
        await oethVault.connect(josh).claimWithdrawal(1);

        // Deploy a mock strategy
        mockStrategy = await deployWithConfirmation("MockStrategy");
        await oethVault.connect(governor).approveStrategy(mockStrategy.address);

        // Deposit 85 WETH to strategy
        await oethVault
          .connect(governor)
          .depositToStrategy(
            mockStrategy.address,
            [weth.address],
            [oethUnits("85")]
          );

        // Set vault buffer to 1%
        await oethVault.connect(governor).setVaultBuffer(oethUnits("0.01"));

        // Have 4 + 12 + 16 = 32 WETH outstanding requests
        await oethVault.connect(daniel).requestWithdrawal(oethUnits("4"));
        await oethVault.connect(josh).requestWithdrawal(oethUnits("12"));
        await oethVault.connect(matt).requestWithdrawal(oethUnits("16"));

        await oethVault.connect(josh).addWithdrawalQueueLiquidity();
      });
      describe("Fail to claim", () => {
        it("a previously claimed withdrawal", async () => {
          const { oethVault, daniel } = fixture;

          const tx = oethVault.connect(daniel).claimWithdrawal(0);

          await expect(tx).to.be.revertedWith("Already claimed");
        });
        it("the first withdrawal with wrong withdrawer", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault.connect(matt).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Not requester");
        });
        it("the first withdrawal request in the queue before 30 minutes", async () => {
          const { oethVault, daniel } = fixture;

          const tx = oethVault.connect(daniel).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Claim delay not met");
        });
      });
      describe("when waited 30 minutes", () => {
        beforeEach(async () => {
          // Advance in time to ensure time delay between request and claim.
          await advanceTime(delayPeriod);
        });
        it("Fail to claim the first withdrawal with wrong withdrawer", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault.connect(matt).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Not requester");
        });
        it("Should claim the first withdrawal request in the queue after 30 minutes", async () => {
          const { oethVault, daniel } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          const tx = await oethVault.connect(daniel).claimWithdrawal(2);

          await expect(tx)
            .to.emit(oethVault, "WithdrawalClaimed")
            .withArgs(daniel.address, 2, oethUnits("4"));

          await assertChangedData(
            dataBefore,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: oethUnits("4"),
              vaultWeth: oethUnits("4").mul(-1),
              queued: 0,
              claimable: 0,
              claimed: oethUnits("4"),
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );
        });
        it("Fail to claim the second withdrawal request in the queue after 30 minutes", async () => {
          const { oethVault, josh } = fixture;

          const tx = oethVault.connect(josh).claimWithdrawal(3);

          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
        it("Fail to claim the last (3rd) withdrawal request in the queue", async () => {
          const { oethVault, matt } = fixture;

          const tx = oethVault.connect(matt).claimWithdrawal(4);

          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
      });
      describe("when mint covers exactly outstanding requests (32 - 15 = 17 OETH)", () => {
        beforeEach(async () => {
          const { oethVault, daniel, weth } = fixture;
          await oethVault
            .connect(daniel)
            .mint(weth.address, oethUnits("17"), "0");

          // Advance in time to ensure time delay between request and claim.
          await advanceTime(delayPeriod);
        });
        it("Should claim the 2nd and 3rd withdrawal requests in the queue", async () => {
          const { oethVault, daniel, josh } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          const tx1 = await oethVault.connect(daniel).claimWithdrawal(2);

          await expect(tx1)
            .to.emit(oethVault, "WithdrawalClaimed")
            .withArgs(daniel.address, 2, oethUnits("4"));

          const tx2 = await oethVault.connect(josh).claimWithdrawal(3);

          await expect(tx2)
            .to.emit(oethVault, "WithdrawalClaimed")
            .withArgs(josh.address, 3, oethUnits("12"));

          await assertChangedData(
            dataBefore,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: oethUnits("4"),
              vaultWeth: oethUnits("16").mul(-1),
              queued: 0,
              claimable: 0,
              claimed: oethUnits("16"),
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );
        });
        it("Fail to deposit 1 WETH to a strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("1")]
            );

          await expect(tx).to.be.revertedWith("Not enough WETH available");
        });
        it("Should not allocate any WETH to the default strategy", async () => {
          const { oethVault, domen } = fixture;

          const tx = await oethVault.connect(domen).allocate();

          await expect(tx).to.not.emit(oethVault, "AssetAllocated");
        });
      });
      describe("when mint covers exactly outstanding requests and vault buffer (17 + 1 WETH)", () => {
        beforeEach(async () => {
          const { oethVault, daniel, weth } = fixture;
          await oethVault
            .connect(daniel)
            .mint(weth.address, oethUnits("18"), "0");
        });
        it("Should deposit 1 WETH to a strategy which is the vault buffer", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = await oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("1")]
            );

          expect(tx)
            .to.emit(weth, "Transfer")
            .withArgs(oethVault.address, mockStrategy.address, oethUnits("1"));
        });
        it("Fail to deposit 1.1 WETH to the default strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("1.1")]
            );

          await expect(tx).to.be.revertedWith("Not enough WETH available");
        });
        it("Should not allocate any WETH to the default strategy", async () => {
          const { oethVault, domen } = fixture;

          const tx = await oethVault.connect(domen).allocate();

          await expect(tx).to.not.emit(oethVault, "AssetAllocated");
        });
      });
      describe("when mint more than covers outstanding requests and vault buffer (17 + 1 + 3 WETH)", () => {
        beforeEach(async () => {
          const { oethVault, daniel, weth } = fixture;
          await oethVault
            .connect(daniel)
            .mint(weth.address, oethUnits("21"), "0");
        });
        it("Should deposit 4 WETH to a strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = await oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("4")]
            );

          expect(tx)
            .to.emit(weth, "Transfer")
            .withArgs(oethVault.address, mockStrategy.address, oethUnits("4"));
        });
        it("Fail to deposit 5 WETH to the default strategy", async () => {
          const { oethVault, weth, governor } = fixture;

          const tx = oethVault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [weth.address],
              [oethUnits("5")]
            );

          await expect(tx).to.be.revertedWith("Not enough WETH available");
        });
        it.skip("Should allocate 3 WETH to the default strategy", async () => {
          const { oethVault, domen } = fixture;

          const tx = await oethVault.connect(domen).allocate();

          await expect(tx).to.emit(oethVault, "AssetAllocated");
        });
      });
    });
  });
});
