const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { parseUnits } = require("ethers/lib/utils");

const {
  computeAvailableBalance,
  computeIdealAllocation,
  buildExecutableActions,
  formatAllocationTable,
  ACTION_DEPOSIT,
  ACTION_WITHDRAW,
  ACTION_NONE,
} = require("../../utils/rebalancer");
const {
  OETH_USDC_MARKET_ID,
  WSTETH_USDC_MARKET_ID,
} = require("../../utils/rebalancer-config");

const ZERO = BigNumber.from(0);
const usdc = (n) => parseUnits(n.toString(), 6);

// Vault addresses used as keys in the apys map
const ETH_VAULT = "0xMorphoEth";
const BASE_VAULT = "0xMorphoBase";
const HYPER_VAULT = "0xMorphoHyper";

function makeStrategy(
  name,
  balanceUsdc,
  {
    isCrossChain = false,
    isDefault = false,
    isTransferPending = false,
    metaMorphoVaultAddress,
    minAllocationBps,
    maxAllocationBps = 9500,
  } = {}
) {
  return {
    name,
    address: `0x${name.replace(/\s/g, "").toLowerCase()}`,
    metaMorphoVaultAddress:
      metaMorphoVaultAddress || `0xMorpho_${name.replace(/\s/g, "")}`,
    isCrossChain,
    isDefault,
    isTransferPending,
    minAllocationBps:
      minAllocationBps != null ? minAllocationBps : isDefault ? 500 : 0,
    maxAllocationBps,
    balance: usdc(balanceUsdc),
  };
}

function twoStrategies(ethBalance, baseBalance) {
  return [
    makeStrategy("Ethereum Morpho", ethBalance, {
      isDefault: true,
      metaMorphoVaultAddress: ETH_VAULT,
    }),
    makeStrategy("Base Morpho", baseBalance, {
      isCrossChain: true,
      metaMorphoVaultAddress: BASE_VAULT,
    }),
  ];
}

function threeStrategies(ethBalance, baseBalance, hyperBalance) {
  return [
    makeStrategy("Ethereum Morpho", ethBalance, {
      isDefault: true,
      metaMorphoVaultAddress: ETH_VAULT,
    }),
    makeStrategy("Base Morpho", baseBalance, {
      isCrossChain: true,
      metaMorphoVaultAddress: BASE_VAULT,
    }),
    makeStrategy("HyperEVM Morpho", hyperBalance, {
      isCrossChain: true,
      metaMorphoVaultAddress: HYPER_VAULT,
    }),
  ];
}

// ─────────────────────────────────────────────────────────
// computeIdealAllocation
// ─────────────────────────────────────────────────────────

describe("Rebalancer: computeIdealAllocation", () => {
  it("should give highest APY strategy the max allocation (sort-and-fill)", () => {
    // Base has higher APY → gets maxPerStrategyBps (95%), ETH gets 5%
    const strategies = twoStrategies(500000, 500000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.03, [BASE_VAULT]: 0.06 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    // deployable = 1M - 0 (shortfall) = 1M
    expect(total).to.be.closeTo(usdc(1000000), usdc(1));
    // Base gets the 95% cap since it has higher APY
    const basePct =
      result[1].targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(basePct).to.be.closeTo(95, 0.1);
  });

  it("should give highest APY strategy the max allocation when ETH has higher APY", () => {
    const strategies = twoStrategies(500000, 500000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.08, [BASE_VAULT]: 0.03 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    const ethPct =
      result[0].targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(ethPct).to.be.closeTo(95, 0.1);
  });

  it("should enforce minimum for default strategy when it has lower APY", () => {
    // Base has very high APY; without min constraint, ETH would get near 0
    const strategies = twoStrategies(500000, 500000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.001, [BASE_VAULT]: 0.2 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    const ethPct =
      result[0].targetBalance.mul(10000).div(total).toNumber() / 100;
    // Default (ETH) must get at least 5% (minDefaultStrategyBps = 500)
    expect(ethPct).to.be.gte(5);
    // Base cannot exceed 95% (capped, remainder goes to ETH)
    const basePct =
      result[1].targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(basePct).to.be.lte(95.1);
  });

  it("should reserve shortfall from deployable capital", () => {
    const strategies = twoStrategies(400000, 400000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.05 },
      vaultBalance: usdc(200000),
      shortfall: usdc(100000),
    });

    // total = 1M, reserved = 100K (shortfall)
    // deployable = 900K
    const total = result[0].targetBalance.add(result[1].targetBalance);
    expect(total).to.be.closeTo(usdc(900000), usdc(1));
  });

  it("should give first strategy in sorted order the max cap when APYs are equal", () => {
    // Equal APYs → sort is stable → ETH (index 0) fills first to 70% cap
    const strategies = twoStrategies(500000, 500000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.05 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    const ethPct =
      result[0].targetBalance.mul(10000).div(total).toNumber() / 100;
    // ETH fills first to 95% (maxPerStrategyBps), Base gets remaining 5%
    expect(ethPct).to.be.closeTo(95, 0.1);
  });

  it("should give first strategy the max cap when APYs are zero", () => {
    const strategies = twoStrategies(1000000, 0);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0, [BASE_VAULT]: 0 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    const ethPct =
      result[0].targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(ethPct).to.be.closeTo(95, 0.1);
  });

  it("should set correct action for over/under allocated strategies", () => {
    // All in ETH, Base has higher APY → move some to Base
    const strategies = twoStrategies(1000000, 0);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.03, [BASE_VAULT]: 0.06 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    expect(result[0].action).to.equal(ACTION_WITHDRAW); // ETH overallocated
    expect(result[1].action).to.equal(ACTION_DEPOSIT); // Base underallocated
  });

  it("should include APY in results", () => {
    const strategies = twoStrategies(500000, 500000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.042, [BASE_VAULT]: 0.073 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    expect(result[0].apy).to.equal(0.042);
    expect(result[1].apy).to.equal(0.073);
  });

  it("should handle zero total capital", () => {
    const strategies = twoStrategies(0, 0);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.05 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    expect(result[0].targetBalance).to.equal(ZERO);
    expect(result[1].targetBalance).to.equal(ZERO);
  });

  it("should treat vault idle USDC as deployable capital", () => {
    const strategies = twoStrategies(0, 0);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.05 },
      vaultBalance: usdc(1000000),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    expect(total).to.be.closeTo(usdc(1000000), usdc(1));
    expect(result[0].action).to.equal(ACTION_DEPOSIT);
    expect(result[1].action).to.equal(ACTION_DEPOSIT);
  });

  it("should output withdraw-all when shortfall exceeds total capital", () => {
    // ETH 100K + Base 50K = 150K total; shortfall 200K > 150K → deployable = 0
    const strategies = twoStrategies(100000, 50000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.04 },
      vaultBalance: usdc(0),
      shortfall: usdc(200000),
    });

    const ethRow = result.find((r) => r.name === "Ethereum Morpho");
    const baseRow = result.find((r) => r.name === "Base Morpho");
    // Both strategies should be told to withdraw their full balance
    expect(ethRow.action).to.equal(ACTION_WITHDRAW);
    expect(ethRow.delta.abs()).to.equal(usdc(100000));
    expect(baseRow.action).to.equal(ACTION_WITHDRAW);
    expect(baseRow.delta.abs()).to.equal(usdc(50000));
  });

  // ── Deposit capacity constraints ──

  it("should cap allocation when deposit capacity limits it", () => {
    // Base has higher APY, but deposit capacity only allows 200K additional
    const strategies = twoStrategies(500000, 300000);
    const depositCapacities = {
      [BASE_VAULT]: { maxDeposit: usdc(200000) },
    };
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.03, [BASE_VAULT]: 0.06 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
      depositCapacities,
    });

    // Base: balance 300K + maxDeposit 200K = 500K cap
    // Without cap, Base would get 95% of ~800K ≈ 760K
    // With cap, Base gets 500K; remainder flows to ETH
    const baseRow = result.find((r) => r.name === "Base Morpho");
    expect(baseRow.targetBalance).to.equal(usdc(500000));
  });

  it("should overflow to next strategy when first is capacity-capped", () => {
    // Base has higher APY but capped at 200K deposit; overflow goes to ETH
    const strategies = twoStrategies(0, 0);
    const depositCapacities = {
      [BASE_VAULT]: { maxDeposit: usdc(200000) },
    };
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.03, [BASE_VAULT]: 0.06 },
      vaultBalance: usdc(1000000),
      shortfall: ZERO,
      depositCapacities,
    });

    // Base gets 200K (capped), ETH gets the rest (~800K)
    const baseRow = result.find((r) => r.name === "Base Morpho");
    const ethRow = result.find((r) => r.name === "Ethereum Morpho");
    expect(baseRow.targetBalance).to.equal(usdc(200000));
    // ETH gets remainder: 1M - 200K = 800K
    expect(ethRow.targetBalance).to.be.closeTo(usdc(800000), usdc(1));
  });

  // ── 3-strategy allocation scenarios ──

  it("3-strategy: highest APY fills first, remainder cascades down", () => {
    // HyperEVM 8% > Base 5% > ETH 3%
    // Greedy fill: HyperEVM fills to 95% cap (~947K), Base gets remainder (~50K), ETH gets 0.
    // Min enforcement: ETH needs 5% (~50K), clawed from HyperEVM (~947K → ~897K).
    const strategies = threeStrategies(500000, 300000, 200000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.03, [BASE_VAULT]: 0.05, [HYPER_VAULT]: 0.08 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result.reduce((s, r) => s.add(r.targetBalance), ZERO);
    const hyperRow = result.find((r) => r.name === "HyperEVM Morpho");
    const baseRow = result.find((r) => r.name === "Base Morpho");
    const ethRow = result.find((r) => r.name === "Ethereum Morpho");

    // HyperEVM (highest APY) gets the lion's share (~90% after min enforcement)
    const hyperPct =
      hyperRow.targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(hyperPct).to.be.closeTo(90, 0.5);
    // Base gets the greedy-fill remainder (~5%)
    const basePct =
      baseRow.targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(basePct).to.be.closeTo(5, 0.5);
    // ETH (default) gets at least 5% min
    const ethPct = ethRow.targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(ethPct).to.be.closeTo(5, 0.5);
  });

  it("3-strategy: deposit capacity limits cascade overflow through all strategies", () => {
    // HyperEVM 8% (cap 200K deposit), Base 5% (cap 100K deposit), ETH 3% (default)
    const strategies = threeStrategies(0, 0, 0);
    const depositCapacities = {
      [HYPER_VAULT]: { maxDeposit: usdc(200000) },
      [BASE_VAULT]: { maxDeposit: usdc(100000) },
    };
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.03, [BASE_VAULT]: 0.05, [HYPER_VAULT]: 0.08 },
      vaultBalance: usdc(1000000),
      shortfall: ZERO,
      depositCapacities,
    });

    const hyperRow = result.find((r) => r.name === "HyperEVM Morpho");
    const baseRow = result.find((r) => r.name === "Base Morpho");
    const ethRow = result.find((r) => r.name === "Ethereum Morpho");

    // HyperEVM capped at 200K
    expect(hyperRow.targetBalance).to.equal(usdc(200000));
    // Base capped at 100K
    expect(baseRow.targetBalance).to.equal(usdc(100000));
    // ETH gets the rest: 1M - 200K - 100K = 700K
    expect(ethRow.targetBalance).to.be.closeTo(usdc(700000), usdc(1));
  });

  // ── Withdrawal capacity constraints ──

  it("should enforce withdrawal capacity floor in ideal allocation", () => {
    // Base has 600K balance but can only withdraw 100K (capacity floor = 500K)
    // ETH has higher APY → greedy fill wants to move capital to ETH
    // But withdrawal capacity limits how much can leave Base
    const strategies = twoStrategies(200000, 600000);
    const withdrawalCapacities = {
      [BASE_VAULT]: { maxWithdraw: usdc(100000) },
    };
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.08, [BASE_VAULT]: 0.03 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
      withdrawalCapacities,
    });

    const baseRow = result.find((r) => r.name === "Base Morpho");
    // Base cannot go below 500K (600K balance - 100K maxWithdraw)
    expect(baseRow.targetBalance).to.be.gte(usdc(500000).toBigInt());
  });

  it("withdrawal capacity floor interacts with minAllocationBps", () => {
    // ETH (default, minAllocationBps=500) has 100K balance, can only withdraw 10K
    // Capacity floor = 90K; policy min = 5% of ~800K ≈ 40K; floor wins
    const strategies = twoStrategies(100000, 700000);
    const withdrawalCapacities = {
      [ETH_VAULT]: { maxWithdraw: usdc(10000) },
    };
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.02, [BASE_VAULT]: 0.08 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
      withdrawalCapacities,
    });

    const ethRow = result.find((r) => r.name === "Ethereum Morpho");
    // Capacity floor (90K) is higher than policy min (~40K), so 90K is enforced
    expect(ethRow.targetBalance).to.be.gte(usdc(90000).toBigInt());
  });

  it("no withdrawal capacity → no floor (existing behavior unchanged)", () => {
    // Same setup as above but without withdrawalCapacities
    const strategies = twoStrategies(100000, 700000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.02, [BASE_VAULT]: 0.08 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const ethRow = result.find((r) => r.name === "Ethereum Morpho");
    const total = result[0].targetBalance.add(result[1].targetBalance);
    // Without capacity floor, ETH gets only its policy min (5% of deployable)
    const ethPct = ethRow.targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(ethPct).to.be.closeTo(5, 0.5);
  });

  it("should enforce minimums for multiple strategies simultaneously", () => {
    // 3 strategies: HyperEVM has highest APY → gets lion's share
    // ETH (default, min 5%) needs claw-back from HyperEVM
    const strategies = threeStrategies(10000, 10000, 980000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.01, [BASE_VAULT]: 0.02, [HYPER_VAULT]: 0.1 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const ethRow = result.find((r) => r.name === "Ethereum Morpho");
    const total = result.reduce((s, r) => s.add(r.targetBalance), ZERO);
    const ethPct = ethRow.targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(ethPct).to.be.gte(5);
  });

  it("should allocate minimum to zero-balance default strategy", () => {
    const strategies = twoStrategies(0, 1000000);
    const result = computeIdealAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.02, [BASE_VAULT]: 0.08 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const ethRow = result.find((r) => r.name === "Ethereum Morpho");
    const total = result.reduce((s, r) => s.add(r.targetBalance), ZERO);
    const ethPct = ethRow.targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(ethPct).to.be.gte(5);
    expect(ethRow.action).to.equal(ACTION_DEPOSIT);
  });
});

// ─────────────────────────────────────────────────────────
// computeAvailableBalance
// ─────────────────────────────────────────────────────────

describe("Rebalancer: computeAvailableBalance", () => {
  const cases = [
    {
      name: "should reserve claimable-but-unclaimed funds from vault balance",
      queue: {
        queued: usdc(100000),
        claimable: usdc(80000),
        claimed: usdc(60000),
      },
      vault: usdc(50000),
      expectedAvailable: usdc(10000),
      expectedShortfall: ZERO,
    },
    {
      name: "should handle vault balance insufficient for total owed",
      queue: {
        queued: usdc(100000),
        claimable: usdc(80000),
        claimed: usdc(60000),
      },
      vault: usdc(30000),
      expectedAvailable: ZERO,
      expectedShortfall: usdc(10000),
    },
    {
      name: "should handle fully claimed queue",
      queue: {
        queued: usdc(100000),
        claimable: usdc(100000),
        claimed: usdc(100000),
      },
      vault: usdc(50000),
      expectedAvailable: usdc(50000),
      expectedShortfall: ZERO,
    },
    {
      name: "should handle no queue activity",
      queue: { queued: ZERO, claimable: ZERO, claimed: ZERO },
      vault: usdc(50000),
      expectedAvailable: usdc(50000),
      expectedShortfall: ZERO,
    },
    {
      name: "should handle zero vault balance with outstanding shortfall",
      queue: {
        queued: usdc(100000),
        claimable: usdc(80000),
        claimed: usdc(50000),
      },
      vault: ZERO,
      expectedAvailable: ZERO,
      expectedShortfall: usdc(50000),
    },
  ];

  for (const {
    name,
    queue,
    vault,
    expectedAvailable,
    expectedShortfall,
  } of cases) {
    it(name, () => {
      const result = computeAvailableBalance(queue, vault);
      expect(result.availableVaultBalance).to.equal(expectedAvailable);
      expect(result.shortfall).to.equal(expectedShortfall);
    });
  }
});

// ─────────────────────────────────────────────────────────
// Shared test helper: builds allocation/action objects
// ─────────────────────────────────────────────────────────

function makeAllocation(
  name,
  balance,
  target,
  apy,
  {
    isCrossChain = false,
    isDefault = false,
    isTransferPending = false,
    spotApy = null,
    withdrawableLiquidity = null,
  } = {}
) {
  const balanceBN = usdc(balance);
  const targetBN = usdc(target);
  const delta = targetBN.sub(balanceBN);
  return {
    name,
    address: `0x${name.replace(/\s/g, "").toLowerCase()}`,
    isCrossChain,
    isDefault,
    isTransferPending,
    metaMorphoVaultAddress: `0xVault_${name}`,
    balance: balanceBN,
    targetBalance: targetBN,
    delta,
    apy,
    spotApy: spotApy != null ? spotApy : apy,
    withdrawableLiquidity,
    action: delta.gt(0)
      ? ACTION_DEPOSIT
      : delta.lt(0)
      ? ACTION_WITHDRAW
      : ACTION_NONE,
  };
}

// ─────────────────────────────────────────────────────────
// buildExecutableActions
// ─────────────────────────────────────────────────────────

describe("Rebalancer: buildExecutableActions", () => {
  // Standard filtering

  it("should skip withdrawals below minMoveAmount", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500100, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 499900, 500000, 0.07, {
        isCrossChain: true,
      }),
    ];
    // delta = -100 USDC < $5K minMoveAmount
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[0].action).to.equal(ACTION_NONE);
    expect(result[0].reason).to.equal("below min move");
  });

  it("should skip cross-chain moves below crossChainMinAmount", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 400000, 410000, 0.07, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 600000, 590000, 0.04, {
        isCrossChain: true,
      }),
    ];
    // Base overallocated by 10K, which is < $25K crossChainMinAmount
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[1].action).to.equal(ACTION_NONE);
    expect(result[1].reason).to.equal("below cross-chain min");
  });

  it("should skip withdrawals with insufficient liquidity", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // Set liquidity below minMoveAmount ($5K)
    allocs[0].withdrawableLiquidity = usdc(1);
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[0].action).to.equal(ACTION_NONE);
    expect(result[0].reason).to.include("insufficient liquidity");
  });

  it("should allow withdrawal when APY spread is sufficient", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // spread = 0.03, > 0.005 threshold, delta = 200K > minMoveAmount
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[0].action).to.equal(ACTION_WITHDRAW);
    expect(result[0].reason).to.be.undefined;
  });

  it("should approve cross-chain withdrawal when amount and APY spread are sufficient", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 300000, 500000, 0.07, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 700000, 500000, 0.03, {
        isCrossChain: true,
      }),
    ];
    // Base overallocated by 200K ≥ crossChainMinAmount (25K)
    // spread = maxApy(0.07) - baseApy(0.03) = 0.04 > 0.005
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_WITHDRAW);
    expect(baseRow.reason).to.be.undefined;
  });

  it("cross-chain withdraw below minMoveAmount hits minMove check first", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.07, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 503000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    // Base overallocated by 3K — below minMoveAmount (5K), so minMove fires before crossChainMin
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.equal("below min move");
  });

  it("should skip cross-chain deposits when transfer is pending", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.07, {
        isCrossChain: true,
        isTransferPending: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[1].action).to.equal(ACTION_NONE);
    expect(result[1].reason).to.equal("transfer pending");
  });

  it("deposit blocked when budget is zero (no approved withdrawals, no vault surplus)", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.07, {
        isCrossChain: true,
      }),
    ];
    // ETH at target → no withdrawal; vaultBalance = 0 → surplus = 0 → depositBudget = 0
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.equal("insufficient vault funds");
  });

  it("approved withdrawal fully funds the deposit (both sides approved)", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // ETH withdrawal 200K approved → budget 200K; Base deposit 200K fully funded
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    const baseRow = result.find((a) => a.isCrossChain);
    expect(ethRow.action).to.equal(ACTION_WITHDRAW);
    expect(ethRow.delta.abs()).to.equal(usdc(200000));
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
    expect(baseRow.delta).to.equal(usdc(200000));
    expect(baseRow.reason).to.be.undefined;
  });

  it("non-cross-chain deposit trimmed below minMoveAmount is discarded", async () => {
    // Base withdrawal approved (200K) → budget 200K; ETH deposit delta 1K < minMoveAmount (5K)
    const allocs = [
      makeAllocation("Ethereum Morpho", 499000, 500000, 0.07, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 700000, 500000, 0.03, {
        isCrossChain: true,
      }),
    ];
    // Base withdrawal: spread = 0.07 - 0.03 = 0.04 > 0.005, amount 200K > 25K → approved
    // ETH deposit: delta 1K → trimmed to min(1K, 200K) = 1K < minMoveAmount → discarded
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_NONE);
    expect(ethRow.reason).to.equal("below min move");
  });

  it("higher-APY deposit is funded first when budget is scarce", async () => {
    // ETH at target; two non-cross-chain deposits; vault surplus = 60K covers only the first
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Strategy High", 300000, 500000, 0.07, {}),
      makeAllocation("Strategy Low", 400000, 500000, 0.03, {}),
    ];
    // vaultBalance = 60K → surplus = 60K = depositBudget
    const result = await buildExecutableActions(allocs, ZERO, usdc(60000));
    const highRow = result.find((a) => a.name === "Strategy High");
    const lowRow = result.find((a) => a.name === "Strategy Low");
    // High APY (0.07) funded first, trimmed to 60K
    expect(highRow.action).to.equal(ACTION_DEPOSIT);
    expect(highRow.delta).to.equal(usdc(60000));
    expect(highRow.reason).to.include("trimmed");
    // Low APY (0.03) gets nothing — budget exhausted
    expect(lowRow.action).to.equal(ACTION_NONE);
    expect(lowRow.reason).to.equal("insufficient vault funds");
  });

  // Pass 1 applies the same rules to the default strategy too

  it("overallocated default with no shortfall: normal minMoveAmount check applies", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 502000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 498000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // delta = 2K < minMoveAmount, no shortfall → filtered out in Pass 1
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[0].action).to.equal(ACTION_NONE);
    expect(result[0].reason).to.equal("below min move");
  });

  // Shortfall fallback (Pass 2) — only runs when no withdraw was approved in Pass 1

  it("fallback: overallocated default filtered by minMove + shortfall → uses max(delta, shortfall)", async () => {
    // delta = -2K (filtered in Pass 1 for minMoveAmount), shortfall = 50K
    // Pass 2 sees default was overallocated and shortfall > delta → uses shortfall amount
    const allocs = [
      makeAllocation("Ethereum Morpho", 502000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 498000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, usdc(50000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal(ACTION_WITHDRAW);
    expect(defaultRow.delta.abs()).to.equal(usdc(50000));
    expect(defaultRow.reason).to.include("fallback");
  });

  it("fallback: overallocated default with delta > shortfall → uses delta amount", async () => {
    // delta = -200K, shortfall = 50K → max(200K, 50K) = 200K
    // Pass 1 filtered due to insufficient liquidity
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.054, {
        isCrossChain: true,
      }),
    ];
    // Liquidity too low → filtered in Pass 1
    allocs[0].withdrawableLiquidity = usdc(1);
    const result = await buildExecutableActions(allocs, usdc(50000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal(ACTION_WITHDRAW);
    // max(200K overallocation, 50K shortfall) = 200K, capped at balance (700K)
    expect(defaultRow.delta.abs()).to.equal(usdc(200000));
    expect(defaultRow.reason).to.include("fallback");
  });

  it("fallback: overallocated default withdrawal capped at balance", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 30000, 0, 0.04, { isDefault: true }),
    ];
    // shortfall (100K) > balance (30K) → cap at balance
    const result = await buildExecutableActions(allocs, usdc(100000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.delta.abs()).to.equal(usdc(30000));
  });

  it("fallback: underallocated default + small shortfall → withdraws shortfall amount", async () => {
    // APY says deposit more to ETH (underallocated), but shortfall < crossChainMinAmount
    // Pass 2 picks up: underallocated + small shortfall → withdraw min(balance, shortfall)
    // Base is overallocated by 10K which is < crossChainMinAmount (25K) → filtered in Pass 1
    const allocs = [
      makeAllocation("Ethereum Morpho", 300000, 310000, 0.07, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 510000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    // shortfall = 10K < 25K crossChainMinAmount; Base filtered (cross-chain min); no withdraw approved
    const result = await buildExecutableActions(allocs, usdc(10000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal(ACTION_WITHDRAW);
    expect(defaultRow.delta.abs()).to.equal(usdc(10000));
    expect(defaultRow.reason).to.include("fallback");
  });

  it("fallback: underallocated default + large shortfall + insufficient balance → skips", async () => {
    // Default at its target (action: none), shortfall large, balance (10K) < shortfall (100K)
    // shortfall (100K) >= crossChainMinAmount (25K) AND balance (10K) < shortfall → skip this round
    const allocs = [
      makeAllocation("Ethereum Morpho", 10000, 10000, 0.07, {
        isDefault: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, usdc(100000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    // Default can't cover → fallback skips it. No cross-chain with sufficient balance either.
    expect(defaultRow.action).to.equal(ACTION_NONE);
  });

  it("fallback: withdraws shortfall from default when all withdrawals filtered in Pass 1", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.054, {
        isCrossChain: true,
      }),
    ];
    // Both at target → action "none" from computeAllocation; shortfall exists
    const result = await buildExecutableActions(allocs, usdc(80000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal(ACTION_WITHDRAW);
    expect(defaultRow.reason).to.include("fallback");
    expect(defaultRow.delta.abs()).to.equal(usdc(80000));
  });

  it("fallback: withdraws from lowest-APY cross-chain when default has no balance", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 0, 0, 0.05, { isDefault: true }),
      makeAllocation("Base Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, usdc(80000), usdc(0));
    const crossChainRow = result.find((a) => a.isCrossChain);
    expect(crossChainRow.action).to.equal(ACTION_WITHDRAW);
    expect(crossChainRow.reason).to.include("fallback");
  });

  it("shortfall fallback does not fire when a rebalancing withdrawal is already approved", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // ETH withdrawal 200K approved in Pass A (spread ok); shortfall = 50K also exists
    // hasWithdraw = true → shortfall fallback must NOT fire
    const result = await buildExecutableActions(allocs, usdc(50000), usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_WITHDRAW);
    expect(ethRow.reason).to.be.undefined; // pure rebalancing, not a fallback
    expect(ethRow.delta.abs()).to.equal(usdc(200000)); // rebalancing delta, not shortfall
    const withdrawals = result.filter((a) => a.action === ACTION_WITHDRAW);
    expect(withdrawals).to.have.length(1);
  });

  it("shortfall fallback picks lowest-APY cross-chain when multiple are available", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 0, 0, 0.05, { isDefault: true }),
      makeAllocation("Base High APY", 500000, 500000, 0.06, {
        isCrossChain: true,
      }),
      makeAllocation("Base Low APY", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    // Default has no balance; both cross-chain have 500K > crossChainMinAmount (25K)
    const result = await buildExecutableActions(allocs, usdc(80000), usdc(0));
    const highRow = result.find((a) => a.name === "Base High APY");
    const lowRow = result.find((a) => a.name === "Base Low APY");
    // Lowest APY (0.04) is selected for the fallback withdrawal
    expect(lowRow.action).to.equal(ACTION_WITHDRAW);
    expect(lowRow.reason).to.include("fallback");
    // Higher APY strategy is untouched
    expect(highRow.action).to.equal(ACTION_NONE);
  });

  // Fallback: no deposit actions but vault has surplus

  it("fallback: deposits vault surplus to default when no deposit action qualified", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.054, {
        isCrossChain: true,
      }),
    ];
    // No actions, vault has 50K surplus
    const result = await buildExecutableActions(allocs, ZERO, usdc(50000));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal(ACTION_DEPOSIT);
    expect(defaultRow.reason).to.include("surplus fallback");
    expect(defaultRow.delta).to.equal(usdc(50000));
  });

  it("surplus fallback does not fire when a deposit is already approved in Pass B", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // ETH withdrawal 200K + vault surplus 50K → budget 250K; Base deposit 200K approved in Pass B
    // hasDeposit = true → surplus fallback must NOT fire
    const result = await buildExecutableActions(allocs, ZERO, usdc(50000));
    const deposits = result.filter((a) => a.action === ACTION_DEPOSIT);
    expect(deposits).to.have.length(1);
    expect(deposits[0].name).to.equal("Base Morpho");
    const surplusDeposit = result.find(
      (a) => a.reason && a.reason.includes("surplus fallback")
    );
    expect(surplusDeposit).to.be.undefined;
  });

  it("budget uses only net vault surplus after shortfall deduction", async () => {
    // ETH withdrawal 200K approved; vault = 57K but shortfall = 50K → net surplus = 7K
    // Budget = 200K + 7K = 207K; Base deposit 300K trimmed to 207K
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 0, 300000, 0.06, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(
      allocs,
      usdc(50000),
      usdc(57000)
    );
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
    // 200K (withdrawal) + 7K (net vault surplus) = 207K
    expect(baseRow.delta).to.equal(usdc(207000));
    expect(baseRow.reason).to.include("trimmed");
  });

  // Budget reconciliation (Pass B)

  it("deposit trimmed to vault surplus when withdraw is filtered by liquidity", async () => {
    // ETH overallocated by 200K but no liquidity → filtered in Pass A
    // Base underallocated by 200K, wants deposit; only vault surplus (50K) is available
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // Liquidity too low → filtered in Pass A
    allocs[0].withdrawableLiquidity = usdc(1);
    // vaultBalance = 50K → surplus = 50K
    const result = await buildExecutableActions(allocs, ZERO, usdc(50000));
    const baseRow = result.find((a) => a.isCrossChain);
    // ETH withdraw filtered → deposit budget = vaultSurplus = 50K
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
    expect(baseRow.delta).to.equal(usdc(50000));
    expect(baseRow.reason).to.include("trimmed");
    // ETH stays filtered
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_NONE);
  });

  // Excluded strategies (APY exceeds threshold) — frozen in place

  it("excluded strategy passes through buildExecutableActions unchanged", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.6, {
        isCrossChain: true,
      }),
    ];
    // Simulate exclusion: freeze Base in place (delta=0, action=none, reason set)
    allocs[1].delta = ZERO;
    allocs[1].targetBalance = allocs[1].balance;
    allocs[1].action = ACTION_NONE;
    allocs[1].reason = "APY exceeds threshold";

    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.equal("APY exceeds threshold");
    expect(baseRow.delta).to.equal(ZERO);
  });

  it("excluded strategy is not picked for shortfall fallback", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 0, 0, 0.05, { isDefault: true }),
      makeAllocation("Base Morpho", 500000, 500000, 0.6, {
        isCrossChain: true,
      }),
    ];
    // Base is excluded (frozen) — should NOT be picked for shortfall withdrawal
    allocs[1].delta = ZERO;
    allocs[1].targetBalance = allocs[1].balance;
    allocs[1].action = ACTION_NONE;
    allocs[1].reason = "APY exceeds threshold";

    const result = await buildExecutableActions(allocs, usdc(80000), usdc(0));
    const baseRow = result.find((a) => a.isCrossChain);
    // Base stays frozen — shortfall fallback cannot pick it because its delta is 0
    // and it has no withdrawal action for the fallback to consider
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.equal("APY exceeds threshold");
  });

  it("excluded default strategy does not receive surplus deposit fallback", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.6, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    // Default is excluded (frozen)
    allocs[0].delta = ZERO;
    allocs[0].targetBalance = allocs[0].balance;
    allocs[0].action = ACTION_NONE;
    allocs[0].reason = "APY exceeds threshold";

    // Vault surplus exists but default is frozen — surplus fallback skips it
    const result = await buildExecutableActions(allocs, ZERO, usdc(53000));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_NONE);
    expect(ethRow.reason).to.equal("APY exceeds threshold");
  });

  it("deposit discarded when trimmed amount falls below cross-chain min", async () => {
    // ETH withdrawal filtered by liquidity; vault surplus = 10K < crossChainMinAmount (25K)
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // Liquidity too low → filtered in Pass A
    allocs[0].withdrawableLiquidity = usdc(1);
    // vaultBalance = 10K → surplus = 10K < 25K → deposit to cross-chain discarded
    const result = await buildExecutableActions(allocs, ZERO, usdc(10000));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.include("cross-chain min");
  });

  // Spread check + surplus trimming (Fix 1)

  it("deposit trimmed to surplus when spread check fails", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 100000, 500000, 0.05, {
        isCrossChain: true,
      }),
    ];
    // ETH withdrawal 200K approved; vaultBalance 200K → surplus 200K
    // Spread = 0.043 - 0.04 = 0.003 < 0.005 → fails, but surplus 200K ≥ 25K → trim
    const caps = {
      "0xVault_Base Morpho": {
        maxDeposit: usdc(500000),
        postDepositApy: 0.043,
        impactBps: 30,
      },
    };
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(200000),
      {},
      caps
    );
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
    expect(baseRow.delta).to.equal(usdc(200000));
    expect(baseRow.reason).to.include("trimmed to vault surplus");
  });

  it("spread rejection stands when surplus below cross-chain min", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 100000, 500000, 0.05, {
        isCrossChain: true,
      }),
    ];
    // surplus = 20K < crossChainMinAmount (25K) → can't trim
    const caps = {
      "0xVault_Base Morpho": {
        maxDeposit: usdc(500000),
        postDepositApy: 0.043,
        impactBps: 30,
      },
    };
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(20000),
      {},
      caps
    );
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.include("spread");
  });

  it("spread rejection stands when no surplus", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 100000, 500000, 0.05, {
        isCrossChain: true,
      }),
    ];
    // surplus = 0 → no surplus at all
    const caps = {
      "0xVault_Base Morpho": {
        maxDeposit: usdc(500000),
        postDepositApy: 0.043,
        impactBps: 30,
      },
    };
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(0),
      {},
      caps
    );
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.include("spread");
  });

  // Surplus fallback (Fix 2)

  it("remaining surplus deployed to default via fallback (adds to existing deposit)", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 300000, 310000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    // ETH deposit 10K approved; surplus = 900K; remaining = 900K - 10K = 890K
    const result = await buildExecutableActions(allocs, ZERO, usdc(900000));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_DEPOSIT);
    expect(ethRow.delta).to.equal(usdc(900000)); // 10K + 890K fallback
    expect(ethRow.reason).to.include("vault surplus fallback");
  });

  it("spread check trim works for same-chain deposit", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Strategy High", 100000, 400000, 0.05),
    ];
    // surplus = 10K ≥ 5K minMoveAmount (same-chain, no cross-chain check)
    const caps = {
      "0xVault_Strategy High": {
        maxDeposit: usdc(500000),
        postDepositApy: 0.043,
        impactBps: 30,
      },
    };
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(10000),
      {},
      caps
    );
    const highRow = result.find((a) => a.name === "Strategy High");
    expect(highRow.action).to.equal(ACTION_DEPOSIT);
    expect(highRow.delta).to.equal(usdc(10000));
    expect(highRow.reason).to.include("trimmed to vault surplus");
  });

  it("spread trim exhausts surplus — next deposit gets no surplus exemption", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Strategy A", 100000, 300000, 0.052),
      makeAllocation("Strategy B", 100000, 200000, 0.05),
    ];
    // surplus = 30K; Strategy A trims to 30K, surplus exhausted; B rejected
    const caps = {
      "0xVault_Strategy A": {
        maxDeposit: usdc(500000),
        postDepositApy: 0.043,
        impactBps: 30,
      },
      "0xVault_Strategy B": {
        maxDeposit: usdc(500000),
        postDepositApy: 0.043,
        impactBps: 30,
      },
    };
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(30000),
      {},
      caps
    );
    const aRow = result.find((a) => a.name === "Strategy A");
    const bRow = result.find((a) => a.name === "Strategy B");
    expect(aRow.action).to.equal(ACTION_DEPOSIT);
    expect(aRow.delta).to.equal(usdc(30000));
    expect(aRow.reason).to.include("trimmed to vault surplus");
    expect(bRow.action).to.equal(ACTION_NONE);
    expect(bRow.reason).to.include("spread");
  });

  it("all surplus consumed by deposits — no remaining surplus for fallback", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // ETH withdrawal 200K + surplus 50K = budget 250K; Base deposit 200K approved
    // surplus (50K) < totalDeposits (200K) → remainingSurplus = 0 → no fallback
    const result = await buildExecutableActions(allocs, ZERO, usdc(50000));
    const deposits = result.filter((a) => a.action === ACTION_DEPOSIT);
    expect(deposits).to.have.length(1);
    expect(deposits[0].name).to.equal("Base Morpho");
    const surplusDeposit = result.find(
      (a) => a.reason && a.reason.includes("surplus fallback")
    );
    expect(surplusDeposit).to.be.undefined;
  });

  it("remaining surplus below minMoveAmount — fallback skips", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 300000, 310000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    // surplus = 14K; ETH deposit 10K approved; remaining = 4K < 5K minMoveAmount
    const result = await buildExecutableActions(allocs, ZERO, usdc(14000));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_DEPOSIT);
    expect(ethRow.delta).to.equal(usdc(10000));
    const surplusFallback = result.find(
      (a) => a.reason && a.reason.includes("surplus fallback")
    );
    expect(surplusFallback).to.be.undefined;
  });

  it("surplus nets against default withdraw and converts to deposit", async () => {
    // ETH withdrawal (100K) is justified by Base deposit (100K).
    // Vault surplus = 300K. Surplus (200K remaining after Base deposit) is netted
    // against the 100K withdrawal → flips to a 100K deposit on the default strategy.
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 400000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 200000, 300000, 0.06, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(300000));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_DEPOSIT);
    expect(ethRow.reason).to.include("net of cancelled withdrawal");
  });

  it("spread rejection stands when surplus below same-chain minMoveAmount", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Strategy High", 100000, 400000, 0.05),
    ];
    // surplus = 3K < 5K minMoveAmount → can't trim
    const caps = {
      "0xVault_Strategy High": {
        maxDeposit: usdc(500000),
        postDepositApy: 0.043,
        impactBps: 30,
      },
    };
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(3000),
      {},
      caps
    );
    const highRow = result.find((a) => a.name === "Strategy High");
    expect(highRow.action).to.equal(ACTION_NONE);
    expect(highRow.reason).to.include("spread");
  });

  it("fully surplus-funded deposit skips spread check", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 100000, 150000, 0.05, {
        isCrossChain: true,
      }),
    ];
    // ETH withdrawal 200K; surplus = 53K - 3K = 50K
    // Base deposit 50K ≤ surplusBudget → fully surplus-funded → spread skipped
    // Spread WOULD fail (0.003 < 0.005) but deposit is surplus-funded
    const caps = {
      "0xVault_Base Morpho": {
        maxDeposit: usdc(500000),
        postDepositApy: 0.043,
        impactBps: 30,
      },
    };
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(53000),
      {},
      caps
    );
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
    expect(baseRow.delta).to.equal(usdc(50000));
    expect(baseRow.reason || "").not.to.include("spread");
  });

  it("spread check uses post-withdrawal APY (tighter spread)", async () => {
    // ETH (source): current APY 3%, post-withdrawal APY 3.6%
    // Base (dest):  post-deposit APY 4.0%
    // Spread with current APY:        4.0% - 3.0% = 1.0% → passes (≥0.5%)
    // Spread with post-withdrawal APY: 4.0% - 3.6% = 0.4% → fails (<0.5%)
    const allocs = [
      makeAllocation("Ethereum Morpho", 600000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 400000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const withdrawalCaps = {
      "0xVault_Ethereum Morpho": {
        maxWithdraw: usdc(200000),
        impactBps: 40,
        postWithdrawalApy: 0.036,
      },
    };
    const depositCaps = {
      "0xVault_Base Morpho": {
        maxDeposit: usdc(200000),
        postDepositApy: 0.04,
        impactBps: 10,
      },
    };
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(3000),
      {},
      depositCaps,
      withdrawalCaps
    );
    const baseRow = result.find((a) => a.isCrossChain);
    // Deposit should be rejected because post-deposit spread (0.4%) < minApySpread (0.5%)
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.include("spread");
  });

  it("spread check passes when post-withdrawal APY is not available", async () => {
    // Same setup but without withdrawal capacities — spread uses current APY (3%)
    // Spread: 4.0% - 3.0% = 1.0% → passes
    const allocs = [
      makeAllocation("Ethereum Morpho", 600000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 400000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const depositCaps = {
      "0xVault_Base Morpho": {
        maxDeposit: usdc(200000),
        postDepositApy: 0.04,
        impactBps: 10,
      },
    };
    // No withdrawal capacities — fall through to current APY
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(3000),
      {},
      depositCaps,
      {}
    );
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
  });

  // ── Withdrawal trimming (Pass 3) ──────────────────────────

  it("trim: smallest withdrawal cancelled when excess exists", async () => {
    // Two withdrawals approved: Base 30K, HyperEVM 300K
    // One deposit approved: ETH 200K
    // Total withdrawals = 330K, needed = 200K → excess = 130K
    // Smallest-first: Base 30K ≤ 130K → cancel; remaining excess = 100K
    // HyperEVM 300K > 100K → trim to 200K
    const allocs = [
      makeAllocation("Ethereum Morpho", 200000, 400000, 0.07, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 530000, 500000, 0.04, {
        isCrossChain: true,
      }),
      makeAllocation("HyperEVM Morpho", 800000, 500000, 0.03, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.name === "Base Morpho");
    const hyperRow = result.find((a) => a.name === "HyperEVM Morpho");
    // Base (30K) should be cancelled — smaller than excess
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.include("no approved deposits");
    // HyperEVM should be trimmed to match deposit need
    expect(hyperRow.action).to.equal(ACTION_WITHDRAW);
    expect(hyperRow.delta.abs()).to.be.lte(usdc(300000));
  });

  it("trim: withdrawal partially trimmed stays above minMoveAmount", async () => {
    // ETH withdrawal 200K approved; one small deposit 50K
    // vaultBalance = 3K, shortfall = 0, minVaultBalance = 0 → surplus = 3K
    // totalNeeded = 50K deposits - 3K surplus + 0 deficit = 47K
    // excess = 200K - 47K = 153K; trimmed to 47K ≥ 5K minMoveAmount → safe
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 350000, 0.06, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(3000));
    const ethRow = result.find((a) => a.isDefault);
    // ETH withdrawal trimmed: deposit 50K minus 3K vault surplus = 47K needed
    expect(ethRow.action).to.equal(ACTION_WITHDRAW);
    expect(ethRow.delta.abs()).to.equal(usdc(47000));
    expect(ethRow.reason).to.include("trimmed to match");
  });

  it("trim: no trimming when deposits consume full budget", async () => {
    // ETH withdrawal 200K, Base deposit 200K — exact match, no excess
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    // No trimming — withdrawal matches deposit exactly
    expect(ethRow.action).to.equal(ACTION_WITHDRAW);
    expect(ethRow.delta.abs()).to.equal(usdc(200000));
    expect(ethRow.reason).to.be.undefined;
  });

  it("trim: vault surplus fully covers deposit — withdrawal cancelled", async () => {
    // ETH overallocated by 200K → withdrawal; Base underallocated by 50K → deposit
    // Vault surplus = 60K (> 50K deposit) → deposit is fully surplus-funded
    // No withdrawal needed to fund the deposit → ETH withdrawal should be cancelled
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 350000, 0.06, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(60000));
    const ethRow = result.find((a) => a.isDefault);
    const baseRow = result.find((a) => a.isCrossChain);
    // Deposit is approved (surplus-funded)
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
    expect(baseRow.delta).to.equal(usdc(50000));
    // Withdrawal should be cancelled — vault surplus covers the entire deposit
    expect(ethRow.action).to.equal(ACTION_NONE);
    expect(ethRow.reason).to.include("no approved deposits");
  });

  // ── Spot APY divergence guard ─────────────────────────────

  [
    {
      name: "deposit blocked when spot APY diverges > maxSpotBelowAvgBps below average",
      spotApy: 0.02,
      expectedAction: ACTION_NONE,
      checkReason: "spot APY",
    },
    {
      name: "deposit allowed when spot APY is close to average (within threshold)",
      spotApy: 0.04,
      expectedAction: ACTION_DEPOSIT,
    },
    {
      name: "deposit allowed when spot APY is above average",
      spotApy: 0.06,
      expectedAction: ACTION_DEPOSIT,
    },
  ].forEach(({ name, spotApy, expectedAction, checkReason }) => {
    it(name, async () => {
      const allocs = [
        makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
          isDefault: true,
        }),
        makeAllocation("Base Morpho", 300000, 500000, 0.05, {
          isCrossChain: true,
        }),
      ];
      allocs[1].spotApy = spotApy;
      const result = await buildExecutableActions(allocs, ZERO, usdc(0));
      const baseRow = result.find((a) => a.isCrossChain);
      expect(baseRow.action).to.equal(expectedAction);
      if (checkReason) expect(baseRow.reason).to.include(checkReason);
    });
  });

  // ── Deposit capacity = 0 ──────────────────────────────────

  it("deposit rejected when capacity is zero (APY impact too high)", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    const depositCaps = {
      "0xVault_Base Morpho": {
        maxDeposit: ZERO,
        postDepositApy: 0,
        impactBps: 0,
      },
    };
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(0),
      {},
      depositCaps
    );
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.include("APY impact too high");
  });

  // ── 3-strategy scenarios (production-like config) ─────────

  it("3-strategy: budget from one withdrawal split across two deposits by APY", async () => {
    // ETH overallocated by 400K; Base (7%) and HyperEVM (5%) both underallocated
    // Higher APY (Base) gets funded first; HyperEVM gets remainder
    const allocs = [
      makeAllocation("Ethereum Morpho", 800000, 400000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 100000, 300000, 0.07, {
        isCrossChain: true,
      }),
      makeAllocation("HyperEVM Morpho", 100000, 300000, 0.05, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(3000));
    const ethRow = result.find((a) => a.isDefault);
    const baseRow = result.find((a) => a.name === "Base Morpho");
    const hyperRow = result.find((a) => a.name === "HyperEVM Morpho");

    expect(ethRow.action).to.equal(ACTION_WITHDRAW);
    // Base (higher APY) gets funded first
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
    expect(baseRow.delta).to.equal(usdc(200000));
    // HyperEVM gets remainder: 400K withdrawal - 200K Base = 200K
    expect(hyperRow.action).to.equal(ACTION_DEPOSIT);
    expect(hyperRow.delta).to.equal(usdc(200000));
  });

  it("3-strategy: budget partially covers second deposit", async () => {
    // ETH withdrawal 200K; Base wants 150K, HyperEVM wants 150K
    // Budget = 200K; Base (higher APY) gets 150K; HyperEVM gets remaining 50K
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 150000, 300000, 0.07, {
        isCrossChain: true,
      }),
      makeAllocation("HyperEVM Morpho", 150000, 300000, 0.05, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.name === "Base Morpho");
    const hyperRow = result.find((a) => a.name === "HyperEVM Morpho");

    // Base gets full 150K
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
    expect(baseRow.delta).to.equal(usdc(150000));
    // HyperEVM gets remaining budget: 200K - 150K = 50K
    expect(hyperRow.action).to.equal(ACTION_DEPOSIT);
    expect(hyperRow.delta).to.equal(usdc(50000));
    expect(hyperRow.reason).to.include("trimmed");
  });

  it("3-strategy: shortfall fallback selects lowest-APY cross-chain (production config)", async () => {
    // Default has no balance; two cross-chain: Base 6%, HyperEVM 4%
    // Shortfall fallback should pick HyperEVM (lowest APY)
    const allocs = [
      makeAllocation("Ethereum Morpho", 0, 0, 0.05, { isDefault: true }),
      makeAllocation("Base Morpho", 500000, 500000, 0.06, {
        isCrossChain: true,
      }),
      makeAllocation("HyperEVM Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, usdc(80000), usdc(0));
    const baseRow = result.find((a) => a.name === "Base Morpho");
    const hyperRow = result.find((a) => a.name === "HyperEVM Morpho");

    // HyperEVM (lowest APY 4%) selected for fallback withdrawal
    expect(hyperRow.action).to.equal(ACTION_WITHDRAW);
    expect(hyperRow.reason).to.include("fallback");
    expect(hyperRow.delta.abs()).to.equal(usdc(80000));
    // Base (higher APY 6%) left untouched
    expect(baseRow.action).to.equal(ACTION_NONE);
  });

  it("3-strategy trim: two small withdrawals cancelled before trimming the large one", async () => {
    // Three withdrawals: ETH 10K, Base 30K, HyperEVM 300K
    // One deposit: Strategy X 200K
    // vaultDeficit = 0; totalNeeded = 200K, totalWithdrawals = 340K, excess = 140K
    // Smallest-first: ETH 10K ≤ 140K → cancel (excess 130K);
    //                 Base 30K ≤ 130K → cancel (excess 100K);
    //                 HyperEVM 300K > 100K → trim to 200K
    const allocs = [
      makeAllocation("Ethereum Morpho", 510000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 530000, 500000, 0.03, {
        isCrossChain: true,
      }),
      makeAllocation("HyperEVM Morpho", 800000, 500000, 0.02, {
        isCrossChain: true,
      }),
      makeAllocation("Strategy X", 100000, 300000, 0.07),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    const baseRow = result.find((a) => a.name === "Base Morpho");
    const hyperRow = result.find((a) => a.name === "HyperEVM Morpho");

    // ETH (10K) and Base (30K) both cancelled — too small vs excess
    expect(ethRow.action).to.equal(ACTION_NONE);
    expect(ethRow.reason).to.include("no approved deposits");
    expect(baseRow.action).to.equal(ACTION_NONE);
    expect(baseRow.reason).to.include("no approved deposits");
    // HyperEVM trimmed to match deposit need
    expect(hyperRow.action).to.equal(ACTION_WITHDRAW);
    expect(hyperRow.delta.abs()).to.equal(usdc(200000));
    expect(hyperRow.reason).to.include("trimmed to match");
  });

  // ── Surplus netting edge cases ──────────────────────────

  it("surplus netting: net deposit below minMoveAmount creates sub-minimum deposit", async () => {
    // ETH withdrawal 100K, surplus = 103K → net deposit = 3K < 5K minMoveAmount
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 400000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 300000, 0.06, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, ZERO, usdc(103000));
    const ethRow = result.find((a) => a.isDefault);
    // Surplus fallback doesn't check minMoveAmount — net $3K deposit is created
    expect(ethRow.action).to.equal(ACTION_DEPOSIT);
    expect(ethRow.delta).to.equal(usdc(3000));
    expect(ethRow.reason).to.include("net of cancelled withdrawal");
  });

  it("surplus netting: surplus exactly equals withdrawal → action becomes none", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 400000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 300000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // ETH withdrawal 100K, surplus = 100K → net = 0 → ACTION_NONE
    const result = await buildExecutableActions(allocs, ZERO, usdc(100000));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_NONE);
    expect(ethRow.reason).to.include("surplus offsets withdrawal");
  });

  // ── Surplus fallback safety bypass ──────────────────────

  it("surplus fallback deploys to default even when deposit capacity is zero", async () => {
    // Default has maxDeposit=0 (APY impact too high), but surplus fallback bypasses check
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const depositCaps = {
      "0xVault_Ethereum Morpho": {
        maxDeposit: ZERO,
        postDepositApy: 0,
        impactBps: 0,
      },
    };
    // Vault surplus 50K → surplus fallback → deployed to default despite capacity=0
    const result = await buildExecutableActions(
      allocs,
      ZERO,
      usdc(50000),
      {},
      depositCaps
    );
    const ethRow = result.find((a) => a.isDefault);
    // Surplus fallback doesn't check deposit capacity
    expect(ethRow.action).to.equal(ACTION_DEPOSIT);
    expect(ethRow.delta).to.equal(usdc(50000));
    expect(ethRow.reason).to.include("surplus fallback");
  });

  // ── Withdrawal trim interactions ────────────────────────

  it("trim: withdrawal capped by liquidity then further trimmed by excess", async () => {
    // ETH has 200K overallocation but only 100K liquidity → capped to 100K
    // Base deposit = 50K → excess = 100K - 50K = 50K → trim ETH to 50K
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 350000, 0.06, {
        isCrossChain: true,
      }),
    ];
    allocs[0].withdrawableLiquidity = usdc(100000);
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_WITHDRAW);
    // Capped to 100K by liquidity, then trimmed to 50K to match deposit
    expect(ethRow.delta.abs()).to.equal(usdc(50000));
    expect(ethRow.reason).to.include("trimmed to match");
  });

  // ── All strategies excluded ─────────────────────────────

  it("all strategies excluded: vault surplus has nowhere to go", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.6, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.7, {
        isCrossChain: true,
      }),
    ];
    // Both excluded — freeze in place
    for (const a of allocs) {
      a.delta = ZERO;
      a.targetBalance = a.balance;
      a.action = ACTION_NONE;
      a.reason = "APY exceeds threshold";
    }
    // Vault surplus exists but all strategies excluded — surplus stays in vault
    const result = await buildExecutableActions(allocs, ZERO, usdc(50000));
    const deposits = result.filter((a) => a.action === ACTION_DEPOSIT);
    expect(deposits).to.have.length(0);
  });

  // ── Equal-APY deposit ordering ──────────────────────────

  it("equal-APY deposits: both funded when budget allows", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 100000, 200000, 0.06, {
        isCrossChain: true,
      }),
      makeAllocation("Strategy Local", 100000, 200000, 0.06),
    ];
    // ETH withdrawal 200K → budget 200K
    // Base and Local both want 100K at same APY (0.06)
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.name === "Base Morpho");
    const localRow = result.find((a) => a.name === "Strategy Local");
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
    expect(localRow.action).to.equal(ACTION_DEPOSIT);
  });

  // ── Shortfall boundary cases ────────────────────────────

  it("fallback: shortfall exactly at crossChainMinAmount — default covers it", async () => {
    // shortfall = 25K = crossChainMinAmount → "large shortfall" branch
    // default must fully cover it (balance >= shortfall)
    const allocs = [
      makeAllocation("Ethereum Morpho", 30000, 30000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, usdc(25000), usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal(ACTION_WITHDRAW);
    expect(ethRow.delta.abs()).to.equal(usdc(25000));
    expect(ethRow.reason).to.include("fallback");
  });

  it("fallback: shortfall at crossChainMinAmount, default can't cover → cross-chain", async () => {
    // shortfall = 25K, default balance = 20K < 25K → can't fully cover
    // Falls to lowest-APY cross-chain
    const allocs = [
      makeAllocation("Ethereum Morpho", 20000, 20000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const result = await buildExecutableActions(allocs, usdc(25000), usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    const baseRow = result.find((a) => a.isCrossChain);
    // Default skipped (can't fully cover), cross-chain picks up
    expect(ethRow.action).to.equal(ACTION_NONE);
    expect(baseRow.action).to.equal(ACTION_WITHDRAW);
    expect(baseRow.delta.abs()).to.equal(usdc(25000));
    expect(baseRow.reason).to.include("fallback");
  });

  // ── Spot APY boundary ───────────────────────────────────

  it("deposit allowed when spot APY divergence is exactly at threshold (200bps)", async () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.05, {
        isCrossChain: true,
      }),
    ];
    // avg 5%, spot 3% → divergence = exactly 200bps = threshold → allowed (> not >=)
    allocs[1].spotApy = 0.03;
    const result = await buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal(ACTION_DEPOSIT);
  });
});

// ─────────────────────────────────────────────────────────
// formatAllocationTable
// ─────────────────────────────────────────────────────────

describe("Rebalancer: formatAllocationTable", () => {
  it("should suppress vault delta when surplus is below minMoveAmount", () => {
    const actions = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
    ];
    const output = formatAllocationTable({
      actions,
      vaultBalance: usdc(19.5),
      shortfall: ZERO,
    });
    expect(output).to.include("Vault (idle)");
    expect(output).to.not.include("-19.50");
    const vaultLine = output
      .split("\n")
      .find((l) => l.includes("Vault (idle)"));
    expect(vaultLine).to.include("+0.00");
  });

  it("should show vault delta when surplus exceeds minMoveAmount", () => {
    const actions = [
      makeAllocation("Ethereum Morpho", 500000, 510000, 0.05, {
        isDefault: true,
      }),
    ];
    const output = formatAllocationTable({
      actions,
      vaultBalance: usdc(10000),
      shortfall: ZERO,
    });
    const vaultLine = output
      .split("\n")
      .find((l) => l.includes("Vault (idle)"));
    expect(vaultLine).to.include("-10,000.00");
  });

  it("should show zero vault delta when shortfall exists but no action approved", () => {
    const actions = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
    ];
    // Shortfall shown separately; no action changes vault balance → delta = 0
    const output = formatAllocationTable({
      actions,
      vaultBalance: ZERO,
      shortfall: usdc(100),
    });
    const vaultLine = output
      .split("\n")
      .find((l) => l.includes("Vault (idle)"));
    expect(vaultLine).to.include("+0.00");
  });

  it("should show vault delta when surplus equals minMoveAmount", () => {
    const actions = [
      makeAllocation("Ethereum Morpho", 500000, 505000, 0.05, {
        isDefault: true,
      }),
    ];
    const output = formatAllocationTable({
      actions,
      vaultBalance: usdc(5000),
      shortfall: ZERO,
    });
    const vaultLine = output
      .split("\n")
      .find((l) => l.includes("Vault (idle)"));
    expect(vaultLine).to.include("-5,000.00");
  });

  it("should show vault surplus consumed by active actions", () => {
    // Deposit exceeds withdrawal by $100 (the vault surplus).
    // Net strategy delta = -10K + 10.1K = +$100 → vault target = $100 - $100 = $0
    const actions = [
      makeAllocation("Ethereum Morpho", 500000, 490000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("HyperEVM Morpho", 0, 10100, 0.06, {
        isCrossChain: true,
      }),
    ];
    const output = formatAllocationTable({
      actions,
      vaultBalance: usdc(100),
      shortfall: ZERO,
    });
    const vaultLine = output
      .split("\n")
      .find((l) => l.includes("Vault (idle)"));
    expect(vaultLine).to.include("-100.00");
  });

  it("should show market details even when no action is active", () => {
    const actions = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const baselineMarkets = [
      {
        marketId: OETH_USDC_MARKET_ID,
        current: { supplyApy: 0.04, utilization: 0.85 },
        simulated: { supplyApy: 0.04, utilization: 0.85 },
      },
      {
        marketId: WSTETH_USDC_MARKET_ID,
        current: { supplyApy: 0.02, utilization: 0.7 },
        simulated: { supplyApy: 0.02, utilization: 0.7 },
      },
    ];
    const output = formatAllocationTable({
      actions,
      vaultBalance: ZERO,
      shortfall: ZERO,
      baselineMarkets,
    });
    expect(output).to.include("Ethereum Morpho Market Details");
    expect(output).to.include("85.00%");
    expect(output).to.include("4.00%");
  });
});
