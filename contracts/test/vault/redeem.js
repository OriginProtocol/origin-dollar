const { expect } = require("chai");
const { loadDefaultFixture } = require("../_fixture");

const {
  ousdUnits,
  usdcUnits,
  isFork,
  expectApproxSupply,
  advanceTime,
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

  describe("Redeem", function () {});

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
      await usdc
        .connect(strategist)
        .approve(vault.address, usdcUnits("1000.00"));
      await vault
        .connect(strategist)
        .mint(usdc.address, usdcUnits("1000.00"), 0);
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
      await usdc
        .connect(strategist)
        .approve(vault.address, usdcUnits("3000.0"));
      await vault
        .connect(strategist)
        .mint(usdc.address, usdcUnits("3000.0"), 0);
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
      await vault
        .connect(strategist)
        .redeem(ousdUnits("50.0"), usdcUnits("50"));
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

      expect(
        (await vault.calculateRedeemOutputs(ousdUnits("100")))[0]
      ).to.equal(usdcUnits("100"));
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
    expect(await usdc.balanceOf(vault.address), "Vault USDC balance").to.equal(
      dataBefore.vaultUsdc.add(delta.vaultUsdc)
    );

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
      const { vault, governor, strategist, josh, matt, usdc } = fixture;
      await vault.connect(governor).setWithdrawalClaimDelay(delayPeriod);

      // In the fixture Matt and Josh mint 100 OUSD
      // We should redeem that first to have only the 60 OUSD from USDC minting
      // To do so, we have to make them strategists temporarily
      await vault.connect(governor).setStrategistAddr(josh.address);
      await vault.connect(josh).redeem(ousdUnits("100"), 0);
      await vault.connect(governor).setStrategistAddr(matt.address);
      await vault.connect(matt).redeem(ousdUnits("100"), 0);
      await vault.connect(governor).setStrategistAddr(strategist.address);
      // Then both send usdc to governor to keep internal balance correct
      await usdc.connect(josh).transfer(governor.address, usdcUnits("100"));
      await usdc.connect(matt).transfer(governor.address, usdcUnits("100"));
    });
    describe("with all 60 USDC in the vault", () => {
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
        await vault.connect(daniel).mint(usdc.address, usdcUnits("10"), "0");
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
          .withArgs(
            daniel.address,
            0,
            firstRequestAmountOUSD,
            firstRequestAmountUSDC
          );

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
            ousdTotalValue: firstRequestAmountOUSD
              .add(secondRequestAmountOUSD)
              .mul(-1),
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
            vaultUsdc: firstRequestAmountUSDC
              .add(secondRequestAmountUSDC)
              .mul(-1),
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

        await vault.connect(matt).requestWithdrawal(ousdUnits("30"));

        const ousdBalanceAfter = await ousd.balanceOf(matt.address);
        const totalValueAfter = await vault.totalValue();
        await expect(ousdBalanceBefore).to.equal(ousdUnits("30"));
        await expect(ousdBalanceAfter).to.equal(ousdUnits("0"));
        await expect(totalValueBefore.sub(totalValueAfter)).to.equal(
          ousdUnits("30")
        );

        const ousdTotalSupply = await ousd.totalSupply();
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        const tx = await vault.connect(matt).claimWithdrawal(0); // Claim withdrawal for 50% of the supply

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 0, ousdUnits("30"));

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

      describe("when deposit 15 USDC to a strategy, leaving 60 - 15 = 45 USDC in the vault; request withdrawal of 5 + 18 = 23 OUSD, leaving 45 - 23 = 22 USDC unallocated", () => {
        let mockStrategy;
        beforeEach(async () => {
          const { vault, usdc, governor, daniel, josh } = fixture;

          const dMockStrategy = await deployWithConfirmation("MockStrategy");
          mockStrategy = await ethers.getContractAt(
            "MockStrategy",
            dMockStrategy.address
          );
          await mockStrategy.setWithdrawAll(usdc.address, vault.address);
          await vault.connect(governor).approveStrategy(mockStrategy.address);

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
            usdcUnits("33.3"),
            "Strategy has the reserved USDC"
          );

          expect(await usdc.balanceOf(vault.address)).to.approxEqual(
            // 10% of 37 = 3.7 USDC for Vault buffer
            // + 23 reserved USDC
            usdcUnits("23").add(usdcUnits("3.7")),
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
              ousdTotalSupply: 0,
              ousdTotalValue: 0,
              vaultCheckBalance: 0,
              userOusd: 0,
              userUsdc: firstRequestAmountUSDC,
              vaultUsdc: firstRequestAmountUSDC.mul(-1),
              queued: 0,
              claimable: firstRequestAmountUSDC.add(secondRequestAmountUSDC),
              claimed: firstRequestAmountUSDC,
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
              ousdTotalSupply: 0,
              ousdTotalValue: 0,
              vaultCheckBalance: 0,
              userOusd: 0,
              userUsdc: requestAmount.div(1e12), // USDC has 6 decimals
              vaultUsdc: requestAmount.mul(-1).div(1e12),
              queued: 0,
              claimable: requestAmount.div(1e12),
              claimed: requestAmount.div(1e12),
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
          const withdrawAmount = usdcUnits("8");
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
              ousdTotalSupply: 0,
              ousdTotalValue: 0,
              vaultCheckBalance: 0,
              userOusd: 0,
              userUsdc: 0,
              vaultUsdc: withdrawAmount,
              queued: 0,
              claimable: requestAmount.div(1e12),
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
              ousdTotalSupply: 0,
              ousdTotalValue: 0,
              vaultCheckBalance: 0,
              userOusd: 0,
              userUsdc: 0,
              vaultUsdc: strategyBalanceBefore,
              queued: 0,
              claimable: requestAmount.div(1e12),
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
              ousdTotalSupply: 0,
              ousdTotalValue: 0,
              vaultCheckBalance: 0,
              userOusd: 0,
              userUsdc: 0,
              vaultUsdc: strategyBalanceBefore,
              queued: 0,
              claimable: requestAmount.div(1e12),
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
          await usdc.mintTo(daniel.address, ousdUnits("6").div(1e12));
          await usdc
            .connect(daniel)
            .approve(vault.address, ousdUnits("6").div(1e12));
          await vault.connect(daniel).mint(usdc.address, usdcUnits("6"), 0);

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
          await usdc
            .connect(daniel)
            .approve(vault.address, mintAmount.div(1e12));
          await vault
            .connect(daniel)
            .mint(usdc.address, mintAmount.div(1e12), 0);

          await assertChangedData(
            dataBeforeMint,
            {
              ousdTotalSupply: mintAmount,
              ousdTotalValue: mintAmount,
              vaultCheckBalance: mintAmount.div(1e12),
              userOusd: mintAmount,
              userUsdc: mintAmount.mul(-1).div(1e12),
              vaultUsdc: mintAmount.div(1e12),
              queued: 0,
              claimable: requestAmount.div(1e12),
              claimed: 0,
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          await vault.connect(matt).claimWithdrawal(2);
        });
      });

      describe("Fail when", () => {
        it("request doesn't have enough OUSD", async () => {
          const { vault, josh } = fixture;
          const fixtureWithUser = { ...fixture, user: josh };
          const dataBefore = await snapData(fixtureWithUser);

          const tx = vault
            .connect(josh)
            .requestWithdrawal(dataBefore.userOusd.add(1));

          await expect(tx).to.revertedWith("Transfer amount exceeds balance");
        });
        it("capital is paused", async () => {
          const { vault, governor, josh } = fixture;

          await vault.connect(governor).pauseCapital();

          const tx = vault
            .connect(josh)
            .requestWithdrawal(firstRequestAmountOUSD);

          await expect(tx).to.be.revertedWith("Capital paused");
        });
      });
    });
    describe("with 1% vault buffer, 30 USDC in the queue, 15 USDC in the vault, 85 USDC in the strategy, 5 USDC already claimed", () => {
      let mockStrategy;
      beforeEach(async () => {
        const { governor, vault, usdc, daniel, domen, josh, matt } = fixture;
        // Mint USDC to users
        await usdc.mintTo(daniel.address, usdcUnits("15"));
        await usdc.mintTo(josh.address, usdcUnits("20"));
        await usdc.mintTo(matt.address, usdcUnits("30"));
        await usdc.mintTo(domen.address, usdcUnits("40"));

        // Approve USDC to Vault
        await usdc.connect(daniel).approve(vault.address, usdcUnits("15"));
        await usdc.connect(josh).approve(vault.address, usdcUnits("20"));
        await usdc.connect(matt).approve(vault.address, usdcUnits("30"));
        await usdc.connect(domen).approve(vault.address, usdcUnits("40"));

        // Mint 105 OUSD to four users
        await vault.connect(daniel).mint(usdc.address, usdcUnits("15"), "0");
        await vault.connect(josh).mint(usdc.address, usdcUnits("20"), "0");
        await vault.connect(matt).mint(usdc.address, usdcUnits("30"), "0");
        await vault.connect(domen).mint(usdc.address, usdcUnits("40"), "0");
        await vault
          .connect(await impersonateAndFund(await vault.governor()))
          .setMaxSupplyDiff(ousdUnits("0.03"));

        // Request and claim 2 + 3 = 5 USDC from Vault
        await vault.connect(daniel).requestWithdrawal(ousdUnits("2"));
        await vault.connect(josh).requestWithdrawal(ousdUnits("3"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        await vault.connect(daniel).claimWithdrawal(0);
        await vault.connect(josh).claimWithdrawal(1);

        // Deploy a mock strategy
        mockStrategy = await deployWithConfirmation("MockStrategy");
        await vault.connect(governor).approveStrategy(mockStrategy.address);

        // Deposit 85 USDC to strategy
        await vault
          .connect(governor)
          .depositToStrategy(
            mockStrategy.address,
            [usdc.address],
            [usdcUnits("85")]
          );

        // Set vault buffer to 1%
        await vault.connect(governor).setVaultBuffer(ousdUnits("0.01"));

        // Have 4 + 12 + 16 = 32 USDC outstanding requests
        // So a total supply of 100 - 32 = 68 OUSD
        await vault.connect(daniel).requestWithdrawal(ousdUnits("4"));
        await vault.connect(josh).requestWithdrawal(ousdUnits("12"));
        await vault.connect(matt).requestWithdrawal(ousdUnits("16"));

        await vault.connect(josh).addWithdrawalQueueLiquidity();
      });
      describe("Fail to claim", () => {
        it("a previously claimed withdrawal", async () => {
          const { vault, daniel } = fixture;

          const tx = vault.connect(daniel).claimWithdrawal(0);

          await expect(tx).to.be.revertedWith("Already claimed");
        });
        it("the first withdrawal with wrong withdrawer", async () => {
          const { vault, matt } = fixture;

          // Advance in time to ensure time delay between request and claim.
          await advanceTime(delayPeriod);

          const tx = vault.connect(matt).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Not requester");
        });
        it("the first withdrawal request in the queue before 30 minutes", async () => {
          const { vault, daniel } = fixture;

          const tx = vault.connect(daniel).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Claim delay not met");
        });
      });
      describe("when waited 30 minutes", () => {
        beforeEach(async () => {
          // Advance in time to ensure time delay between request and claim.
          await advanceTime(delayPeriod);
        });
        it("Fail to claim the first withdrawal with wrong withdrawer", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Not requester");
        });
        it("Should claim the first withdrawal request in the queue after 30 minutes", async () => {
          const { vault, daniel } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          const tx = await vault.connect(daniel).claimWithdrawal(2);

          await expect(tx)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(daniel.address, 2, ousdUnits("4"));

          await assertChangedData(
            dataBefore,
            {
              ousdTotalSupply: 0,
              ousdTotalValue: 0,
              vaultCheckBalance: 0,
              userOusd: 0,
              userUsdc: usdcUnits("4"),
              vaultUsdc: usdcUnits("4").mul(-1),
              queued: 0,
              claimable: 0,
              claimed: usdcUnits("4"),
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );
        });
        it("Fail to claim the second withdrawal request in the queue after 30 minutes", async () => {
          const { vault, josh } = fixture;

          const tx = vault.connect(josh).claimWithdrawal(3);

          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
        it("Fail to claim the last (3rd) withdrawal request in the queue", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).claimWithdrawal(4);

          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
      });
      describe("when mint covers exactly outstanding requests (32 - 15 = 17 OUSD)", () => {
        beforeEach(async () => {
          const { vault, daniel, usdc } = fixture;
          await usdc.mintTo(daniel.address, usdcUnits("17"));
          await usdc.connect(daniel).approve(vault.address, usdcUnits("17"));
          await vault.connect(daniel).mint(usdc.address, usdcUnits("17"), "0");

          // Advance in time to ensure time delay between request and claim.
          await advanceTime(delayPeriod);
        });
        it("Should claim the 2nd and 3rd withdrawal requests in the queue", async () => {
          const { vault, daniel, josh } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          const tx1 = await vault.connect(daniel).claimWithdrawal(2);

          await expect(tx1)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(daniel.address, 2, ousdUnits("4"));

          const tx2 = await vault.connect(josh).claimWithdrawal(3);

          await expect(tx2)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(josh.address, 3, ousdUnits("12"));

          await assertChangedData(
            dataBefore,
            {
              ousdTotalSupply: 0,
              ousdTotalValue: 0,
              vaultCheckBalance: 0,
              userOusd: 0,
              userUsdc: usdcUnits("4"),
              vaultUsdc: usdcUnits("16").mul(-1),
              queued: 0,
              claimable: 0,
              claimed: usdcUnits("16"),
              nextWithdrawalIndex: 0,
            },
            fixtureWithUser
          );
        });
        it("Fail to deposit 1 USDC to a strategy", async () => {
          const { vault, usdc, governor } = fixture;

          const tx = vault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [usdc.address],
              [usdcUnits("1")]
            );

          await expect(tx).to.be.revertedWith(
            "Not enough backing asset available"
          );
        });
        it("Fail to allocate any USDC to the default strategy", async () => {
          const { vault, domen } = fixture;

          const tx = await vault.connect(domen).allocate();

          await expect(tx).to.not.emit(vault, "AssetAllocated");
        });
      });
      describe("when mint covers exactly outstanding requests and vault buffer (17 + 1 USDC)", () => {
        beforeEach(async () => {
          const { vault, daniel, usdc } = fixture;
          await usdc.mintTo(daniel.address, usdcUnits("18"));
          await usdc.connect(daniel).approve(vault.address, usdcUnits("18"));
          await vault.connect(daniel).mint(usdc.address, usdcUnits("18"), "0");
        });
        it("Should deposit 1 USDC to a strategy which is the vault buffer", async () => {
          const { vault, usdc, governor } = fixture;

          const tx = await vault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [usdc.address],
              [usdcUnits("1")]
            );

          expect(tx)
            .to.emit(usdc, "Transfer")
            .withArgs(vault.address, mockStrategy.address, usdcUnits("1"));
        });
        it("Fail to deposit 1.1 USDC to the default strategy", async () => {
          const { vault, usdc, governor } = fixture;

          const tx = vault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [usdc.address],
              [usdcUnits("1.1")]
            );

          await expect(tx).to.be.revertedWith(
            "Not enough backing asset available"
          );
        });
        it("Fail to allocate any USDC to the default strategy", async () => {
          const { vault, domen } = fixture;

          const tx = await vault.connect(domen).allocate();

          await expect(tx).to.not.emit(vault, "AssetAllocated");
        });
      });
      describe("when mint more than covers outstanding requests and vault buffer (17 + 1 + 3 = 21 OUSD)", () => {
        beforeEach(async () => {
          const { vault, daniel, usdc } = fixture;
          await usdc.mintTo(daniel.address, usdcUnits("21"));
          await usdc.connect(daniel).approve(vault.address, usdcUnits("21"));
          await vault.connect(daniel).mint(usdc.address, usdcUnits("21"), "0");
        });
        it("Should deposit 4 USDC to a strategy", async () => {
          const { vault, usdc, governor } = fixture;

          const tx = await vault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [usdc.address],
              [usdcUnits("4")]
            );

          expect(tx)
            .to.emit(usdc, "Transfer")
            .withArgs(vault.address, mockStrategy.address, usdcUnits("4"));
        });
        it("Fail to deposit 5 USDC to the default strategy", async () => {
          const { vault, usdc, governor } = fixture;

          const tx = vault
            .connect(governor)
            .depositToStrategy(
              mockStrategy.address,
              [usdc.address],
              [usdcUnits("5")]
            );

          await expect(tx).to.be.revertedWith(
            "Not enough backing asset available"
          );
        });
        it("Should allocate 3 USDC to the default strategy", async () => {
          const { vault, governor, domen, usdc } = fixture;

          await vault
            .connect(governor)
            .setDefaultStrategy(mockStrategy.address);

          const vaultBalance = await usdc.balanceOf(vault.address);
          const stratBalance = await usdc.balanceOf(mockStrategy.address);

          const tx = await vault.connect(domen).allocate();

          // total supply is 68 starting + 21 minted = 89 OUSD
          // Vault buffer is 1% of 89 = 0.89 USDC
          // USDC transfer amount = 4 USDC available in vault - 0.89 USDC buffer = 3.11 USDC
          await expect(tx)
            .to.emit(vault, "AssetAllocated")
            .withArgs(usdc.address, mockStrategy.address, usdcUnits("3.11"));

          expect(await usdc.balanceOf(vault.address)).to.eq(
            vaultBalance.sub(usdcUnits("3.11"))
          );

          expect(await usdc.balanceOf(mockStrategy.address)).to.eq(
            stratBalance.add(usdcUnits("3.11"))
          );
        });
      });
    });
    describe("with 40 USDC in the queue, 10 USDC in the vault, 30 USDC already claimed", () => {
      beforeEach(async () => {
        const { vault, usdc, daniel, josh, matt } = fixture;

        // Mint USDC to users
        await usdc.mintTo(daniel.address, usdcUnits("10"));
        await usdc.mintTo(josh.address, usdcUnits("20"));
        await usdc.mintTo(matt.address, usdcUnits("10"));

        // Approve USDC to Vault
        await usdc.connect(daniel).approve(vault.address, usdcUnits("10"));
        await usdc.connect(josh).approve(vault.address, usdcUnits("20"));
        await usdc.connect(matt).approve(vault.address, usdcUnits("10"));

        // Mint 60 OUSD to three users
        await vault.connect(daniel).mint(usdc.address, usdcUnits("10"), "0");
        await vault.connect(josh).mint(usdc.address, usdcUnits("20"), "0");
        await vault.connect(matt).mint(usdc.address, usdcUnits("10"), "0");

        // Request and claim 10 USDC from Vault
        await vault.connect(daniel).requestWithdrawal(ousdUnits("10"));
        await vault.connect(josh).requestWithdrawal(ousdUnits("20"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Claim 10 + 20 = 30 USDC from Vault
        await vault.connect(daniel).claimWithdrawal(0);
        await vault.connect(josh).claimWithdrawal(1);
      });
      it("Should allow the last user to request the remaining 10 USDC", async () => {
        const { vault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(matt).requestWithdrawal(ousdUnits("10"));

        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(matt.address, 2, ousdUnits("10"), usdcUnits("40"));

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: ousdUnits("10").mul(-1),
            ousdTotalValue: ousdUnits("10").mul(-1),
            vaultCheckBalance: usdcUnits("10").mul(-1),
            userOusd: ousdUnits("10").mul(-1),
            userUsdc: 0,
            vaultUsdc: 0,
            queued: usdcUnits("10").mul(1),
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      it("Should allow the last user to claim the request of 10 USDC", async () => {
        const { vault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        await vault.connect(matt).requestWithdrawal(ousdUnits("10"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(matt).claimWithdrawal(2);

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 2, ousdUnits("10"));

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: 0,
            ousdTotalValue: 0,
            vaultCheckBalance: 0,
            userOusd: 0,
            userUsdc: usdcUnits("10"),
            vaultUsdc: usdcUnits("10").mul(-1),
            queued: 0,
            claimable: usdcUnits("10"),
            claimed: usdcUnits("10"),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );

        expect(await vault.totalValue()).to.equal(0);
      });
    });
    describe("with 40 USDC in the queue, 100 USDC in the vault, 0 USDC in the strategy", () => {
      beforeEach(async () => {
        const { vault, usdc, daniel, josh, matt } = fixture;

        // Mint USDC to users
        await usdc.mintTo(daniel.address, usdcUnits("10"));
        await usdc.mintTo(josh.address, usdcUnits("20"));
        await usdc.mintTo(matt.address, usdcUnits("70"));

        // Approve USDC to Vault
        await usdc.connect(daniel).approve(vault.address, usdcUnits("10"));
        await usdc.connect(josh).approve(vault.address, usdcUnits("20"));
        await usdc.connect(matt).approve(vault.address, usdcUnits("70"));

        // Mint 100 OUSD to three users
        await vault.connect(daniel).mint(usdc.address, usdcUnits("10"), "0");
        await vault.connect(josh).mint(usdc.address, usdcUnits("20"), "0");
        await vault.connect(matt).mint(usdc.address, usdcUnits("70"), "0");

        // Request 40 USDC from Vault
        await vault.connect(matt).requestWithdrawal(ousdUnits("40"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
      });
      it("Should allow user to claim the request of 40 USDC", async () => {
        const { vault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(matt).claimWithdrawal(0);

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 0, ousdUnits("40"));

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: 0,
            ousdTotalValue: 0,
            vaultCheckBalance: 0,
            userOusd: 0,
            userUsdc: usdcUnits("40"),
            vaultUsdc: usdcUnits("40").mul(-1),
            queued: 0,
            claimable: usdcUnits("40"),
            claimed: usdcUnits("40"),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Should allow user to perform a new request and claim a smaller than the USDC available", async () => {
        const { vault, josh } = fixture;

        await vault.connect(josh).requestWithdrawal(ousdUnits("20"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = await vault.connect(josh).claimWithdrawal(1);

        await expect(tx).to.emit(vault, "WithdrawalClaimed");
      });
      it("Should allow user to perform a new request and claim exactly the USDC available", async () => {
        const { vault, ousd, josh, matt, daniel } = fixture;
        await vault.connect(matt).claimWithdrawal(0);
        // All user give OUSD to another user
        await ousd.connect(josh).transfer(matt.address, ousdUnits("20"));
        await ousd.connect(daniel).transfer(matt.address, ousdUnits("10"));

        const fixtureWithUser = { ...fixture, user: matt };

        // Matt request the remaining 60 OUSD to be withdrawn
        await vault.connect(matt).requestWithdrawal(ousdUnits("60"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(matt).claimWithdrawal(1);

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 1, ousdUnits("60"));

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: 0,
            ousdTotalValue: 0,
            vaultCheckBalance: 0,
            userOusd: 0,
            userUsdc: usdcUnits("60"),
            vaultUsdc: usdcUnits("60").mul(-1),
            queued: 0,
            claimable: usdcUnits("60"),
            claimed: usdcUnits("60"),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Shouldn't allow user to perform a new request and claim more than the USDC available", async () => {
        const { vault, ousd, usdc, josh, matt, daniel, governor } = fixture;
        await vault.connect(matt).claimWithdrawal(0);
        // All user give OUSD to another user
        await ousd.connect(josh).transfer(matt.address, ousdUnits("20"));
        await ousd.connect(daniel).transfer(matt.address, ousdUnits("10"));

        // Matt request more than the remaining 60 OUSD to be withdrawn
        await vault.connect(matt).requestWithdrawal(ousdUnits("60"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        await usdc
          .connect(await impersonateAndFund(vault.address))
          .transfer(governor.address, usdcUnits("50")); // Vault loses 50 USDC

        const tx = vault.connect(matt).claimWithdrawal(1);
        await expect(tx).to.be.revertedWith("Queue pending liquidity");
      });
    });
    describe("with 40 USDC in the queue, 15 USDC in the vault, 44 USDC in the strategy, vault insolvent by 5% => Slash 1 ether (1/20 = 5%), 19 USDC total value", () => {
      beforeEach(async () => {
        const { governor, vault, usdc, daniel, josh, matt, strategist } =
          fixture;
        // Deploy a mock strategy
        const mockStrategy = await deployWithConfirmation("MockStrategy");
        await vault.connect(governor).approveStrategy(mockStrategy.address);
        await vault.connect(governor).setDefaultStrategy(mockStrategy.address);

        // Mint USDC to users
        await usdc.mintTo(daniel.address, usdcUnits("10"));
        await usdc.mintTo(josh.address, usdcUnits("20"));
        await usdc.mintTo(matt.address, usdcUnits("30"));

        // Approve USDC to Vault
        await usdc.connect(daniel).approve(vault.address, usdcUnits("10"));
        await usdc.connect(josh).approve(vault.address, usdcUnits("20"));
        await usdc.connect(matt).approve(vault.address, usdcUnits("30"));

        // Mint 60 OUSD to three users
        await vault.connect(daniel).mint(usdc.address, usdcUnits("10"), "0");
        await vault.connect(josh).mint(usdc.address, usdcUnits("20"), "0");
        await vault.connect(matt).mint(usdc.address, usdcUnits("30"), "0");

        await vault.allocate();
        // Request and claim 10 + 20 + 10 = 40 USDC from Vault
        await vault.connect(daniel).requestWithdrawal(ousdUnits("10"));
        await vault.connect(josh).requestWithdrawal(ousdUnits("20"));
        await vault.connect(matt).requestWithdrawal(ousdUnits("10"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Simulate slash event of 1 ethers
        await usdc
          .connect(await impersonateAndFund(mockStrategy.address))
          .transfer(governor.address, usdcUnits("1"));

        // Strategist sends 15 USDC to the vault
        await vault
          .connect(strategist)
          .withdrawFromStrategy(
            mockStrategy.address,
            [usdc.address],
            [usdcUnits("15")]
          );

        await vault.connect(josh).addWithdrawalQueueLiquidity();
      });
      it("Should allow first user to claim the request of 10 USDC", async () => {
        const { vault, daniel } = fixture;
        const fixtureWithUser = { ...fixture, user: daniel };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(daniel).claimWithdrawal(0);

        expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(daniel.address, 0, ousdUnits("10"));

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: 0,
            ousdTotalValue: 0,
            vaultCheckBalance: 0,
            userOusd: 0,
            userUsdc: usdcUnits("10"),
            vaultUsdc: usdcUnits("10").mul(-1),
            queued: 0,
            claimable: 0,
            claimed: usdcUnits("10"),
            nextWithdrawalIndex: 0,
          },
          fixtureWithUser
        );
      });
      it("Fail to allow second user to claim the request of 20 USDC, due to liquidity", async () => {
        const { vault, josh } = fixture;

        const tx = vault.connect(josh).claimWithdrawal(1);

        await expect(tx).to.be.revertedWith("Queue pending liquidity");
      });
      it("Should allow a user to create a new request with solvency check off", async () => {
        // maxSupplyDiff is set to 0 so no insolvency check
        const { vault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = vault.connect(matt).requestWithdrawal(ousdUnits("10"));

        expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(matt.address, 3, ousdUnits("10"), ousdUnits("50"));

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: ousdUnits("10").mul(-1),
            ousdTotalValue: ousdUnits("10").mul(-1),
            vaultCheckBalance: usdcUnits("10").mul(-1),
            userOusd: ousdUnits("10").mul(-1),
            userUsdc: 0,
            vaultUsdc: 0,
            queued: usdcUnits("10").mul(1),
            claimable: 0,
            claimed: 0,
            nextWithdrawalIndex: 1,
          },
          fixtureWithUser
        );
      });
      describe("with solvency check at 3%", () => {
        beforeEach(async () => {
          const { vault } = fixture;
          // Turn on insolvency check with 3% buffer
          await vault
            .connect(await impersonateAndFund(await vault.governor()))
            .setMaxSupplyDiff(ousdUnits("0.03"));
        });
        it("Fail to allow user to create a new request due to insolvency check", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).requestWithdrawal(ousdUnits("1"));

          await expect(tx).to.be.revertedWith("Backing supply liquidity error");
        });
        it("Fail to allow first user to claim a withdrawal due to insolvency check", async () => {
          const { vault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = vault.connect(daniel).claimWithdrawal(0);

          await expect(tx).to.be.revertedWith("Backing supply liquidity error");
        });
      });
      describe("with solvency check at 10%", () => {
        beforeEach(async () => {
          const { vault } = fixture;
          // Turn on insolvency check with 10% buffer
          await vault
            .connect(await impersonateAndFund(await vault.governor()))
            .setMaxSupplyDiff(ousdUnits("0.1"));
        });
        it("Should allow user to create a new request", async () => {
          const { vault, matt } = fixture;

          const tx = await vault
            .connect(matt)
            .requestWithdrawal(ousdUnits("1"));

          expect(tx)
            .to.emit(vault, "WithdrawalRequested")
            .withArgs(matt.address, 3, ousdUnits("1"), ousdUnits("41"));
        });
        it("Should allow first user to claim the request of 10 USDC", async () => {
          const { vault, daniel } = fixture;

          const tx = await vault.connect(daniel).claimWithdrawal(0);

          expect(tx)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(daniel.address, 0, ousdUnits("10"));
        });
      });
    });
    describe("with 99 USDC in the queue, 40 USDC in the vault, total supply 1, 1% insolvency buffer", () => {
      let mockStrategy;
      beforeEach(async () => {
        const { governor, vault, usdc, daniel, josh, matt, strategist } =
          fixture;
        // Deploy a mock strategy
        mockStrategy = await deployWithConfirmation("MockStrategy");
        await vault.connect(governor).approveStrategy(mockStrategy.address);
        await vault.connect(governor).setDefaultStrategy(mockStrategy.address);

        // Mint USDC to users
        await usdc.mintTo(daniel.address, usdcUnits("20"));
        await usdc.mintTo(josh.address, usdcUnits("30"));
        await usdc.mintTo(matt.address, usdcUnits("50"));

        // Approve USDC to Vault
        await usdc.connect(daniel).approve(vault.address, usdcUnits("20"));
        await usdc.connect(josh).approve(vault.address, usdcUnits("30"));
        await usdc.connect(matt).approve(vault.address, usdcUnits("50"));

        // Mint 100 OUSD to three users
        await vault.connect(daniel).mint(usdc.address, usdcUnits("20"), "0");
        await vault.connect(josh).mint(usdc.address, usdcUnits("30"), "0");
        await vault.connect(matt).mint(usdc.address, usdcUnits("50"), "0");

        await vault.allocate();

        // Request and claim 20 + 30 + 49 = 99 USDC from Vault
        await vault.connect(daniel).requestWithdrawal(ousdUnits("20"));
        await vault.connect(josh).requestWithdrawal(ousdUnits("30"));
        await vault.connect(matt).requestWithdrawal(ousdUnits("49"));

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Strategist sends 40 USDC to the vault
        await vault
          .connect(strategist)
          .withdrawFromStrategy(
            mockStrategy.address,
            [usdc.address],
            [usdcUnits("40")]
          );

        await vault.connect(josh).addWithdrawalQueueLiquidity();

        // Turn on insolvency check with 10% buffer
        await vault
          .connect(await impersonateAndFund(await vault.governor()))
          .setMaxSupplyDiff(ousdUnits("0.01"));
      });
      describe("with 2 ether slashed leaving 100 - 40 - 2 = 58 USDC in the strategy", () => {
        beforeEach(async () => {
          const { usdc, governor } = fixture;

          // Simulate slash event of 2 ethers
          await usdc
            .connect(await impersonateAndFund(mockStrategy.address))
            .transfer(governor.address, usdcUnits("2"));
        });
        it("Should have total value of zero", async () => {
          // 100 from mints - 99 outstanding withdrawals - 2 from slashing = -1 value which is rounder up to zero
          expect(await fixture.vault.totalValue()).to.equal(0);
        });
        it("Should have check balance of zero", async () => {
          const { vault, usdc } = fixture;
          // 100 from mints - 99 outstanding withdrawals - 2 from slashing = -1 value which is rounder up to zero
          expect(await vault.checkBalance(usdc.address)).to.equal(0);
        });
        it("Fail to allow user to create a new request due to too many outstanding requests", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).requestWithdrawal(ousdUnits("1"));

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });
        it("Fail to allow first user to claim a withdrawal due to too many outstanding requests", async () => {
          const { vault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = vault.connect(daniel).claimWithdrawal(0);

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });
      });
      describe("with 1 ether slashed leaving 100 - 40 - 1 = 59 USDC in the strategy", () => {
        beforeEach(async () => {
          const { usdc, governor } = fixture;

          // Simulate slash event of 1 ethers
          await usdc
            .connect(await impersonateAndFund(mockStrategy.address))
            .transfer(governor.address, usdcUnits("1"));
        });
        it("Should have total value of zero", async () => {
          // 100 from mints - 99 outstanding withdrawals - 1 from slashing = 0 value
          expect(await fixture.vault.totalValue()).to.equal(0);
        });
        it("Fail to allow user to create a new request due to too many outstanding requests", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).requestWithdrawal(ousdUnits("1"));

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });
        it("Fail to allow first user to claim a withdrawal due to too many outstanding requests", async () => {
          const { vault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = vault.connect(daniel).claimWithdrawal(0);

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });
      });
      describe("with 0.02 ether slashed leaving 100 - 40 - 0.02 = 59.98 USDC in the strategy", () => {
        beforeEach(async () => {
          const { usdc, governor } = fixture;

          // Simulate slash event of 0.001 ethers
          await usdc
            .connect(await impersonateAndFund(mockStrategy.address))
            .transfer(governor.address, usdcUnits("0.02"));
        });
        it("Should have total value of zero", async () => {
          // 100 from mints - 99 outstanding withdrawals - 0.001 from slashing = 0.999 total value
          expect(await fixture.vault.totalValue()).to.equal(ousdUnits("0.98"));
        });
        it("Fail to allow user to create a new 1 USDC request due to too many outstanding requests", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).requestWithdrawal(ousdUnits("1"));

          await expect(tx).to.be.revertedWith("Too many outstanding requests");
        });

        it("Fail to allow user to create a new 0.01 USDC request due to insolvency check", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).requestWithdrawal(ousdUnits("0.01"));

          await expect(tx).to.be.revertedWith("Backing supply liquidity error");
        });
        it("Fail to allow first user to claim a withdrawal due to insolvency check", async () => {
          const { vault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = vault.connect(daniel).claimWithdrawal(0);

          // diff = 1 total supply / 0.98 assets = 1.020408163265306122 which is > 1 maxSupplyDiff
          await expect(tx).to.be.revertedWith("Backing supply liquidity error");
        });
      });
    });
  });
});
