const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { parseUnits } = require("ethers/lib/utils");

const {
  computeOptimalAllocation,
  buildExecutableActions,
} = require("../../utils/rebalancer");

const ZERO = BigNumber.from(0);
const usdc = (n) => parseUnits(n.toString(), 6);

// Vault addresses used as keys in the apys map
const ETH_VAULT = "0xMorphoEth";
const BASE_VAULT = "0xMorphoBase";

function makeStrategy(
  name,
  balanceUsdc,
  {
    isCrossChain = false,
    isDefault = false,
    isTransferPending = false,
    morphoVaultAddress,
  } = {}
) {
  return {
    name,
    address: `0x${name.replace(/\s/g, "").toLowerCase()}`,
    morphoVaultAddress:
      morphoVaultAddress || `0xMorpho_${name.replace(/\s/g, "")}`,
    isCrossChain,
    isDefault,
    isTransferPending,
    isAmo: false,
    balance: usdc(balanceUsdc),
  };
}

function twoStrategies(ethBalance, baseBalance) {
  return [
    makeStrategy("Ethereum Morpho", ethBalance, {
      isDefault: true,
      morphoVaultAddress: ETH_VAULT,
    }),
    makeStrategy("Base Morpho", baseBalance, {
      isCrossChain: true,
      morphoVaultAddress: BASE_VAULT,
    }),
  ];
}

// ─────────────────────────────────────────────────────────
// computeAllocation
// ─────────────────────────────────────────────────────────

describe("Rebalancer: computeOptimalAllocation", () => {
  it("should give highest APY strategy the max allocation (sort-and-fill)", () => {
    // Base has higher APY → gets maxPerChainBps (70%), ETH gets 30%
    const strategies = twoStrategies(500000, 500000);
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.03, [BASE_VAULT]: 0.06 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    // deployable = 1M - 0 (shortfall) - 3K (minVaultBalance) ≈ 997K
    expect(total).to.be.closeTo(usdc(997000), usdc(1));
    // Base gets the 70% cap since it has higher APY
    const basePct =
      result[1].targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(basePct).to.be.closeTo(70, 0.1);
  });

  it("should give highest APY strategy the max allocation when ETH has higher APY", () => {
    const strategies = twoStrategies(500000, 500000);
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.08, [BASE_VAULT]: 0.03 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    const ethPct =
      result[0].targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(ethPct).to.be.closeTo(70, 0.1);
  });

  it("should enforce minimum for default strategy when it has lower APY", () => {
    // Base has very high APY; without min constraint, ETH would get near 0
    const strategies = twoStrategies(500000, 500000);
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.001, [BASE_VAULT]: 0.2 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    const ethPct =
      result[0].targetBalance.mul(10000).div(total).toNumber() / 100;
    // Default (ETH) must get at least 20%
    expect(ethPct).to.be.gte(20);
    // Base cannot exceed 70% (capped, remainder goes to ETH)
    const basePct =
      result[1].targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(basePct).to.be.lte(70.1);
  });

  it("should reserve shortfall + minVaultBalance from deployable capital", () => {
    const strategies = twoStrategies(400000, 400000);
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.05 },
      vaultBalance: usdc(200000),
      shortfall: usdc(100000),
    });

    // total = 1M, reserved = 100K (shortfall) + 3K (minVault) = 103K
    // deployable = 897K
    const total = result[0].targetBalance.add(result[1].targetBalance);
    expect(total).to.be.closeTo(usdc(897000), usdc(1));
  });

  it("should give first strategy in sorted order the max cap when APYs are equal", () => {
    // Equal APYs → sort is stable → ETH (index 0) fills first to 70% cap
    const strategies = twoStrategies(500000, 500000);
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.05 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    const ethPct =
      result[0].targetBalance.mul(10000).div(total).toNumber() / 100;
    // ETH fills first to 70% (maxPerChainBps), Base gets remaining 30%
    expect(ethPct).to.be.closeTo(70, 0.1);
  });

  it("should give first strategy the max cap when APYs are zero", () => {
    const strategies = twoStrategies(1000000, 0);
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0, [BASE_VAULT]: 0 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    const ethPct =
      result[0].targetBalance.mul(10000).div(total).toNumber() / 100;
    expect(ethPct).to.be.closeTo(70, 0.1);
  });

  it("should set correct action for over/under allocated strategies", () => {
    // All in ETH, Base has higher APY → move some to Base
    const strategies = twoStrategies(1000000, 0);
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.03, [BASE_VAULT]: 0.06 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    expect(result[0].action).to.equal("withdraw"); // ETH overallocated
    expect(result[1].action).to.equal("deposit"); // Base underallocated
  });

  it("should include APY in results", () => {
    const strategies = twoStrategies(500000, 500000);
    const result = computeOptimalAllocation({
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
    const result = computeOptimalAllocation({
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
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.05 },
      vaultBalance: usdc(1000000),
      shortfall: ZERO,
    });

    const total = result[0].targetBalance.add(result[1].targetBalance);
    expect(total).to.be.closeTo(usdc(997000), usdc(1)); // minus minVaultBalance
    expect(result[0].action).to.equal("deposit");
    expect(result[1].action).to.equal("deposit");
  });

  it("should exclude AMO from allocation", () => {
    const strategies = [
      ...twoStrategies(500000, 500000),
      {
        name: "Curve AMO",
        address: "0xcurveamo",
        isAmo: true,
        isCrossChain: false,
        isDefault: false,
        balance: usdc(2000000),
        morphoVaultAddress: null,
      },
    ];
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.05 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const amoRow = result.find((r) => r.isAmo);
    expect(amoRow.action).to.equal("none");
    expect(amoRow.targetBalance).to.equal(ZERO);
    // AMO balance doesn't count in allocation pie
    const rebalancableTotal = result
      .filter((r) => !r.isAmo)
      .reduce((s, r) => s.add(r.targetBalance), ZERO);
    expect(rebalancableTotal).to.be.closeTo(usdc(997000), usdc(1));
  });

  it("should output withdraw-all when shortfall exceeds total capital", () => {
    // ETH 100K + Base 50K = 150K total; shortfall 200K > 150K → deployable = 0
    const strategies = twoStrategies(100000, 50000);
    const result = computeOptimalAllocation({
      strategies,
      apys: { [ETH_VAULT]: 0.05, [BASE_VAULT]: 0.04 },
      vaultBalance: usdc(0),
      shortfall: usdc(200000),
    });

    const ethRow = result.find((r) => r.name === "Ethereum Morpho");
    const baseRow = result.find((r) => r.name === "Base Morpho");
    // Both strategies should be told to withdraw their full balance
    expect(ethRow.action).to.equal("withdraw");
    expect(ethRow.delta.abs()).to.equal(usdc(100000));
    expect(baseRow.action).to.equal("withdraw");
    expect(baseRow.delta.abs()).to.equal(usdc(50000));
  });
});

// ─────────────────────────────────────────────────────────
// filterActions
// ─────────────────────────────────────────────────────────

describe("Rebalancer: buildExecutableActions", () => {
  function makeAllocation(
    name,
    balance,
    target,
    apy,
    { isCrossChain = false, isDefault = false, isTransferPending = false } = {}
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
      isAmo: false,
      morphoVaultAddress: `0xVault_${name}`,
      balance: balanceBN,
      targetBalance: targetBN,
      delta,
      apy,
      action: delta.gt(0) ? "deposit" : delta.lt(0) ? "withdraw" : "none",
    };
  }

  // Standard filtering

  it("should skip withdrawals below minMoveAmount", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500100, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 499900, 500000, 0.07, {
        isCrossChain: true,
      }),
    ];
    // delta = -100 USDC < $5K minMoveAmount
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[0].action).to.equal("none");
    expect(result[0].reason).to.equal("below min move");
  });

  it("should skip cross-chain moves below crossChainMinAmount", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 400000, 410000, 0.07, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 600000, 590000, 0.04, {
        isCrossChain: true,
      }),
    ];
    // Base overallocated by 10K, which is < $25K crossChainMinAmount
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[1].action).to.equal("none");
    expect(result[1].reason).to.equal("below cross-chain min");
  });

  it("should skip withdrawals where APY spread is too small", () => {
    // Both strategies at similar APY — not worth withdrawing from the lower one
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.054, {
        isCrossChain: true,
      }),
    ];
    // maxApy = 0.054, ETH apy = 0.05, spread = 0.004 < 0.005 minApySpread
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[0].action).to.equal("none");
    expect(result[0].reason).to.equal("APY spread too small");
  });

  it("should allow withdrawal when APY spread is sufficient", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // spread = 0.03, > 0.005 threshold, delta = 200K > minMoveAmount
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[0].action).to.equal("withdraw");
    expect(result[0].reason).to.be.undefined;
  });

  it("should approve cross-chain withdrawal when amount and APY spread are sufficient", () => {
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
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal("withdraw");
    expect(baseRow.reason).to.be.undefined;
  });

  it("cross-chain withdraw below minMoveAmount hits minMove check first", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.07, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 503000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    // Base overallocated by 3K — below minMoveAmount (5K), so minMove fires before crossChainMin
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal("none");
    expect(baseRow.reason).to.equal("below min move");
  });

  it("should skip cross-chain deposits when transfer is pending", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.04, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.07, {
        isCrossChain: true,
        isTransferPending: true,
      }),
    ];
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[1].action).to.equal("none");
    expect(result[1].reason).to.equal("transfer pending");
  });

  it("deposit blocked when budget is zero (no approved withdrawals, no vault surplus)", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.07, {
        isCrossChain: true,
      }),
    ];
    // ETH at target → no withdrawal; vaultBalance = 0 → surplus = 0 → depositBudget = 0
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal("none");
    expect(baseRow.reason).to.equal("insufficient vault funds");
  });

  it("approved withdrawal fully funds the deposit (both sides approved)", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // ETH withdrawal 200K approved → budget 200K; Base deposit 200K fully funded
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    const baseRow = result.find((a) => a.isCrossChain);
    expect(ethRow.action).to.equal("withdraw");
    expect(ethRow.delta.abs()).to.equal(usdc(200000));
    expect(baseRow.action).to.equal("deposit");
    expect(baseRow.delta).to.equal(usdc(200000));
    expect(baseRow.reason).to.be.undefined;
  });

  it("non-cross-chain deposit trimmed below minMoveAmount is discarded", () => {
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
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal("none");
    expect(ethRow.reason).to.equal("below min move");
  });

  it("higher-APY deposit is funded first when budget is scarce", () => {
    // ETH at target; two non-cross-chain deposits; vault surplus = 60K covers only the first
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Strategy High", 300000, 500000, 0.07, {}),
      makeAllocation("Strategy Low", 400000, 500000, 0.03, {}),
    ];
    // vaultBalance = 63K → surplus = 63K - 0 - 3K = 60K = depositBudget
    const result = buildExecutableActions(allocs, ZERO, usdc(63000));
    const highRow = result.find((a) => a.name === "Strategy High");
    const lowRow = result.find((a) => a.name === "Strategy Low");
    // High APY (0.07) funded first, trimmed to 60K
    expect(highRow.action).to.equal("deposit");
    expect(highRow.delta).to.equal(usdc(60000));
    expect(highRow.reason).to.include("trimmed");
    // Low APY (0.03) gets nothing — budget exhausted
    expect(lowRow.action).to.equal("none");
    expect(lowRow.reason).to.equal("insufficient vault funds");
  });

  // Pass 1 applies the same rules to the default strategy too

  it("overallocated default with no shortfall: normal minMoveAmount check applies", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 502000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 498000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // delta = 2K < minMoveAmount, no shortfall → filtered out in Pass 1
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[0].action).to.equal("none");
    expect(result[0].reason).to.equal("below min move");
  });

  // Shortfall fallback (Pass 2) — only runs when no withdraw was approved in Pass 1

  it("fallback: overallocated default filtered by minMove + shortfall → uses max(delta, shortfall)", () => {
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
    const result = buildExecutableActions(allocs, usdc(50000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal("withdraw");
    expect(defaultRow.delta.abs()).to.equal(usdc(50000));
    expect(defaultRow.reason).to.include("fallback");
  });

  it("fallback: overallocated default with delta > shortfall → uses delta amount", () => {
    // delta = -200K, shortfall = 50K → max(200K, 50K) = 200K
    // But Pass 1 filtered it due to APY spread too small
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.054, {
        isCrossChain: true,
      }),
    ];
    // APY spread = 0.004 < 0.005 → filtered in Pass 1
    const result = buildExecutableActions(allocs, usdc(50000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal("withdraw");
    // max(200K overallocation, 50K shortfall) = 200K, capped at balance (700K)
    expect(defaultRow.delta.abs()).to.equal(usdc(200000));
    expect(defaultRow.reason).to.include("fallback");
  });

  it("fallback: overallocated default withdrawal capped at balance", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 30000, 0, 0.04, { isDefault: true }),
    ];
    // shortfall (100K) > balance (30K) → cap at balance
    const result = buildExecutableActions(allocs, usdc(100000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.delta.abs()).to.equal(usdc(30000));
  });

  it("fallback: underallocated default + small shortfall → withdraws shortfall amount", () => {
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
    const result = buildExecutableActions(allocs, usdc(10000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal("withdraw");
    expect(defaultRow.delta.abs()).to.equal(usdc(10000));
    expect(defaultRow.reason).to.include("fallback");
  });

  it("fallback: underallocated default + large shortfall + insufficient balance → skips", () => {
    // Default at its target (action: none), shortfall large, balance (10K) < shortfall (100K)
    // shortfall (100K) >= crossChainMinAmount (25K) AND balance (10K) < shortfall → skip this round
    const allocs = [
      makeAllocation("Ethereum Morpho", 10000, 10000, 0.07, {
        isDefault: true,
      }),
    ];
    const result = buildExecutableActions(allocs, usdc(100000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    // Default can't cover → fallback skips it. No cross-chain with sufficient balance either.
    expect(defaultRow.action).to.equal("none");
  });

  it("fallback: withdraws shortfall from default when all withdrawals filtered in Pass 1", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.054, {
        isCrossChain: true,
      }),
    ];
    // Both at target → action "none" from computeAllocation; shortfall exists
    const result = buildExecutableActions(allocs, usdc(80000), usdc(0));
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal("withdraw");
    expect(defaultRow.reason).to.include("fallback");
    expect(defaultRow.delta.abs()).to.equal(usdc(80000));
  });

  it("fallback: withdraws from lowest-APY cross-chain when default has no balance", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 0, 0, 0.05, { isDefault: true }),
      makeAllocation("Base Morpho", 500000, 500000, 0.04, {
        isCrossChain: true,
      }),
    ];
    const result = buildExecutableActions(allocs, usdc(80000), usdc(0));
    const crossChainRow = result.find((a) => a.isCrossChain);
    expect(crossChainRow.action).to.equal("withdraw");
    expect(crossChainRow.reason).to.include("fallback");
  });

  it("shortfall fallback does not fire when a rebalancing withdrawal is already approved", () => {
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
    const result = buildExecutableActions(allocs, usdc(50000), usdc(0));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal("withdraw");
    expect(ethRow.reason).to.be.undefined; // pure rebalancing, not a fallback
    expect(ethRow.delta.abs()).to.equal(usdc(200000)); // rebalancing delta, not shortfall
    const withdrawals = result.filter((a) => a.action === "withdraw");
    expect(withdrawals).to.have.length(1);
  });

  it("shortfall fallback picks lowest-APY cross-chain when multiple are available", () => {
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
    const result = buildExecutableActions(allocs, usdc(80000), usdc(0));
    const highRow = result.find((a) => a.name === "Base High APY");
    const lowRow = result.find((a) => a.name === "Base Low APY");
    // Lowest APY (0.04) is selected for the fallback withdrawal
    expect(lowRow.action).to.equal("withdraw");
    expect(lowRow.reason).to.include("fallback");
    // Higher APY strategy is untouched
    expect(highRow.action).to.equal("none");
  });

  // Fallback: no deposit actions but vault has surplus

  it("fallback: deposits vault surplus to default when no deposit action qualified", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 500000, 500000, 0.054, {
        isCrossChain: true,
      }),
    ];
    // No actions, vault has 50K surplus beyond shortfall + minVaultBalance
    const surplus = usdc(50000 + 3000); // surplus above minVaultBalance
    const result = buildExecutableActions(allocs, ZERO, surplus);
    const defaultRow = result.find((a) => a.isDefault);
    expect(defaultRow.action).to.equal("deposit");
    expect(defaultRow.reason).to.include("surplus fallback");
    expect(defaultRow.delta).to.equal(usdc(50000)); // 50K surplus (3K is minVaultBalance)
  });

  it("surplus fallback does not fire when a deposit is already approved in Pass B", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.06, {
        isCrossChain: true,
      }),
    ];
    // ETH withdrawal 200K + vault surplus 47K → budget 247K; Base deposit 200K approved in Pass B
    // hasDeposit = true → surplus fallback must NOT fire
    const result = buildExecutableActions(allocs, ZERO, usdc(50000));
    const deposits = result.filter((a) => a.action === "deposit");
    expect(deposits).to.have.length(1);
    expect(deposits[0].name).to.equal("Base Morpho");
    const surplusDeposit = result.find(
      (a) => a.reason && a.reason.includes("surplus fallback")
    );
    expect(surplusDeposit).to.be.undefined;
  });

  it("surplus fallback does not fire when vault balance is consumed by shortfall+minVault", () => {
    const allocs = [
      makeAllocation("Ethereum Morpho", 500000, 500000, 0.05, {
        isDefault: true,
      }),
    ];
    // vaultBalance = 2K, shortfall = 0 → surplus = 2K - 0 - 3K = -1K ≤ 0 → no fallback
    const result = buildExecutableActions(allocs, ZERO, usdc(2000));
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal("none");
  });

  it("budget uses only net vault surplus after shortfall deduction", () => {
    // ETH withdrawal 200K approved; vault = 60K but shortfall = 50K → net surplus = 7K
    // Budget = 200K + 7K = 207K; Base deposit 300K trimmed to 207K
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.03, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 0, 300000, 0.06, {
        isCrossChain: true,
      }),
    ];
    const result = buildExecutableActions(allocs, usdc(50000), usdc(60000));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal("deposit");
    // 200K (withdrawal) + 7K (net vault surplus) = 207K, not 200K + 57K = 257K
    expect(baseRow.delta).to.equal(usdc(207000));
    expect(baseRow.reason).to.include("trimmed");
  });

  // Budget reconciliation (Pass B)

  it("deposit trimmed to vault surplus when withdraw is filtered by APY spread", () => {
    // ETH overallocated by 200K but APY spread is 0.004 < 0.005 → filtered in Pass A
    // Base underallocated by 200K, wants deposit; only vault surplus (50K) is available
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.054, {
        isCrossChain: true,
      }),
    ];
    // vaultBalance = 53K → surplus = 53K - 0 (shortfall) - 3K (minVaultBalance) = 50K
    const result = buildExecutableActions(allocs, ZERO, usdc(53000));
    const baseRow = result.find((a) => a.isCrossChain);
    // ETH withdraw filtered → deposit budget = vaultSurplus = 50K
    expect(baseRow.action).to.equal("deposit");
    expect(baseRow.delta).to.equal(usdc(50000));
    expect(baseRow.reason).to.include("trimmed");
    // ETH stays filtered
    const ethRow = result.find((a) => a.isDefault);
    expect(ethRow.action).to.equal("none");
  });

  it("deposit discarded when trimmed amount falls below cross-chain min", () => {
    // Same setup but vault surplus = 10K < crossChainMinAmount (25K)
    const allocs = [
      makeAllocation("Ethereum Morpho", 700000, 500000, 0.05, {
        isDefault: true,
      }),
      makeAllocation("Base Morpho", 300000, 500000, 0.054, {
        isCrossChain: true,
      }),
    ];
    // vaultBalance = 13K → surplus = 10K < 25K → deposit to cross-chain discarded
    const result = buildExecutableActions(allocs, ZERO, usdc(13000));
    const baseRow = result.find((a) => a.isCrossChain);
    expect(baseRow.action).to.equal("none");
    expect(baseRow.reason).to.include("cross-chain min");
  });

  // AMO rows pass through unchanged

  it("should pass AMO rows through unchanged", () => {
    const allocs = [
      {
        name: "Curve AMO",
        address: "0xcurveamo",
        isAmo: true,
        isCrossChain: false,
        isDefault: false,
        isTransferPending: false,
        balance: usdc(2000000),
        targetBalance: ZERO,
        delta: ZERO,
        apy: 0,
        action: "none",
        reason: "AMO - not rebalanced",
      },
    ];
    const result = buildExecutableActions(allocs, ZERO, usdc(0));
    expect(result[0]).to.deep.equal(allocs[0]);
  });
});
