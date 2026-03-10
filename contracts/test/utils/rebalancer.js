const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { parseUnits } = require("ethers/lib/utils");

const {
  computeAllocation,
  filterActions,
  applyConstraints,
  defaultConstraints,
} = require("../../utils/rebalancer");

// Helper: create a strategy object for tests
function makeStrategy(
  name,
  balanceUsdc,
  { isCrossChain = false, isTransferPending = false, morphoVaultAddress } = {}
) {
  return {
    name,
    address: `0x${name.replace(/\s/g, "")}`,
    morphoVaultAddress:
      morphoVaultAddress || `0xMorpho_${name.replace(/\s/g, "")}`,
    isCrossChain,
    isTransferPending,
    balance: parseUnits(balanceUsdc.toString(), 6),
  };
}

const ZERO = BigNumber.from(0);
const usdc = (n) => parseUnits(n.toString(), 6);

describe("Rebalancer: computeAllocation", () => {
  const ethMorpho = "0xMorphoEth";
  const baseMorpho = "0xMorphoBase";

  function twoStrategies(ethBalance, baseBalance) {
    return [
      makeStrategy("Ethereum Morpho", ethBalance, {
        morphoVaultAddress: ethMorpho,
      }),
      makeStrategy("Base Morpho", baseBalance, {
        isCrossChain: true,
        morphoVaultAddress: baseMorpho,
      }),
    ];
  }

  it("should allocate proportionally to APY", () => {
    // Ethereum: 10% APY, Base: 5% APY -> 2:1 ratio
    const strategies = twoStrategies(500000, 500000);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.1, [baseMorpho]: 0.05 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    // With 10% vs 5% APY, raw weights are 2/3 and 1/3
    // But max per chain is 65%, so Ethereum gets clamped to 65%
    expect(result[0].targetBalance).to.be.gt(result[1].targetBalance);
    // Total targets should roughly equal total capital
    const totalTarget = result[0].targetBalance.add(result[1].targetBalance);
    expect(totalTarget).to.be.closeTo(usdc(1000000), usdc(1));
  });

  it("should split evenly when APYs are equal", () => {
    const strategies = twoStrategies(800000, 200000);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.05, [baseMorpho]: 0.05 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    // Equal APY -> 50/50 split
    expect(result[0].targetBalance).to.equal(result[1].targetBalance);
    expect(result[0].targetBalance).to.equal(usdc(500000));
  });

  it("should split evenly when APYs are zero", () => {
    const strategies = twoStrategies(1000000, 0);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0, [baseMorpho]: 0 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    expect(result[0].targetBalance).to.equal(result[1].targetBalance);
  });

  it("should reserve vault balance for shortfall", () => {
    const strategies = twoStrategies(400000, 400000);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.05, [baseMorpho]: 0.05 },
      vaultBalance: usdc(200000),
      shortfall: usdc(200000),
    });

    // 1M total capital, 200K reserved for shortfall -> 800K deployable
    // 50/50 split of 800K = 400K each
    const totalTarget = result[0].targetBalance.add(result[1].targetBalance);
    expect(totalTarget).to.equal(usdc(800000));
  });

  it("should handle shortfall larger than vault balance", () => {
    const strategies = twoStrategies(400000, 400000);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.05, [baseMorpho]: 0.05 },
      vaultBalance: usdc(100000),
      shortfall: usdc(200000),
    });

    // 900K total, 200K reserved -> 700K deployable
    const totalTarget = result[0].targetBalance.add(result[1].targetBalance);
    expect(totalTarget).to.equal(usdc(700000));
  });

  it("should enforce minimum 20% Ethereum allocation", () => {
    // Base has much higher APY -> raw allocation would put most on Base
    const strategies = twoStrategies(100000, 900000);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.01, [baseMorpho]: 0.2 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const ethPct = result[0].targetBalance.mul(10000).div(usdc(1000000));
    // Should be at least 20%
    expect(ethPct.toNumber()).to.be.gte(2000);
  });

  it("should enforce max 65% per chain", () => {
    // Ethereum has much higher APY
    const strategies = twoStrategies(500000, 500000);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.5, [baseMorpho]: 0.01 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    const ethPct = result[0].targetBalance.mul(10000).div(usdc(1000000));
    // Should be at most 65%
    expect(ethPct.toNumber()).to.be.lte(6500);
  });

  it("should set correct action for over/under allocated strategies", () => {
    // All in Ethereum, Base has higher APY -> should move some to Base
    const strategies = twoStrategies(1000000, 0);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.03, [baseMorpho]: 0.06 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    expect(result[0].action).to.equal("withdraw");
    expect(result[1].action).to.equal("deposit");
  });

  it("should return none action when already at target", () => {
    const strategies = twoStrategies(500000, 500000);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.05, [baseMorpho]: 0.05 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    // 50/50 allocation matches 50/50 target
    expect(result[0].action).to.equal("none");
    expect(result[1].action).to.equal("none");
  });

  it("should handle vault idle USDC as deployable capital", () => {
    const strategies = twoStrategies(0, 0);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.05, [baseMorpho]: 0.05 },
      vaultBalance: usdc(1000000),
      shortfall: ZERO,
    });

    // All capital is idle, should suggest depositing to both
    expect(result[0].action).to.equal("deposit");
    expect(result[1].action).to.equal("deposit");
    const totalTarget = result[0].targetBalance.add(result[1].targetBalance);
    expect(totalTarget).to.equal(usdc(1000000));
  });

  it("should handle zero total capital", () => {
    const strategies = twoStrategies(0, 0);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.05, [baseMorpho]: 0.05 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    expect(result[0].targetBalance).to.equal(ZERO);
    expect(result[1].targetBalance).to.equal(ZERO);
    expect(result[0].action).to.equal("none");
  });

  it("should include APY in results", () => {
    const strategies = twoStrategies(500000, 500000);
    const result = computeAllocation({
      strategies,
      apys: { [ethMorpho]: 0.042, [baseMorpho]: 0.073 },
      vaultBalance: usdc(0),
      shortfall: ZERO,
    });

    expect(result[0].apy).to.equal(0.042);
    expect(result[1].apy).to.equal(0.073);
  });
});

describe("Rebalancer: applyConstraints", () => {
  it("should clamp Ethereum below minimum to 20%", () => {
    const strategies = [{ isCrossChain: false }, { isCrossChain: true }];
    const weights = applyConstraints(
      strategies,
      [0.05, 0.95],
      defaultConstraints
    );

    // Ethereum gets boosted from 5% to at least 20%
    expect(weights[0]).to.be.gte(0.2);
    // Base gets clamped to max 65%, remainder goes back to Ethereum
    expect(weights[1]).to.be.lte(0.651);
    // Weights should sum to 1
    expect(weights[0] + weights[1]).to.be.closeTo(1.0, 0.001);
  });

  it("should clamp any chain above 65%", () => {
    const strategies = [{ isCrossChain: false }, { isCrossChain: true }];
    const weights = applyConstraints(
      strategies,
      [0.9, 0.1],
      defaultConstraints
    );

    expect(weights[0]).to.be.lte(0.651);
    expect(weights[1]).to.be.gte(0.349);
  });

  it("should not modify weights already within constraints", () => {
    const strategies = [{ isCrossChain: false }, { isCrossChain: true }];
    const weights = applyConstraints(
      strategies,
      [0.5, 0.5],
      defaultConstraints
    );

    expect(weights[0]).to.be.closeTo(0.5, 0.001);
    expect(weights[1]).to.be.closeTo(0.5, 0.001);
  });
});

describe("Rebalancer: filterActions", () => {
  it("should skip moves below minimum amount", () => {
    const allocations = [
      {
        name: "Ethereum Morpho",
        isCrossChain: false,
        isTransferPending: false,
        delta: usdc(1000), // $1K < $5K min
        action: "deposit",
      },
    ];

    const filtered = filterActions(allocations);
    expect(filtered[0].action).to.equal("none");
    expect(filtered[0].reason).to.equal("below min move");
  });

  it("should skip cross-chain moves below cross-chain minimum", () => {
    const allocations = [
      {
        name: "Base Morpho",
        isCrossChain: true,
        isTransferPending: false,
        delta: usdc(10000), // $10K < $50K cross-chain min
        action: "deposit",
      },
    ];

    const filtered = filterActions(allocations);
    expect(filtered[0].action).to.equal("none");
    expect(filtered[0].reason).to.equal("below cross-chain min");
  });

  it("should skip when transfer is pending on cross-chain strategy", () => {
    const allocations = [
      {
        name: "Base Morpho",
        isCrossChain: true,
        isTransferPending: true,
        delta: usdc(100000),
        action: "deposit",
      },
    ];

    const filtered = filterActions(allocations);
    expect(filtered[0].action).to.equal("none");
    expect(filtered[0].reason).to.equal("transfer pending");
  });

  it("should allow moves above all thresholds", () => {
    const allocations = [
      {
        name: "Ethereum Morpho",
        isCrossChain: false,
        isTransferPending: false,
        delta: usdc(100000),
        action: "deposit",
      },
    ];

    const filtered = filterActions(allocations);
    expect(filtered[0].action).to.equal("deposit");
    expect(filtered[0].reason).to.be.undefined;
  });

  it("should not filter none actions", () => {
    const allocations = [
      {
        name: "Ethereum Morpho",
        isCrossChain: false,
        isTransferPending: false,
        delta: ZERO,
        action: "none",
      },
    ];

    const filtered = filterActions(allocations);
    expect(filtered[0].action).to.equal("none");
  });
});
