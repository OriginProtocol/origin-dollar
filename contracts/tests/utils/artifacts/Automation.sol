// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library Automation {
    string internal constant AUTO_WITHDRAWAL_MODULE =
        "contracts/automation/AutoWithdrawalModule.sol:AutoWithdrawalModule";
    string internal constant BASE_BRIDGE_HELPER_MODULE =
        "contracts/automation/BaseBridgeHelperModule.sol:BaseBridgeHelperModule";
    string internal constant CLAIM_BRIBES_SAFE_MODULE =
        "contracts/automation/ClaimBribesSafeModule.sol:ClaimBribesSafeModule";
    string internal constant CLAIM_STRATEGY_REWARDS_SAFE_MODULE =
        "contracts/automation/ClaimStrategyRewardsSafeModule.sol:ClaimStrategyRewardsSafeModule";
    string internal constant COLLECT_XOGN_REWARDS_MODULE =
        "contracts/automation/CollectXOGNRewardsModule.sol:CollectXOGNRewardsModule";
    string internal constant CURVE_POOL_BOOSTER_BRIBES_MODULE =
        "contracts/automation/CurvePoolBoosterBribesModule.sol:CurvePoolBoosterBribesModule";
    string internal constant ETHEREUM_BRIDGE_HELPER_MODULE =
        "contracts/automation/EthereumBridgeHelperModule.sol:EthereumBridgeHelperModule";
}
