"use strict";

/**
 * Pins the storage layout of the contracts whose slots must not move by accident.
 *
 * This is a tripwire, not a compatibility check. It pins the WORKING TREE, so an
 * accidental reorder breaks CI on the PR that causes it. Whether a change is safe
 * against what is actually DEPLOYED is the deploy-time gate's job
 * (scripts/check-storage-upgrade.js, invoked from _recordDeployment).
 *
 * A diff in this file means storage moved. The PR description must say why.
 *
 * To regenerate a block after a legitimate change:
 *
 *   node -e 'const {pinnedLayout} = require("./scripts/test/helpers/artifact");
 *            console.log(JSON.stringify(pinnedLayout(FQN), null, 2))'
 *
 * Rows are `slot|offset|label|typeLabel|typeBytes`. The resolved type label is
 * pinned rather than the raw type id, because ids embed AST node numbers that
 * shift on unrelated edits (`t_struct(Strategy)5275_storage`). The label still
 * carries array lengths, so shrinking a gap from uint256[50] to uint256[49]
 * remains visible in the diff.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { pinnedLayout, canonicalise, gapEnds } = require("./helpers/artifact");

const FQN = {
  OUSDVault: "contracts/vault/OUSDVault.sol:OUSDVault",
  OUSD: "contracts/token/OUSD.sol:OUSD",
  WOETH: "contracts/token/WOETH.sol:WOETH",
  CompoundingStakingStrategy:
    "contracts/strategies/NativeStaking/CompoundingStakingStrategy.sol:CompoundingStakingStrategy",
};

const PINS = {
  // Covers VaultStorage + Initializable, and therefore the whole vault family.
  OUSDVault: [
    "0|0|initialized|bool|1",
    "0|1|initializing|bool|1",
    "1|0|__gap|uint256[50]|1600",
    "51|0|_deprecated_assets|uint256|32",
    "52|0|_deprecated_allAssets|address[]|32",
    "53|0|strategies|mapping(address => struct VaultStorage.Strategy)|32",
    "54|0|allStrategies|address[]|32",
    "55|0|_deprecated_priceProvider|address|20",
    "55|20|rebasePaused|bool|1",
    "55|21|capitalPaused|bool|1",
    "56|0|_deprecated_redeemFeeBps|uint256|32",
    "57|0|vaultBuffer|uint256|32",
    "58|0|autoAllocateThreshold|uint256|32",
    "59|0|__deprecatedRebaseThreshold|uint256|32",
    "60|0|oToken|contract OUSD|20",
    "61|0|_deprecated_rebaseHooksAddr|address|20",
    "62|0|_deprecated_uniswapAddr|address|20",
    "63|0|strategistAddr|address|20",
    "64|0|_deprecated_assetDefaultStrategies|uint256|32",
    "65|0|maxSupplyDiff|uint256|32",
    "66|0|trusteeAddress|address|20",
    "67|0|trusteeFeeBps|uint256|32",
    "68|0|_deprecated_swapTokens|address[]|32",
    "69|0|_deprecated_ousdMetaStrategy|address|20",
    "70|0|_deprecated_netOusdMintedForStrategy|int256|32",
    "71|0|_deprecated_netOusdMintForStrategyThreshold|uint256|32",
    "72|0|_deprecated_swapConfig|uint256|32",
    "73|0|isMintWhitelistedStrategy|mapping(address => bool)|32",
    "74|0|_deprecated_dripper|address|20",
    "75|0|withdrawalQueueMetadata|struct VaultStorage.WithdrawalQueueMetadata|64",
    "77|0|withdrawalRequests|mapping(uint256 => struct VaultStorage.WithdrawalRequest)|32",
    "78|0|withdrawalClaimDelay|uint256|32",
    "79|0|lastRebase|uint64|8",
    "79|8|dripDuration|uint64|8",
    "79|16|rebasePerSecondMax|uint64|8",
    "79|24|rebasePerSecondTarget|uint64|8",
    "80|0|defaultStrategy|address|20",
    "81|0|operatorAddr|address|20",
    "82|0|__gap|uint256[41]|1312",
    "123|0|_deprecated_wethAssetIndex|uint256|32",
  ],

  // Rebasing accounting. Corruption here is unrecoverable, and note the legacy
  // single-underscore `_gap` at slot 0 that predates the __gap convention.
  OUSD: [
    "0|0|_gap|uint256[154]|4928",
    "154|0|totalSupply|uint256|32",
    "155|0|allowances|mapping(address => mapping(address => uint256))|32",
    "156|0|vaultAddress|address|20",
    "157|0|creditBalances|mapping(address => uint256)|32",
    "158|0|rebasingCredits_|uint256|32",
    "159|0|rebasingCreditsPerToken_|uint256|32",
    "160|0|nonRebasingSupply|uint256|32",
    "161|0|alternativeCreditsPerToken|mapping(address => uint256)|32",
    "162|0|rebaseState|mapping(address => enum OUSD.RebaseOptions)|32",
    "163|0|__deprecated_isUpgraded|mapping(address => uint256)|32",
    "164|0|yieldTo|mapping(address => address)|32",
    "165|0|yieldFrom|mapping(address => address)|32",
    "166|0|__gap|uint256[34]|1088",
  ],

  // The only pinned contract whose slot 0-4 prefix comes from OpenZeppelin's
  // ERC20/ERC4626 rather than our own trees, so it moves if the OZ pin changes.
  WOETH: [
    "0|0|_balances|mapping(address => uint256)|32",
    "1|0|_allowances|mapping(address => mapping(address => uint256))|32",
    "2|0|_totalSupply|uint256|32",
    "3|0|_name|string|32",
    "4|0|_symbol|string|32",
    "5|0|initialized|bool|1",
    "5|1|initializing|bool|1",
    "6|0|__gap|uint256[50]|1600",
    "56|0|adjuster|uint256|32",
    "57|0|__gap|uint256[49]|1568",
  ],

  // Three variables share slot 51, so an innocent-looking type change can
  // silently move every strategy field that follows it.
  CompoundingStakingStrategy: [
    "0|0|initialized|bool|1",
    "0|1|initializing|bool|1",
    "1|0|__gap|uint256[50]|1600",
    "51|0|_paused|bool|1",
    "51|1|validatorRegistrator|address|20",
    "51|21|firstDeposit|bool|1",
    "52|0|deposits|mapping(bytes32 => struct CompoundingValidatorStorage.DepositData)|32",
    "53|0|depositList|bytes32[]|32",
    "54|0|verifiedValidators|bytes32[]|32",
    "55|0|validator|mapping(bytes32 => struct CompoundingValidatorStorage.ValidatorData)|32",
    "56|0|snappedBalance|struct CompoundingValidatorStorage.Balances|64",
    "58|0|lastVerifiedEthBalance|uint256|32",
    "59|0|depositedWethAccountedFor|uint256|32",
    "60|0|initialDepositAmountWei|uint256|32",
    "61|0|lastVerifiedBalanceTimestamp|uint64|8",
    "62|0|__gap|uint256[39]|1248",
    "101|0|_deprecated_platformAddress|address|20",
    "102|0|_deprecated_vaultAddress|address|20",
    "103|0|assetToPToken|mapping(address => address)|32",
    "104|0|assetsMapped|address[]|32",
    "105|0|_deprecated_rewardTokenAddress|address|20",
    "106|0|_deprecated_rewardLiquidationThreshold|uint256|32",
    "107|0|harvesterAddress|address|20",
    "108|0|rewardTokenAddresses|address[]|32",
    "109|0|_reserved|int256[98]|3136",
  ],
};

// Where each gap ends, i.e. the slot the next variable would take. A correct
// carve leaves these untouched; one that forgets to shrink moves them.
const GAP_ENDS = {
  OUSDVault: [51, 123],
  OUSD: [154, 200],
  WOETH: [56, 106],
  CompoundingStakingStrategy: [51, 101],
};

describe("pinned storage layouts", () => {
  for (const [name, fqn] of Object.entries(FQN)) {
    test(`${name} layout is unchanged`, () => {
      const actual = pinnedLayout(fqn);
      const pin = PINS[name];
      assert.equal(
        actual.length,
        pin.length,
        `${name}: storage row count changed (pinned ${pin.length}, got ${actual.length})`
      );
      for (let i = 0; i < pin.length; i++) {
        assert.equal(
          actual[i],
          pin[i],
          `${name} row ${i} (${pin[i].split("|")[2]})`
        );
      }
    });

    test(`${name} gaps still end where they did`, () => {
      assert.deepEqual(gapEnds(fqn), GAP_ENDS[name]);
    });
  }
});

describe("structural invariants", () => {
  test("the vault family shares one layout", () => {
    // OUSDVault and OETHVault are thin wrappers over VaultAdmin -> VaultStorage
    // and declare no storage of their own. This fires the moment one of them
    // does, which no per-contract pin would catch.
    assert.deepEqual(
      pinnedLayout("contracts/vault/OETHVault.sol:OETHVault"),
      pinnedLayout(FQN.OUSDVault),
      "OETHVault diverged from OUSDVault"
    );
  });
});

describe("the reader refuses to pass vacuously", () => {
  test("an artifact with no storageLayout throws instead of reading zero rows", () => {
    // A targeted `forge build <path>` omits storageLayout even though
    // foundry.toml sets extra_output. Observed on OSVault and OETHBaseVault.
    // Treating the missing key as an empty layout would silently disable every
    // pin above, so this must throw.
    assert.throws(
      () => canonicalise({ abi: [] }, "contracts/vault/OSVault.sol:OSVault"),
      /built without a storageLayout/
    );
  });

  test("an artifact holding a different contract throws", () => {
    // out/ is keyed by source basename, so contracts/proxies/Proxies.sol and
    // tests/utils/artifacts/Proxies.sol already share a directory.
    assert.throws(
      () =>
        canonicalise(
          {
            storageLayout: {
              storage: [
                {
                  contract: "other/Thing.sol:Thing",
                  slot: "0",
                  offset: 0,
                  label: "x",
                  type: "t_bool",
                },
              ],
              types: { t_bool: { label: "bool", numberOfBytes: "1" } },
            },
          },
          "contracts/vault/OUSDVault.sol:OUSDVault"
        ),
      /holds other\/Thing\.sol:Thing/
    );
  });
});
