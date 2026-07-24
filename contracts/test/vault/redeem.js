const { expect } = require("chai");
const { loadDefaultFixture } = require("../_fixture");

const { ousdUnits, usdcUnits, isFork, advanceTime } = require("../helpers");
const { impersonateAndFund } = require("../../utils/signers");
const { deployWithConfirmation } = require("../../utils/deploy");

describe("OUSD Vault Withdrawals", function () {
  if (isFork) {
    this.timeout(0);
  }

  let fixture;
  beforeEach(async () => {
    fixture = await loadDefaultFixture();
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
      const { vault, josh, matt } = fixture;

      // In the fixture Matt and Josh mint 100 OUSD
      // We should redeem that first to have only the 60 OUSD from USDC minting
      await vault.connect(josh).requestWithdrawal(ousdUnits("100"));
      await vault.connect(matt).requestWithdrawal(ousdUnits("100"));

      await advanceTime(delayPeriod); // 10 minutes

      await vault.connect(josh).claimWithdrawal(0);
      await vault.connect(matt).claimWithdrawal(1);
    });

    // 6-decimal mirror of the OETH FIFO-gate drain test. The claimable frontier
    // is in nominal units but funded out of real assets, so it must be scaled by
    // the backing ratio; otherwise it can never reach `queued` and the tail of
    // the queue is stranded forever.
    describe("Loss socialization: FIFO gate drains a fully-queued vault", () => {
      let mockStrategy;

      beforeEach(async () => {
        const { governor, vault, usdc, daniel, josh, matt } = fixture;

        // Widen the circuit breaker so the 10% loss stays inside the band
        await vault.connect(governor).setMaxSupplyDiff(ousdUnits("0.2"));

        mockStrategy = await deployWithConfirmation("MockStrategy");
        await vault.connect(governor).approveStrategy(mockStrategy.address);
        await vault.connect(governor).setDefaultStrategy(mockStrategy.address);

        // 3 users mint 10 OUSD each, then all 30 USDC is moved to the strategy
        // so the vault holds nothing and the frontier cannot be granted early.
        for (const user of [daniel, josh, matt]) {
          await usdc.mintTo(user.address, usdcUnits("10"));
          await usdc.connect(user).approve(vault.address, usdcUnits("10"));
          await vault.connect(user).mint(usdcUnits("10"));
        }
        await vault.connect(governor).allocate();
        expect(await usdc.balanceOf(vault.address)).to.equal(0);

        // The entire protocol queues up: live OUSD supply drops back to 0
        await vault.connect(daniel).requestWithdrawal(ousdUnits("10"));
        await vault.connect(josh).requestWithdrawal(ousdUnits("10"));
        await vault.connect(matt).requestWithdrawal(ousdUnits("10"));
        await advanceTime(delayPeriod);

        // Slash 3 of the 30 USDC => gross 27 / effectiveSupply 30 = 0.9 ratio
        await usdc
          .connect(await impersonateAndFund(mockStrategy.address))
          .transfer(governor.address, usdcUnits("3"));

        // Strategist brings the remaining 27 USDC back to fund the queue
        await vault
          .connect(fixture.strategist)
          .withdrawFromStrategy(
            mockStrategy.address,
            [usdc.address],
            [usdcUnits("27")]
          );
        await vault.connect(josh).addWithdrawalQueueLiquidity();
      });

      it("Should have a 0.9 backing ratio with the whole supply queued", async () => {
        const { vault, ousd } = fixture;
        expect(await ousd.totalSupply()).to.equal(0);
        expect(await vault.grossAssets()).to.equal(ousdUnits("27"));
        expect(await vault.effectiveSupply()).to.equal(ousdUnits("30"));
        expect(await vault.backingRatio()).to.equal(ousdUnits("0.9"));
      });

      it("Should let all three users claim their haircut and drain the vault", async () => {
        const { vault, usdc, daniel, josh, matt } = fixture;
        const payout = usdcUnits("9"); // 10 nominal * 0.9 ratio, exact at 6 dp

        for (const [requestId, user] of [
          [2, daniel],
          [3, josh],
          [4, matt],
        ]) {
          const before = await usdc.balanceOf(user.address);

          await vault.connect(user).claimWithdrawal(requestId);

          expect(
            await usdc.balanceOf(user.address),
            `user ${requestId} USDC`
          ).to.equal(before.add(payout));

          // Paying ratio * nominal and removing nominal from the effective
          // supply leaves the ratio unchanged. Once the last request settles
          // there is nothing left to back and the ratio is vacuously 1e18.
          if ((await vault.effectiveSupply()).gt(0)) {
            expect(
              await vault.backingRatio(),
              `ratio after claim ${requestId}`
            ).to.equal(ousdUnits("0.9"));
          }
        }

        // The queue settled in full and the vault is drained to the wei
        const queue = await vault.withdrawalQueueMetadata();
        expect(queue.claimed).to.equal(queue.queued);
        expect(await usdc.balanceOf(vault.address)).to.equal(0);
        expect(await vault.grossAssets()).to.equal(0);
      });
    });

    // A 6-decimal vault records `queued`/`claimed` floored to 1e-6, but a request's
    // 18-decimal `amount` can carry dust below that. The payout has to be haircut off
    // the same asset-decimal nominal the queue retires; haircutting the raw 18-dec
    // amount pays out more than is removed from effective supply, and the backing
    // ratio drifts DOWN. Cannot happen on an 18-decimal vault (WETH), where there is
    // no sub-asset precision to lose.
    describe("Loss socialization: request carrying sub-precision dust", () => {
      let mockStrategy;
      // The 0.0000008 tail is below USDC's 1e-6 precision, so `queued` only ever
      // records 10.000000 of it.
      const requestAmount = ousdUnits("10").add(ousdUnits("0.0000008"));

      beforeEach(async () => {
        const { governor, vault, usdc, daniel, josh, matt } = fixture;

        await vault.connect(governor).setMaxSupplyDiff(ousdUnits("0.2"));

        mockStrategy = await deployWithConfirmation("MockStrategy");
        await vault.connect(governor).approveStrategy(mockStrategy.address);
        await vault.connect(governor).setDefaultStrategy(mockStrategy.address);

        // 3 users mint 20 OUSD each; all 60 USDC moves to the strategy
        for (const user of [daniel, josh, matt]) {
          await usdc.mintTo(user.address, usdcUnits("20"));
          await usdc.connect(user).approve(vault.address, usdcUnits("20"));
          await vault.connect(user).mint(usdcUnits("20"));
        }
        await vault.connect(governor).allocate();

        await vault.connect(daniel).requestWithdrawal(requestAmount);
        await advanceTime(delayPeriod);

        // Slash 1 of the 60 USDC so the vault is impaired and a haircut applies
        await usdc
          .connect(await impersonateAndFund(mockStrategy.address))
          .transfer(governor.address, usdcUnits("1"));

        // Strategist funds the queue
        await vault
          .connect(fixture.strategist)
          .withdrawFromStrategy(
            mockStrategy.address,
            [usdc.address],
            [usdcUnits("15")]
          );
        await vault.connect(josh).addWithdrawalQueueLiquidity();
      });

      it("Should record only the 6-decimal nominal in the queue", async () => {
        const { vault } = fixture;
        const queue = await vault.withdrawalQueueMetadata();
        // Outstanding obligation is exactly 10.000000, not 10.0000008: the dust
        // never made it into the queue, it was burned at request time.
        expect(queue.queued.sub(queue.claimed)).to.equal(usdcUnits("10"));
      });

      it("Should not let a dust-carrying claim reduce the backing ratio", async () => {
        const { vault, usdc, daniel } = fixture;

        const ratioBefore = await vault.backingRatio();
        // Impaired, so a haircut actually applies
        expect(ratioBefore).to.be.lt(ousdUnits("1"));

        // The queue only ever retired the 6-dp nominal, so that is what gets haircut
        const nominalAsset = usdcUnits("10");
        const expectedPayout = nominalAsset
          .mul(ratioBefore)
          .div(ousdUnits("1"));

        const before = await usdc.balanceOf(daniel.address);
        await vault.connect(daniel).claimWithdrawal(2);

        // The invariant: paying on the same nominal the queue retires means the
        // ratio can never drift down, however much dust the request carried.
        expect(await vault.backingRatio()).to.be.gte(ratioBefore);

        expect(await usdc.balanceOf(daniel.address)).to.equal(
          before.add(expectedPayout)
        );
      });
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
        await vault.connect(daniel).mint(usdcUnits("10"));
        await vault.connect(josh).mint(usdcUnits("20"));
        await vault.connect(matt).mint(usdcUnits("30"));

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

        const queuedAmount = usdcUnits("205"); // 100 + 100 + 5

        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(daniel.address, 2, firstRequestAmountOUSD, queuedAmount);

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
      it("Should revert withdrawal of zero amount", async () => {
        const { vault, josh } = fixture;
        const tx = vault.connect(josh).requestWithdrawal(0);
        await expect(tx).to.be.revertedWith("Amount must be greater than 0");
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

        const queuedAmount = usdcUnits("223"); // 100 + 100 + 5 + 18

        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(matt.address, 3, secondRequestAmountOUSD, queuedAmount);

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

        const queuedAmount = usdcUnits("223"); // 100 + 100 + 5 + 18

        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(matt.address, 3, secondRequestAmountOUSD, queuedAmount);

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

        const claimableAmount = usdcUnits("223"); // 100 + 100 + 5 + 18

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimable")
          .withArgs(
            claimableAmount,
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
        const requestId = 3; // ids start at 0 so the fourth request is at index 3. Two in set setup and two here.
        const dataBefore = await snapData(fixtureWithUser);

        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const tx = await vault.connect(josh).claimWithdrawal(requestId);

        const claimableAmount = usdcUnits("223"); // 100 + 100 + 5 + 18

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(
            josh.address,
            requestId,
            secondRequestAmountOUSD,
            secondRequestAmountUSDC
          );
        await expect(tx)
          .to.emit(vault, "WithdrawalClaimable")
          .withArgs(
            claimableAmount,
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

        const tx = await vault.connect(matt).claimWithdrawals([2, 3]);

        const claimableAmount = usdcUnits("223"); // 100 + 100 + 5 + 18

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(
            matt.address,
            2,
            firstRequestAmountOUSD,
            firstRequestAmountUSDC
          );
        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(
            matt.address,
            3,
            secondRequestAmountOUSD,
            secondRequestAmountUSDC
          );
        await expect(tx)
          .to.emit(vault, "WithdrawalClaimable")
          .withArgs(
            claimableAmount,
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
        const tx = await vault.connect(matt).claimWithdrawal(2); // Claim withdrawal for 50% of the supply

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 2, ousdUnits("30"), usdcUnits("30"));

        await expect(ousdTotalSupply).to.equal(await ousd.totalSupply());
        await expect(totalValueAfter).to.equal(await vault.totalValue());
      });

      // Negative tests
      it("Fail to claim request because of not enough time passed", async () => {
        const { vault, daniel } = fixture;

        // Daniel requests 5 OUSD to be withdrawn
        await vault.connect(daniel).requestWithdrawal(firstRequestAmountOUSD);
        const requestId = 2;

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

        await expect(tx).to.revertedWith("Backing ratio out of range");
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
        const tx = vault.connect(daniel).claimWithdrawal(2);

        await expect(tx).to.revertedWith("Backing ratio out of range");
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
        const tx = vault.connect(matt).claimWithdrawals([2, 3]);

        await expect(tx).to.revertedWith("Backing ratio out of range");
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

        await expect(tx).to.revertedWith("Backing ratio out of range");
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
          await expect(tx).to.be.revertedWith("Not enough assets available");
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

          const requestId = 2;
          const tx = await vault.connect(daniel).claimWithdrawal(requestId);

          await expect(tx)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(
              daniel.address,
              requestId,
              firstRequestAmountOUSD,
              firstRequestAmountUSDC
            );

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

          const requestId = 4;
          const tx = await vault.connect(matt).claimWithdrawal(requestId);

          await expect(tx)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(matt.address, requestId, requestAmount, usdcUnits("22"));

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

          const tx = vault.connect(matt).claimWithdrawal(4);
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

          await vault.connect(matt).claimWithdrawal(4);
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

          await vault.connect(matt).claimWithdrawal(4);
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

          await vault.connect(matt).claimWithdrawal(4);
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
          await vault.connect(daniel).mint(usdcUnits("6"));

          await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

          const tx = vault.connect(matt).claimWithdrawal(4);
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
          await vault.connect(daniel).mint(mintAmount.div(1e12));

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

          await vault.connect(matt).claimWithdrawal(4);
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
        await vault.connect(daniel).mint(usdcUnits("15"));
        await vault.connect(josh).mint(usdcUnits("20"));
        await vault.connect(matt).mint(usdcUnits("30"));
        await vault.connect(domen).mint(usdcUnits("40"));
        await vault
          .connect(await impersonateAndFund(await vault.governor()))
          .setMaxSupplyDiff(ousdUnits("0.03"));

        // Request and claim 2 + 3 = 5 USDC from Vault
        await vault.connect(daniel).requestWithdrawal(ousdUnits("2"));
        await vault.connect(josh).requestWithdrawal(ousdUnits("3"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        await vault.connect(daniel).claimWithdrawal(2);
        await vault.connect(josh).claimWithdrawal(3);

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

          const tx = vault.connect(daniel).claimWithdrawal(2);

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

          const tx = vault.connect(daniel).claimWithdrawal(4);

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

          const tx = vault.connect(matt).claimWithdrawal(4);

          await expect(tx).to.be.revertedWith("Not requester");
        });
        it("Should claim the first withdrawal request in the queue after 30 minutes", async () => {
          const { vault, daniel } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          const requestId = 4;
          const tx = await vault.connect(daniel).claimWithdrawal(requestId);

          await expect(tx)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(
              daniel.address,
              requestId,
              ousdUnits("4"),
              usdcUnits("4")
            );

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

          const tx = vault.connect(josh).claimWithdrawal(5);

          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
        it("Fail to claim the last (3rd) withdrawal request in the queue", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).claimWithdrawal(6);

          await expect(tx).to.be.revertedWith("Queue pending liquidity");
        });
      });
      describe("when mint covers exactly outstanding requests (32 - 15 = 17 OUSD)", () => {
        beforeEach(async () => {
          const { vault, daniel, usdc } = fixture;
          await usdc.mintTo(daniel.address, usdcUnits("17"));
          await usdc.connect(daniel).approve(vault.address, usdcUnits("17"));
          await vault.connect(daniel).mint(usdcUnits("17"));

          // Advance in time to ensure time delay between request and claim.
          await advanceTime(delayPeriod);
        });
        it("Should claim the 2nd and 3rd withdrawal requests in the queue", async () => {
          const { vault, daniel, josh } = fixture;
          const fixtureWithUser = { ...fixture, user: daniel };
          const dataBefore = await snapData(fixtureWithUser);

          const tx1 = await vault.connect(daniel).claimWithdrawal(4);

          await expect(tx1)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(daniel.address, 4, ousdUnits("4"), usdcUnits("4"));

          const tx2 = await vault.connect(josh).claimWithdrawal(5);

          await expect(tx2)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(josh.address, 5, ousdUnits("12"), usdcUnits("12"));

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

          await expect(tx).to.be.revertedWith("Not enough assets available");
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
          await vault.connect(daniel).mint(usdcUnits("18"));
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

          await expect(tx).to.be.revertedWith("Not enough assets available");
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
          await vault.connect(daniel).mint(usdcUnits("21"));
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

          await expect(tx).to.be.revertedWith("Not enough assets available");
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
        await vault.connect(daniel).mint(usdcUnits("10"));
        await vault.connect(josh).mint(usdcUnits("20"));
        await vault.connect(matt).mint(usdcUnits("10"));

        // Request and claim 10 USDC from Vault
        await vault.connect(daniel).requestWithdrawal(ousdUnits("10"));
        await vault.connect(josh).requestWithdrawal(ousdUnits("20"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        // Claim 10 + 20 = 30 USDC from Vault
        await vault.connect(daniel).claimWithdrawal(2);
        await vault.connect(josh).claimWithdrawal(3);
      });
      it("Should allow the last user to request the remaining 10 USDC", async () => {
        const { vault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(matt).requestWithdrawal(ousdUnits("10"));

        const queuedAmount = usdcUnits("240"); // 110 + 100 + 10 + 20 + 10
        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(matt.address, 4, ousdUnits("10"), queuedAmount);

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

        const tx = await vault.connect(matt).claimWithdrawal(4);

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 4, ousdUnits("10"), usdcUnits("10"));

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
        await vault.connect(daniel).mint(usdcUnits("10"));
        await vault.connect(josh).mint(usdcUnits("20"));
        await vault.connect(matt).mint(usdcUnits("70"));

        // Request 40 USDC from Vault
        await vault.connect(matt).requestWithdrawal(ousdUnits("40"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
      });
      it("Should allow user to claim the request of 40 USDC", async () => {
        const { vault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(matt).claimWithdrawal(2);

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 2, ousdUnits("40"), usdcUnits("40"));

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

        const tx = await vault.connect(josh).claimWithdrawal(3);

        await expect(tx).to.emit(vault, "WithdrawalClaimed");
      });
      it("Should allow user to perform a new request and claim exactly the USDC available", async () => {
        const { vault, ousd, josh, matt, daniel } = fixture;
        await vault.connect(matt).claimWithdrawal(2);
        // All user give OUSD to another user
        await ousd.connect(josh).transfer(matt.address, ousdUnits("20"));
        await ousd.connect(daniel).transfer(matt.address, ousdUnits("10"));

        const fixtureWithUser = { ...fixture, user: matt };

        // Matt request the remaining 60 OUSD to be withdrawn
        await vault.connect(matt).requestWithdrawal(ousdUnits("60"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.

        const dataBefore = await snapData(fixtureWithUser);

        const tx = await vault.connect(matt).claimWithdrawal(3);

        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(matt.address, 3, ousdUnits("60"), usdcUnits("60"));

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
      it("Should only pay the haircut when the vault has lost most of its USDC", async () => {
        const { vault, ousd, usdc, josh, matt, daniel, governor } = fixture;
        await vault.connect(matt).claimWithdrawal(2);
        // All user give OUSD to another user
        await ousd.connect(josh).transfer(matt.address, ousdUnits("20"));
        await ousd.connect(daniel).transfer(matt.address, ousdUnits("10"));

        // Matt requests the remaining 60 OUSD to be withdrawn
        await vault.connect(matt).requestWithdrawal(ousdUnits("60"));
        await advanceTime(delayPeriod); // Advance in time to ensure time delay between request and claim.
        await usdc
          .connect(await impersonateAndFund(vault.address))
          .transfer(governor.address, usdcUnits("50")); // Vault loses 50 of its 60 USDC

        // Matt now holds the only claim left: gross 10 / effective supply 60.
        // He is paid the remaining vault haircut to that ratio, not his 60
        // nominal. Refusing the claim would strand the last 10 USDC forever.
        const ratio = await vault.backingRatio();
        // Haircut payout, scaled 18 -> 6 decimals, rounded down (matches contract)
        const payout18 = ousdUnits("60").mul(ratio).div(ousdUnits("1"));
        const payout6 = payout18.div("1000000000000");
        const dust = usdcUnits("10").sub(payout6); // rounds down, favours the vault

        const before = await usdc.balanceOf(matt.address);

        await vault.connect(matt).claimWithdrawal(3);

        expect(await usdc.balanceOf(matt.address)).to.equal(
          before.add(payout6)
        );
        expect(await usdc.balanceOf(vault.address)).to.equal(dust);
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
        await vault.connect(daniel).mint(usdcUnits("10"));
        await vault.connect(josh).mint(usdcUnits("20"));
        await vault.connect(matt).mint(usdcUnits("30"));

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
      it("Should allow first user to claim the request of 10 USDC (haircut)", async () => {
        const { vault, daniel, usdc } = fixture;

        // Loss socialised across effective supply 60: ratio = gross 59 / 60 = 0.98333
        const ratio = await vault.backingRatio();
        const nominal18 = ousdUnits("10");
        const nominal6 = usdcUnits("10");
        // Haircut payout, scaled 18 -> 6 decimals, rounded down (matches contract)
        const payout18 = nominal18.mul(ratio).div(ousdUnits("1"));
        const payout6 = payout18.div("1000000000000");

        const userBefore = await usdc.balanceOf(daniel.address);
        const vaultBefore = await usdc.balanceOf(vault.address);
        const queueBefore = await vault.withdrawalQueueMetadata();

        const tx = await vault.connect(daniel).claimWithdrawal(2);

        // Event carries the 18-dec nominal alongside the 6-dec haircut paid out
        await expect(tx)
          .to.emit(vault, "WithdrawalClaimed")
          .withArgs(daniel.address, 2, nominal18, payout6);

        expect(await usdc.balanceOf(daniel.address)).to.equal(
          userBefore.add(payout6)
        );
        expect(await usdc.balanceOf(vault.address)).to.equal(
          vaultBefore.sub(payout6)
        );
        // claimed bumps by the full nominal even though only the haircut is paid
        const queueAfter = await vault.withdrawalQueueMetadata();
        expect(queueAfter.claimed).to.equal(queueBefore.claimed.add(nominal6));
        // Ratio is invariant under a claim, and can only ever drift UP: the payout
        // is haircut off the same asset-decimal nominal the queue retires, and it
        // rounds down, so the vault always keeps at least the fair backing.
        expect(await vault.backingRatio()).to.be.gte(ratio);
        expect(await vault.backingRatio()).to.approxEqual(ratio);
      });
      it("Fail to allow second user to claim the request of 20 USDC, due to liquidity", async () => {
        const { vault, josh } = fixture;

        const tx = vault.connect(josh).claimWithdrawal(3);

        await expect(tx).to.be.revertedWith("Queue pending liquidity");
      });
      it("Should allow a user to create a new request with the circuit breaker off", async () => {
        // maxSupplyDiff is set to 0 so the ratio-band check is skipped
        const { vault, matt } = fixture;
        const fixtureWithUser = { ...fixture, user: matt };
        const dataBefore = await snapData(fixtureWithUser);

        // Queuing 10 more removes them from supply but adds them to the queue at
        // par; total value falls by the SOCIALISED value of those 10 units.
        const ratio = await vault.backingRatio();
        const valueDrop = ousdUnits("10").mul(ratio).div(ousdUnits("1"));

        const tx = vault.connect(matt).requestWithdrawal(ousdUnits("10"));

        // cumulative queued includes the 200 USDC requested in the outer
        // beforeEach plus the 40 in this block, plus this new 10 => 250
        await expect(tx)
          .to.emit(vault, "WithdrawalRequested")
          .withArgs(matt.address, 5, ousdUnits("10"), usdcUnits("250"));

        await assertChangedData(
          dataBefore,
          {
            ousdTotalSupply: ousdUnits("10").mul(-1),
            ousdTotalValue: valueDrop.mul(-1),
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
      describe("with circuit breaker at 1% (below the 1.67% socialised loss)", () => {
        beforeEach(async () => {
          const { vault } = fixture;
          // 1.67% socialised loss exceeds this 1% band, so the fuse trips.
          await vault
            .connect(await impersonateAndFund(await vault.governor()))
            .setMaxSupplyDiff(ousdUnits("0.01"));
        });
        it("Fail to allow user to create a new request: loss exceeds the band", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).requestWithdrawal(ousdUnits("1"));

          await expect(tx).to.be.revertedWith("Backing ratio out of range");
        });
        it("Fail to allow first user to claim: loss exceeds the band", async () => {
          const { vault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = vault.connect(daniel).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Backing ratio out of range");
        });
      });
      describe("with circuit breaker at 10% (above the 1.67% socialised loss)", () => {
        beforeEach(async () => {
          const { vault } = fixture;
          // 1.67% socialised loss is inside this 10% band, so claims flow.
          await vault
            .connect(await impersonateAndFund(await vault.governor()))
            .setMaxSupplyDiff(ousdUnits("0.1"));
        });
        it("Should allow user to create a new request", async () => {
          const { vault, matt } = fixture;

          const tx = await vault
            .connect(matt)
            .requestWithdrawal(ousdUnits("1"));

          await expect(tx).to.emit(vault, "WithdrawalRequested");
        });
        it("Should allow first user to claim their request with a haircut", async () => {
          const { vault, daniel, usdc } = fixture;

          const ratio = await vault.backingRatio();
          const payout6 = ousdUnits("10")
            .mul(ratio)
            .div(ousdUnits("1"))
            .div("1000000000000");
          const before = await usdc.balanceOf(daniel.address);

          const tx = await vault.connect(daniel).claimWithdrawal(2);

          await expect(tx)
            .to.emit(vault, "WithdrawalClaimed")
            .withArgs(daniel.address, 2, ousdUnits("10"), payout6);
          expect(await usdc.balanceOf(daniel.address)).to.equal(
            before.add(payout6)
          );
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
        await vault.connect(daniel).mint(usdcUnits("20"));
        await vault.connect(josh).mint(usdcUnits("30"));
        await vault.connect(matt).mint(usdcUnits("50"));

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
      describe("with 2 USDC slashed (2% loss, beyond the 1% circuit breaker)", () => {
        beforeEach(async () => {
          const { usdc, governor } = fixture;

          // Simulate slash event of 2 USDC
          await usdc
            .connect(await impersonateAndFund(mockStrategy.address))
            .transfer(governor.address, usdcUnits("2"));
        });
        it("Should socialise the loss into total value, not clamp to zero", async () => {
          // gross 98 - queue 99 * ratio 0.98 = 98 - 97.02 = 0.98
          expect(await fixture.vault.totalValue()).to.equal(ousdUnits("0.98"));
        });
        it("Should still report check balance of zero (queue at par exceeds gross)", async () => {
          const { vault, usdc } = fixture;
          // checkBalance is unchanged: raw 98 + claimed 0 - queued 99 < 0 => 0
          expect(await vault.checkBalance(usdc.address)).to.equal(0);
        });
        it("Fail to allow a new request: 2% loss trips the 1% circuit breaker", async () => {
          const { vault, matt } = fixture;

          const tx = vault.connect(matt).requestWithdrawal(ousdUnits("1"));

          await expect(tx).to.be.revertedWith("Backing ratio out of range");
        });
        it("Fail to allow first user to claim: 2% loss trips the 1% circuit breaker", async () => {
          const { vault, daniel } = fixture;

          await advanceTime(delayPeriod);

          const tx = vault.connect(daniel).claimWithdrawal(2);

          await expect(tx).to.be.revertedWith("Backing ratio out of range");
        });
      });
      describe("with 1 USDC slashed (1% loss, at the circuit breaker edge)", () => {
        beforeEach(async () => {
          const { usdc, governor } = fixture;

          // Simulate slash event of 1 USDC
          await usdc
            .connect(await impersonateAndFund(mockStrategy.address))
            .transfer(governor.address, usdcUnits("1"));
        });
        it("Should socialise the loss into total value", async () => {
          // gross 99 - queue 99 * ratio 0.99 = 99 - 98.01 = 0.99
          expect(await fixture.vault.totalValue()).to.equal(ousdUnits("0.99"));
        });
        it("Should allow first user to claim with a 1% haircut (at the band edge)", async () => {
          const { vault, daniel, usdc } = fixture;

          await advanceTime(delayPeriod);

          const ratio = await vault.backingRatio();
          const payout6 = ousdUnits("20")
            .mul(ratio)
            .div(ousdUnits("1"))
            .div("1000000000000");
          const before = await usdc.balanceOf(daniel.address);

          await vault.connect(daniel).claimWithdrawal(2);

          expect(await usdc.balanceOf(daniel.address)).to.equal(
            before.add(payout6)
          );
        });
      });
      describe("with 0.02 USDC slashed (0.02% loss, well inside the band)", () => {
        beforeEach(async () => {
          const { usdc, governor } = fixture;

          // Simulate slash event of 0.02 USDC
          await usdc
            .connect(await impersonateAndFund(mockStrategy.address))
            .transfer(governor.address, usdcUnits("0.02"));
        });
        it("Should socialise the loss into total value", async () => {
          // gross 99.98 - queue 99 * ratio 0.9998 = 0.9998
          expect(await fixture.vault.totalValue()).to.equal(
            ousdUnits("0.9998")
          );
        });
        it("Should allow a new small request", async () => {
          const { vault, matt } = fixture;

          const tx = await vault
            .connect(matt)
            .requestWithdrawal(ousdUnits("0.01"));

          await expect(tx).to.emit(vault, "WithdrawalRequested");
        });
        it("Should allow first user to claim with a tiny haircut", async () => {
          const { vault, daniel, usdc } = fixture;

          await advanceTime(delayPeriod);

          const ratio = await vault.backingRatio();
          const payout6 = ousdUnits("20")
            .mul(ratio)
            .div(ousdUnits("1"))
            .div("1000000000000");
          const before = await usdc.balanceOf(daniel.address);

          await vault.connect(daniel).claimWithdrawal(2);

          expect(await usdc.balanceOf(daniel.address)).to.equal(
            before.add(payout6)
          );
        });
      });
    });
  });
});
