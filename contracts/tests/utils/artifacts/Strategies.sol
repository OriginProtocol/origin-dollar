// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

library Strategies {
    string internal constant AERODROME_AMO_STRATEGY =
        "contracts/strategies/aerodrome/AerodromeAMOStrategy.sol:AerodromeAMOStrategy";
    string internal constant BASE_CURVE_AMO_STRATEGY =
        "contracts/strategies/BaseCurveAMOStrategy.sol:BaseCurveAMOStrategy";
    string internal constant BRIDGED_WOETH_STRATEGY =
        "contracts/strategies/BridgedWOETHStrategy.sol:BridgedWOETHStrategy";
    string internal constant COMPOUNDING_STAKING_SSV_STRATEGY =
        "contracts/strategies/NativeStaking/CompoundingStakingSSVStrategy.sol:CompoundingStakingSSVStrategy";
    string internal constant CROSS_CHAIN_MASTER_STRATEGY =
        "contracts/strategies/crosschain/CrossChainMasterStrategy.sol:CrossChainMasterStrategy";
    string internal constant CROSS_CHAIN_REMOTE_STRATEGY =
        "contracts/strategies/crosschain/CrossChainRemoteStrategy.sol:CrossChainRemoteStrategy";
    string internal constant CURVE_AMO_STRATEGY = "contracts/strategies/CurveAMOStrategy.sol:CurveAMOStrategy";
    string internal constant GENERALIZED_4626_STRATEGY =
        "contracts/strategies/Generalized4626Strategy.sol:Generalized4626Strategy";
    string internal constant MORPHO_V2_STRATEGY = "contracts/strategies/MorphoV2Strategy.sol:MorphoV2Strategy";
    string internal constant OETH_VAULT_VALUE_CHECKER =
        "contracts/strategies/VaultValueChecker.sol:OETHVaultValueChecker";
    string internal constant VAULT_VALUE_CHECKER = "contracts/strategies/VaultValueChecker.sol:VaultValueChecker";
}
