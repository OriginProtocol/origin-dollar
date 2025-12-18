const { expect } = require("chai");
const { loadDefaultFixture } = require("../_fixture");

const {
  ousdUnits,
  usdcUnits,
  isFork,
  expectApproxSupply,
  advanceTime
} = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { deployWithConfirmation } = require("../../utils/deploy");


describe("OUSD Vault Redeem", function () {
  if (isFork) {
    this.timeout(0);
  }

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
  });

  describe("Redeem", function () { });

  it("Should allow a redeem for strategist", async () => {
    const { ousd, vault, usdc, strategist } = fixture;

    await expect(strategist).has.a.balanceOf("1000.00", usdc);
    await usdc.connect(strategist).approve(vault.address, usdcUnits("50.0"));
    await vault.connect(strategist).mint(usdc.address, usdcUnits("50.0"), 0);
    await expect(strategist).has.a.balanceOf("50.00", ousd);
    await vault.connect(strategist).redeem(ousdUnits("50.0"), 0);
    await expect(strategist).has.a.balanceOf("0.00", ousd);
    await expect(strategist).has.a.balanceOf("1000.00", usdc);
    expect(await ousd.totalSupply()).to.eq(ousdUnits("200.0"));

    it("Should allow a redeem over the rebase threshold for strategist", async () => {
      const { ousd, vault, usdc, strategist, matt } = fixture;

      await expect(strategist).has.a.balanceOf("1000.00", usdc);

      await expect(strategist).has.a.balanceOf("0.00", ousd);
      await expect(matt).has.a.balanceOf("100.00", ousd);

      // Strategist mints OUSD with USDC
      await usdc.connect(strategist).approve(vault.address, usdcUnits("1000.00"));
      await vault.connect(strategist).mint(usdc.address, usdcUnits("1000.00"), 0);
      await expect(strategist).has.a.balanceOf("1000.00", ousd);
      await expect(matt).has.a.balanceOf("100.00", ousd);

      // Rebase should do nothing
      await vault.rebase();
      await expect(strategist).has.a.balanceOf("1000.00", ousd);
      await expect(matt).has.a.balanceOf("100.00", ousd);

      // Strategist redeems over the rebase threshold
      await vault.connect(strategist).redeem(ousdUnits("500.0"), 0);
      await expect(strategist).has.a.approxBalanceOf("500.00", ousd);
      await expect(matt).has.a.approxBalanceOf("100.00", ousd);

      // Redeem outputs will be 1000/2200 * 1500 USDC and 1200/2200 * 1500 USDS from fixture
      await expect(strategist).has.an.approxBalanceOf("500.00", usdc);
      await expectApproxSupply(ousd, ousdUnits("700.0"));
    });

    it("Should have a default redeem fee of 0", async () => {
      const { vault } = fixture;

      await expect(await vault.redeemFeeBps()).to.equal("0");
    });

    // Skipped because OUSD redeem is only available for strategist or governor
    // and this is without fees.
    it.skip("Should charge a redeem fee if redeem fee set", async () => {
      const { ousd, vault, usdc, anna, governor } = fixture;

      // 1000 basis points = 10%
      await vault.connect(governor).setRedeemFeeBps(1000);
      await expect(anna).has.a.balanceOf("1000.00", usdc);
      await usdc.connect(anna).approve(vault.address, usdcUnits("50.0"));
      await vault.connect(anna).mint(usdc.address, usdcUnits("50.0"), 0);
      await expect(anna).has.a.balanceOf("50.00", ousd);
      await vault.connect(anna).redeem(ousdUnits("50.0"), 0);
      await expect(anna).has.a.balanceOf("0.00", ousd);
      await expect(anna).has.a.balanceOf("995.00", usdc);
    });

    it("Should revert redeem if balance is insufficient", async () => {
      const { ousd, vault, usdc, strategist } = fixture;

      // Mint some OUSD tokens
      await expect(strategist).has.a.balanceOf("1000.00", usdc);
      await usdc.connect(strategist).approve(vault.address, usdcUnits("50.0"));
      await vault.connect(strategist).mint(usdc.address, usdcUnits("50.0"), 0);
      await expect(strategist).has.a.balanceOf("50.00", ousd);

      // Try to withdraw more than balance
      await expect(
        vault.connect(strategist).redeem(ousdUnits("100.0"), 0)
      ).to.be.revertedWith("Transfer amount exceeds balance");
    });

    it("Should only allow Governor to set a redeem fee", async () => {
      const { vault, anna } = fixture;

      await expect(vault.connect(anna).setRedeemFeeBps(100)).to.be.revertedWith(
        "Caller is not the Governor"
      );
    });

    it("Should redeem entire OUSD balance", async () => {
      const { ousd, vault, usdc, strategist } = fixture;

      await expect(strategist).has.a.balanceOf("1000.00", usdc);

      // Mint 100 OUSD tokens using USDC
      await usdc.connect(strategist).approve(vault.address, usdcUnits("100.0"));
      await vault.connect(strategist).mint(usdc.address, usdcUnits("100.0"), 0);
      await expect(strategist).has.a.balanceOf("100.00", ousd);

      // Withdraw all
      await vault
        .connect(strategist)
        .redeem(ousd.balanceOf(strategist.address), 0);

      await expect(strategist).has.a.balanceOf("1000", usdc);
    });

    it("Should have correct balances on consecutive mint and redeem", async () => {
      const { ousd, vault, usdc, strategist, governor } = fixture;

      const usersWithBalances = [
        [strategist, 0],
        [governor, 0],
      ];

      const assetsWithUnits = [[usdc, usdcUnits]];

      for (const [user, startBalance] of usersWithBalances) {
        for (const [asset, units] of assetsWithUnits) {
          for (const amount of [5.09, 10.32, 20.99, 100.01]) {
            await asset
              .connect(user)
              .approve(vault.address, await units(amount.toString()));
            await vault
              .connect(user)
              .mint(asset.address, await units(amount.toString()), 0);
            await expect(user).has.an.approxBalanceOf(
              (startBalance + amount).toString(),
              ousd
            );
            await vault.connect(user).redeem(ousdUnits(amount.toString()), 0);
            await expect(user).has.an.approxBalanceOf(
              startBalance.toString(),
              ousd
            );
          }
        }
      }
    });

    it("Should correctly handle redeem without a rebase and then full redeem", async function () {
      const { ousd, vault, usdc, strategist } = fixture;
      await expect(strategist).has.a.balanceOf("0.00", ousd);
      await usdc.connect(strategist).mint(usdcUnits("3000.0"));
      await usdc.connect(strategist).approve(vault.address, usdcUnits("3000.0"));
      await vault.connect(strategist).mint(usdc.address, usdcUnits("3000.0"), 0);
      await expect(strategist).has.a.balanceOf("3000.00", ousd);

      //redeem without rebasing (not over threshold)
      await vault.connect(strategist).redeem(ousdUnits("200.00"), 0);
      //redeem with rebasing (over threshold)
      await vault
        .connect(strategist)
        .redeem(ousd.balanceOf(strategist.address), 0);

      await expect(strategist).has.a.balanceOf("0.00", ousd);
    });

    it("Should respect minimum unit amount argument in redeem", async () => {
      const { ousd, vault, usdc, strategist } = fixture;

      await expect(strategist).has.a.balanceOf("1000.00", usdc);
      await usdc.connect(strategist).approve(vault.address, usdcUnits("100.0"));
      await vault.connect(strategist).mint(usdc.address, usdcUnits("50.0"), 0);
      await expect(strategist).has.a.balanceOf("50.00", ousd);
      await vault.connect(strategist).redeem(ousdUnits("50.0"), usdcUnits("50"));
      await vault.connect(strategist).mint(usdc.address, usdcUnits("50.0"), 0);
      await expect(
        vault.connect(strategist).redeem(ousdUnits("50.0"), usdcUnits("51"))
      ).to.be.revertedWith("Redeem amount lower than minimum");
    });

    it("Should calculate redeem outputs", async () => {
      const { vault, anna, usdc, ousd } = fixture;

      // OUSD total supply is 200 backed by 200 USDC
      expect((await vault.calculateRedeemOutputs(ousdUnits("50")))[0]).to.equal(
        usdcUnits("50")
      );

      await usdc.connect(anna).approve(vault.address, usdcUnits("600"));
      await vault.connect(anna).mint(usdc.address, usdcUnits("600"), 0);
      await expect(anna).has.a.balanceOf("600", ousd);

      expect((await vault.calculateRedeemOutputs(ousdUnits("100")))[0]).to.equal(
        usdcUnits("100")
      );
    });
  });

  const snapData = async (fixture) => {
    const { ousd, vault, usdc, user } = fixture;

    const ousdTotalSupply = await ousd.totalSupply();
    const ousdTotalValue = await vault.totalValue();
    const vaultCheckBalance = await vault.checkBalance(usdc.address);
    const userOusd = await ousd.balanceOf(user.address);
    const userUsdc = await usdc.balanceOf(user.address);
    const vaultUsdc = await usdc.balanceOf(vault.address);
    const queue = await vault.withdrawalQueueMetadata();

    return {
      ousdTotalSupply,
      ousdTotalValue,
      vaultCheckBalance,
      userOusd,
      userUsdc,
      vaultUsdc,
      queue,
    };
  };

  const assertChangedData = async (dataBefore, delta, fixture) => {
    const { ousd, vault, usdc, user } = fixture;

    expect(await ousd.totalSupply(), "OUSD Total Supply").to.equal(
      dataBefore.ousdTotalSupply.add(delta.ousdTotalSupply)
    );
    expect(await vault.totalValue(), "Vault Total Value").to.equal(
      dataBefore.ousdTotalValue.add(delta.ousdTotalValue)
    );
    expect(
      await vault.checkBalance(usdc.address),
      "Vault Check Balance of USDC"
    ).to.equal(dataBefore.vaultCheckBalance.add(delta.vaultCheckBalance));
    expect(await ousd.balanceOf(user.address), "user's OUSD balance").to.equal(
      dataBefore.userOusd.add(delta.userOusd)
    );
    expect(await usdc.balanceOf(user.address), "user's USDC balance").to.equal(
      dataBefore.userUsdc.add(delta.userUsdc)
    );
    expect(
      await usdc.balanceOf(vault.address),
      "Vault USDC balance"
    ).to.equal(dataBefore.vaultUsdc.add(delta.vaultUsdc));

    const queueAfter = await vault.withdrawalQueueMetadata();
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

  describe("Withdrawal Queue", function () {
    const delayPeriod = 10 * 60; // 10 minutes
    beforeEach(async () => {
      const { vault, governor } = fixture;
      await vault.connect(governor).setWithdrawalClaimDelay(delayPeriod);
    });
    describe.only("with all 60 USDC in the vault", () => {
      beforeEach(async () => {
        const { vault, usdc, daniel, josh, matt } = fixture;

        // Fund three users with USDC
        await usdc.mintTo(daniel.address, usdcUnits("10"));
        await usdc.mintTo(josh.address, usdcUnits("20"));
        await usdc.mintTo(matt.address, usdcUnits("30"));

        // Approve vault to spend USDC
        await usdc.connect(daniel).approve(vault.address, usdcUnits("10"));
        await usdc.connect(josh).approve(vault.address, usdcUnits("20"));
        await usdc.connect(matt).approve(vault.address, usdcUnits("30"));

        // Mint some OUSD to three users
        await vault
          .connect(daniel)
          .mint(usdc.address, usdcUnits("10"), "0");
        await vault.connect(josh).mint(usdc.address, usdcUnits("20"), "0");
        await vault.connect(matt).mint(usdc.address, usdcUnits("30"), "0");

        // Set max supply diff to 3% to allow withdrawals
        await vault
          .connect(await impersonateAndFund(await vault.governor()))
          .setMaxSupplyDiff(ousdUnits("0.03"));
      });
      const firstRequestAmountOUSD = ousdUnits("5");
      const firstRequestAmountUSDC = usdcUnits("5");
      const secondRequestAmountOUSD = ousdUnits("18");
      const secondRequestAmountUSDC = usdcUnits("18");

      // Positive Test
      it("Should request first withdrawal by Daniel", async () => {
        const { vault, daniel } = fixture;
        const fixtureWithUser = { ...fixture, user: daniel };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault
          .connect(daniel)
          .requestWithdrawal(firstRequestAmountOUSD);

        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(daniel.address, 0, firstRequestAmountOUSD, firstRequestAmountUSDC);

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: firstRequestAmountOUSD.mul(-1),
            ousdTotalValue: firstRequestAmountOUSD.mul(-1),
            vaultCheckBalance: firstRequestAmountUSDC.mul(-1),
            userOusd: firstRequestAmountOUSD.mul(-1),
            userUsdc: 0,
            vaultUsdc: 0,
            queued: firstRequestAmountUSDC,
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      it("Should request withdrawal of zero amount", async () => {
        const { vault, josh } = fixture;
        const fixtureWithUser = { ...fixture, user: josh };
        await vault.connect(josh).requestWithdrawal(firstRequestAmountOUSD);
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(josh).requestWithdrawal(0);

        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(josh.address, 1, 0, firstRequestAmountUSDC);

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: 0,
            ousdTotalValue: 0,
            vaultCheckBalance: 0,
            userOusd: 0,
            userUsdc: 0,
            vaultUsdc: 0,
            queued: 0,
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      it("Should request first and second withdrawals with no USDC in the Vault", async () => {
        const { vault, governor, josh, matt, usdc } = fixture;
        const fixtureWithUser = { ...fixture, user: josh };

        const mockStrategy = await deployWithConfirmation("MockStrategy");
        await vault.connect(governor).approveStrategy(mockStrategy.address);

        // Deposit all 10 + 20 + 30 = 60 USDC to strategy
        await vault
          .connect(governor)
          .depositToStrategy(
            mockStrategy.address,
            [usdc.address],
            [usdcUnits("60")]
          );

        const dataBefore = await snapData(fixtureWithUser);

        await vault.connect(josh).requestWithdrawal(firstRequestAmountOUSD);
        const tx = await vault
          .connect(matt)
          .requestWithdrawal(secondRequestAmountOUSD);

        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(
            matt.address,
            1,
            secondRequestAmountOUSD,
            firstRequestAmountUSDC.add(secondRequestAmountUSDC)
          );

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: firstRequestAmountOUSD
              .add(secondRequestAmountOUSD)
              .mul(-1),
            ousdTotalValue: firstRequestAmountOUSD.add(secondRequestAmountOUSD).mul(-1),
            vaultCheckBalance: firstRequestAmountUSDC
              .add(secondRequestAmountUSDC)
              .mul(-1),
            userOusd: firstRequestAmountOUSD.mul(-1),
            userUsdc: 0,
            vaultUsdc: 0,
            queued: firstRequestAmountUSDC.add(secondRequestAmountUSDC),
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 2,
          },
          fixtureWithUser
        );
      });
      it("Should request second withdrawal by matt", async () => {
        const { vault, daniel, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        await vault.connect(daniel).requestWithdrawal(firstRequestAmountOUSD);
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault
          .connect(matt)
          .requestWithdrawal(secondRequestAmountOUSD);

        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(
            matt.address,
            1,
            secondRequestAmountOUSD,
            firstRequestAmountUSDC.add(secondRequestAmountUSDC)
          );

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: secondRequestAmountOUSD.mul(-1),
            ousdTotalValue: secondRequestAmountOUSD.mul(-1),
            vaultCheckBalance: secondRequestAmountUSDC.mul(-1),
            userOusd: secondRequestAmountOUSD.mul(-1),
            userUsdc: 0,
            vaultUsdc: 0,
            queued: secondRequestAmountUSDC,
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      it("Should add claimable liquidity to the withdrawal queue", async () => {
        const { vault, daniel, josh } = fixture;
        const fixtureWithUser = { ...fixture, user: josh };
        await vault.connect(daniel).requestWithdrawal(firstRequestAmountOUSD);
        await vault.connect(josh).requestWithdrawal(secondRequestAmountOUSD);
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(josh).addWithdrawalQueueLiquidity();

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimable")
          .withArgs(
            firstRequestAmountUSDC.add(secondRequestAmountUSDC),
            firstRequestAmountUSDC.add(secondRequestAmountUSDC)
          );

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: 0,
            ousdTotalValue: 0,
            vaultCheckBalance: 0,
            userOusd: 0,
            userUsdc: 0,
            vaultUsdc: 0,
            queued: 0,
            claimable: firstRequestAmountUSDC.add(secondRequestAmountUSDC),
            claimed: 0,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should claim second request with enough liquidity", async () => {
        const { vault, daniel, josh } = fixture;
        const fixtureWithUser = { ...fixture, user: josh };
        await vault.connect(daniel).requestWithdrawal(firstRequestAmountOUSD);
        await vault.connect(josh).requestWithdrawal(secondRequestAmountOUSD);
        const requestId = 1; // ids start at 0 so the second request is at index 1
        const dataBefore = await snapData(fixtureWithUser);

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = await vault.connect(josh).claimWithdrawal(requestId);

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(josh.address, requestId, secondRequestAmountOUSD);
        await expect(tx)
          .to.emit(vault, "WithdrawalClaimable")
          .withArgs(
            firstRequestAmountUSDC.add(secondRequestAmountUSDC),
            firstRequestAmountUSDC.add(secondRequestAmountUSDC)
          );

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: 0,
            ousdTotalValue: 0,
            vaultCheckBalance: 0,
            userOusd: 0,
            userUsdc: secondRequestAmountUSDC,
            vaultUsdc: secondRequestAmountUSDC.mul(-1),
            queued: 0,
            claimable: firstRequestAmountUSDC.add(secondRequestAmountUSDC),
            claimed: secondRequestAmountUSDC,
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should claim multiple requests with enough liquidity", async () => {
        const { vault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        await vault.connect(matt).requestWithdrawal(firstRequestAmountOUSD);
        await vault.connect(matt).requestWithdrawal(secondRequestAmountOUSD);
        const dataBefore = await snapData(fixtureWithUser);

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = await vault.connect(matt).claimWithdrawals([0, 1]);

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 0, firstRequestAmountOUSD);
        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 1, secondRequestAmountOUSD);
        await expect(tx)
          .to.emit(vault, "WithdrawalClaimable")
          .withArgs(
            firstRequestAmountUSDC.add(secondRequestAmountUSDC),
            firstRequestAmountUSDC.add(secondRequestAmountUSDC)
          );

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: 0,
            ousdTotalValue: 0,
            vaultCheckBalance: 0,
            userOusd: 0,
            userUsdc: firstRequestAmountUSDC.add(secondRequestAmountUSDC),
            vaultUsdc: firstRequestAmountUSDC.add(secondRequestAmountUSDC).mul(-1),
            queued: 0,
            claimable: firstRequestAmountUSDC.add(secondRequestAmountUSDC),
            claimed: firstRequestAmountUSDC.add(secondRequestAmountUSDC),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should claim single big request as a whale", async () => {
        const { vault, ousd, matt } = fixture;

        const ousdBalanceBefore = await ousd.balanceOf(matt.address);
        const totalValueBefore = await vault.totalValue();

        await vault.connect(matt).requestWithdrawal(ousdUnits("130"));

        const ousdBalanceAfter = await ousd.balanceOf(matt.address);
        const totalValueAfter = await vault.totalValue();
        await expect(ousdBalanceBefore).to.equal(ousdUnits("130"));
        await expect(ousdBalanceAfter).to.equal(ousdUnits("0"));
        await expect(totalValueBefore.sub(totalValueAfter)).to.equal(
          ousdUnits("130")
        );

        const ousdTotalSupply = await ousd.totalSupply();
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        const tx = await vault.connect(matt).claimWithdrawal(0); // Claim withdrawal for 50% of the supply

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 0, ousdUnits("130"));

        await expect(ousdTotalSupply).to.equal(await ousd.totalSupply());
        await expect(totalValueAfter).to.equal(await vault.totalValue());
      });

      // Negative tests
      it("Fail to claim request because of not enough time passed", async () => {
        const { vault, daniel } = fixture;

        // Daniel requests 5 OUSD to be withdrawn
        await vault.connect(daniel).requestWithdrawal(firstRequestAmountOUSD);
        const requestId = 0;

        // Daniel claimWithdraw request in the same block as the request
        const tx = vault.connect(daniel).claimWithdrawal(requestId);

        await expect(tx).to.revertedWith("Claim delay not met");
      });
      it("Fail to request withdrawal because of solvency check too high", async () => {
        const { vault, daniel, usdc } = fixture;

        await usdc.mintTo(daniel.address, ousdUnits("10"));
        await usdc.connect(daniel).transfer(vault.address, ousdUnits("10"));

        const tx = vault
          .connect(daniel)
          .requestWithdrawal(firstRequestAmountOUSD);

        await expect(tx).to.revertedWith("Backing supply liquidity error");
      });
      it("Fail to claim request because of solvency check too high", async () => {
        const { vault, daniel, usdc } = fixture;

        // Request withdrawal of 5 OUSD
        await vault.connect(daniel).requestWithdrawal(firstRequestAmountOUSD);

        // Transfer 10 USDC to the vault
        await usdc.mintTo(daniel.address, ousdUnits("10"));
        await usdc.connect(daniel).transfer(vault.address, ousdUnits("10"));

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Claim the withdrawal
        const tx = vault.connect(daniel).claimWithdrawal(0);

        await expect(tx).to.revertedWith("Backing supply liquidity error");
      });
      it("Fail multiple claim requests because of solvency check too high", async () => {
        const { vault, matt, usdc } = fixture;

        // Request withdrawal of 5 OUSD
        await vault.connect(matt).requestWithdrawal(firstRequestAmountOUSD);
        await vault.connect(matt).requestWithdrawal(secondRequestAmountOUSD);

        // Transfer 10 USDC to the vault
        await usdc.mintTo(matt.address, ousdUnits("10"));
        await usdc.connect(matt).transfer(vault.address, ousdUnits("10"));

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Claim the withdrawal
        const tx = vault.connect(matt).claimWithdrawals([0, 1]);

        await expect(tx).to.revertedWith("Backing supply liquidity error");
      });
      it("Fail request withdrawal because of solvency check too low", async () => {
        const { vault, daniel, usdc } = fixture;

        // Simulate a loss of funds from the vault
        await usdc
          .connect(await impersonateAndFund(vault.address))
          .transfer(daniel.address, usdcUnits("10"));

        const tx = vault
          .connect(daniel)
          .requestWithdrawal(firstRequestAmountOUSD);

        await expect(tx).to.revertedWith("Backing supply liquidity error");
      });

      describe.only("when deposit 15 USDC to a strategy, leaving 60 - 15 = 45 USDC in the vault; request withdrawal of 5 + 18 = 23 OUSD, leaving 45 - 23 = 22 USDC unallocated", () => {
        let mockStrategy;
        beforeEach(async () => {
          const { vault, usdc, governor, daniel, josh } = fixture;

          const dMockStrategy = await deployWithConfirmation("MockStrategy");
          mockStrategy = await ethers.getContractAt(
            "MockStrategy",
            dMockStrategy.address
          );
          await mockStrategy.setWithdrawAll(usdc.address, vault.address);
          await vault
            .connect(governor)
            .approveStrategy(mockStrategy.address);

          // Deposit 15 USDC of 10 + 20 + 30 = 60 USDC to strategy
          // This leave 60 - 15 = 45 USDC in the vault
          await vault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [usdc.address],
              [usdcUnits("15")]
            );
          // Request withdrawal of 5 + 18 = 23 OUSD
          // This leave 45 - 23 = 22 USDC unallocated to the withdrawal queue
          await vault.connect(daniel).requestWithdrawal(firstRequestAmountOUSD);
          await vault.connect(josh).requestWithdrawal(secondRequestAmountOUSD);
        });
        it("Fail to deposit allocated USDC to a strategy", async () => {
          const { vault, usdc, governor } = fixture;

          // USDC in the vault = 60 - 15 = 45 USDC
          // unallocated USDC in the Vault = 45 - 23 = 22 USDC
          // 23 USDC to deposit > the 22 USDC available so it should revert
          const depositAmount = usdcUnits("23");
          const tx = vault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [usdc.address],
              [depositAmount]
            );
          await expect(tx).to.be.revertedWith(
            "Not enough backing asset available"
          );
        });
        it("Fail to deposit allocated USDC during allocate", async () => {
          const { vault, governor, usdc } = fixture;

          // Set mock strategy as default strategy
          await vault
            .connect(governor)
            .setDefaultStrategy(mockStrategy.address);

          // and buffer to 10%
          await vault.connect(governor).setVaultBuffer(ousdUnits("0.1"));

          // USDC in strategy = 15  USDC
          // USDC in the vault = 60 - 15 = 45 USDC
          // Unallocated USDC in the vault = 45 - 23 = 22 USDC

          await vault.connect(governor).allocate();

          expect(await usdc.balanceOf(mockStrategy.address)).to.approxEqual(
            // 60 - 23 = 37 Unreserved USDC
            // 90% of 37 = 33.3 USDC for allocation
            ousdUnits("33.3"),
            "Strategy has the reserved USDC"
          );

          expect(await usdc.balanceOf(vault.address)).to.approxEqual(
            // 10% of 37 = 3.7 USDC for Vault buffer
            // + 23 reserved USDC
            ousdUnits("23").add(ousdUnits("3.7")),
            "Vault doesn't have enough USDC"
          );
        });
        it("Should deposit unallocated USDC to a strategy", async () => {
          const { vault, usdc, governor } = fixture;

          // USDC in the vault = 60 - 15 = 45 USDC
          // unallocated USDC in the Vault = 45 - 23 = 22 USDC
          const depositAmount = usdcUnits("22");
          await vault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [usdc.address],
              [depositAmount]
            );
        });
        it("Should claim first request with enough liquidity", async () => {
          const { vault, daniel } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          const tx = await vault.connect(daniel).claimWithdrawal(0);

          await expect(tx)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(daniel.address, 0, firstRequestAmountOUSD);

          await assertChangedData(
            dataBefore,
            {
              oethTotalSupply: 0,
              oethTotalValue: 0,
              vaultCheckBalance: 0,
              userOeth: 0,
              userWeth: firstRequestAmountOUSD,
              vaultWeth: firstRequestAmountOUSD.mul(-1),
              queued: 0,
              claimable: firstRequestAmountOUSD.add(secondRequestAmountOUSD),
              claimed: firstRequestAmountOUSD,
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );
        });
        it("Should claim a new request with enough USDC liquidity", async () => {
          const { vault, matt } = fixture;
          const fixtureWithUser = { ...fixture, user: matt };

          // Set the claimable amount to the queued amount
          await vault.addWithdrawalQueueLiquidity();

          // USDC in the vault = 60 - 15 = 45 USDC
          // unallocated USDC in the Vault = 45 - 23 = 22 USDC
          // Matt request all unallocated USDC to be withdrawn
          const requestAmount = ousdUnits("22");
          await vault.connect(matt).requestWithdrawal(requestAmount);

          const dataBefore = await snapData(fixtureWithUser);

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          const tx = await vault.connect(matt).claimWithdrawal(2);

          await expect(tx)
            .to.emit(vault, "WithdrawalClaimed")
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
        it("Fail to claim a new request with NOT enough USDC liquidity", async () => {
          const { vault, matt } = fixture;

          // Matt request 23 OUSD to be withdrawn when only 22 USDC is unallocated to existing requests
          const requestAmount = ousdUnits("23");
          await vault.connect(matt).requestWithdrawal(requestAmount);

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          const tx = vault.connect(matt).claimWithdrawal(2);
          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
        it("Should claim a new request after withdraw from strategy adds enough liquidity", async () => {
          const { vault, daniel, matt, strategist, usdc } = fixture;

          // Set the claimable amount to the queued amount
          await vault.addWithdrawalQueueLiquidity();

          // Matt requests all 30 OUSD to be withdrawn which is currently 8 USDC short
          const requestAmount = ousdUnits("30");
          await vault.connect(matt).requestWithdrawal(requestAmount);

          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBeforeMint = await snapData(fixtureWithUser);

          // USDC in the vault = 60 - 15 = 45 USDC
          // unallocated USDC in the Vault = 45 - 23 = 22 USDC
          // Add another 8 USDC so the unallocated USDC is 22 + 8 = 30 USDC
          const withdrawAmount = ousdUnits("8");
          await vault
            .connect(strategist)
            .withdrawFromStrategy(
              mockStrategy.address,
              [usdc.address],
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

          await vault.connect(matt).claimWithdrawal(2);
        });
        it("Should claim a new request after withdrawAllFromStrategy adds enough liquidity", async () => {
          const { vault, daniel, matt, strategist, usdc } = fixture;

          // Set the claimable amount to the queued amount
          await vault.addWithdrawalQueueLiquidity();

          // Matt requests all 30 OUSD to be withdrawn which is currently 8 USDC short
          const requestAmount = ousdUnits("30");
          await vault.connect(matt).requestWithdrawal(requestAmount);

          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBeforeMint = await snapData(fixtureWithUser);
          const strategyBalanceBefore = await usdc.balanceOf(
            mockStrategy.address
          );

          // USDC in the vault = 60 - 15 = 45 USDC
          // unallocated USDC in the Vault = 45 - 23 = 22 USDC
          // Add another 8 USDC so the unallocated USDC is 22 + 8 = 30 USDC
          await vault
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

          await vault.connect(matt).claimWithdrawal(2);
        });
        it("Should claim a new request after withdrawAll from strategies adds enough liquidity", async () => {
          const { vault, daniel, matt, strategist, usdc } = fixture;

          // Set the claimable amount to the queued amount
          await vault.addWithdrawalQueueLiquidity();

          // Matt requests all 30 OUSD to be withdrawn which is currently 8 USDC short
          const requestAmount = ousdUnits("30");
          await vault.connect(matt).requestWithdrawal(requestAmount);

          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBeforeMint = await snapData(fixtureWithUser);
          const strategyBalanceBefore = await usdc.balanceOf(
            mockStrategy.address
          );

          // USDC in the vault = 60 - 15 = 45 USDC
          // unallocated USDC in the Vault = 45 - 23 = 22 USDC
          // Add another 8 USDC so the unallocated USDC is 22 + 8 = 30 USDC
          await vault.connect(strategist).withdrawAllFromStrategies();

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

          await vault.connect(matt).claimWithdrawal(2);
        });
        it("Fail to claim a new request after mint with NOT enough liquidity", async () => {
          const { vault, daniel, matt, usdc } = fixture;

          // Matt requests all 30 OUSD to be withdrawn which is not enough liquidity
          const requestAmount = ousdUnits("30");
          await vault.connect(matt).requestWithdrawal(requestAmount);

          // USDC in the vault = 60 - 15 = 45 USDC
          // unallocated USDC in the Vault = 45 - 23 = 22 USDC
          // Add another 6 USDC so the unallocated USDC is 22 + 6 = 28 USDC
          await vault.connect(daniel).mint(usdc.address, ousdUnits("6"), 0);

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          const tx = vault.connect(matt).claimWithdrawal(2);
          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
        it("Should claim a new request after mint adds enough liquidity", async () => {
          const { vault, daniel, matt, usdc } = fixture;

          // Set the claimable amount to the queued amount
          await vault.addWithdrawalQueueLiquidity();

          // Matt requests all 30 OUSD to be withdrawn which is currently 8 USDC short
          const requestAmount = ousdUnits("30");
          await vault.connect(matt).requestWithdrawal(requestAmount);

          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBeforeMint = await snapData(fixtureWithUser);

          // USDC in the vault = 60 - 15 = 45 USDC
          // unallocated USDC in the Vault = 45 - 23 = 22 USDC
          // Add another 8 USDC so the unallocated USDC is 22 + 8 = 30 USDC
          const mintAmount = ousdUnits("8");
          await vault.connect(daniel).mint(usdc.address, mintAmount, 0);

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

          await vault.connect(matt).claimWithdrawal(2);
        });
      });
    });

  });
});
