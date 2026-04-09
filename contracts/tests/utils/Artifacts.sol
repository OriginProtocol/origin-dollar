// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title Artifacts
/// @notice Centralized registry of Foundry artifact paths used with `vm.deployCode(...)` in tests.
/// @dev Sub-libraries group artifacts by category (Tokens, Vaults, Proxies, ...). Use them at call
///      sites as `vm.deployCode(Tokens.OUSD, abi.encode(...))` instead of inline string literals,
///      so that path changes only require updating this file.
///
///      Naming conventions:
///      - SCREAMING_SNAKE_CASE for constants (Solidity convention).
///      - The category namespace acts as a prefix, so suffixes like `_ARTIFACT` are omitted.
///      - When a contract name is long and unwieldy, a short well-known abbreviation is acceptable
///        (e.g. `IG_PROXY` for `InitializeGovernedUpgradeabilityProxy`).
///
///      When adding a new artifact, place it in the relevant sub-library, or create a new
///      sub-library if no existing category fits.
library Tokens {
    string internal constant OETH = "contracts/token/OETH.sol:OETH";
    string internal constant OETH_BASE = "contracts/token/OETHBase.sol:OETHBase";
    string internal constant OS = "contracts/token/OSonic.sol:OSonic";
    string internal constant OUSD = "contracts/token/OUSD.sol:OUSD";
    string internal constant WOETH = "contracts/token/WOETH.sol:WOETH";
    string internal constant WOETH_BASE = "contracts/token/WOETHBase.sol:WOETHBase";
    string internal constant WOETH_PLUME = "contracts/token/WOETHPlume.sol:WOETHPlume";
    string internal constant WOSONIC = "contracts/token/WOSonic.sol:WOSonic";
    string internal constant WRAPPED_OUSD = "contracts/token/WrappedOusd.sol:WrappedOusd";
}

library Vaults {
    string internal constant OETH = "contracts/vault/OETHVault.sol:OETHVault";
    string internal constant OETH_BASE = "contracts/vault/OETHBaseVault.sol:OETHBaseVault";
    string internal constant OS = "contracts/vault/OSVault.sol:OSVault";
    string internal constant OUSD = "contracts/vault/OUSDVault.sol:OUSDVault";
}

library Proxies {
    string internal constant CROSS_CHAIN_STRATEGY_PROXY =
        "contracts/proxies/create2/CrossChainStrategyProxy.sol:CrossChainStrategyProxy";
    string internal constant IG_PROXY =
        "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:InitializeGovernedUpgradeabilityProxy";
    string internal constant IG_PROXY_2 =
        "contracts/proxies/InitializeGovernedUpgradeabilityProxy2.sol:InitializeGovernedUpgradeabilityProxy2";
    string internal constant OETH_PROXY = "contracts/proxies/Proxies.sol:OETHProxy";
    string internal constant OETH_VAULT_PROXY = "contracts/proxies/Proxies.sol:OETHVaultProxy";
    string internal constant OS_PROXY = "contracts/proxies/SonicProxies.sol:OSonicProxy";
    string internal constant OS_VAULT_PROXY = "contracts/proxies/SonicProxies.sol:OSonicVaultProxy";
    string internal constant WOETH_PROXY = "contracts/proxies/Proxies.sol:WOETHProxy";
}

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
    string internal constant OETH_SUPERNOVA_AMO_STRATEGY =
        "contracts/strategies/algebra/OETHSupernovaAMOStrategy.sol:OETHSupernovaAMOStrategy";
    string internal constant OETH_VAULT_VALUE_CHECKER =
        "contracts/strategies/VaultValueChecker.sol:OETHVaultValueChecker";
    string internal constant SONIC_STAKING_STRATEGY =
        "contracts/strategies/sonic/SonicStakingStrategy.sol:SonicStakingStrategy";
    string internal constant SONIC_SWAPX_AMO_STRATEGY =
        "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol:SonicSwapXAMOStrategy";
    string internal constant VAULT_VALUE_CHECKER = "contracts/strategies/VaultValueChecker.sol:VaultValueChecker";
}

library PoolBoosters {
    string internal constant CURVE_POOL_BOOSTER = "contracts/poolBooster/curve/CurvePoolBooster.sol:CurvePoolBooster";
    string internal constant CURVE_POOL_BOOSTER_FACTORY =
        "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol:CurvePoolBoosterFactory";
    string internal constant CURVE_POOL_BOOSTER_PLAIN =
        "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol:CurvePoolBoosterPlain";
    string internal constant POOL_BOOST_CENTRAL_REGISTRY =
        "contracts/poolBooster/PoolBoostCentralRegistry.sol:PoolBoostCentralRegistry";
    string internal constant POOL_BOOSTER_FACTORY_MERKL =
        "contracts/poolBooster/PoolBoosterFactoryMerkl.sol:PoolBoosterFactoryMerkl";
    string internal constant POOL_BOOSTER_FACTORY_METROPOLIS =
        "contracts/poolBooster/PoolBoosterFactoryMetropolis.sol:PoolBoosterFactoryMetropolis";
    string internal constant POOL_BOOSTER_FACTORY_SWAPX_DOUBLE =
        "contracts/poolBooster/PoolBoosterFactorySwapxDouble.sol:PoolBoosterFactorySwapxDouble";
    string internal constant POOL_BOOSTER_FACTORY_SWAPX_SINGLE =
        "contracts/poolBooster/PoolBoosterFactorySwapxSingle.sol:PoolBoosterFactorySwapxSingle";
    string internal constant POOL_BOOSTER_MERKL_V2 = "contracts/poolBooster/PoolBoosterMerklV2.sol:PoolBoosterMerklV2";
    string internal constant POOL_BOOSTER_METROPOLIS =
        "contracts/poolBooster/PoolBoosterMetropolis.sol:PoolBoosterMetropolis";
    string internal constant POOL_BOOSTER_SWAPX_DOUBLE =
        "contracts/poolBooster/PoolBoosterSwapxDouble.sol:PoolBoosterSwapxDouble";
    string internal constant POOL_BOOSTER_SWAPX_SINGLE =
        "contracts/poolBooster/PoolBoosterSwapxSingle.sol:PoolBoosterSwapxSingle";
}

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

library Zappers {
    string internal constant OETH_BASE_ZAPPER = "contracts/zapper/OETHBaseZapper.sol:OETHBaseZapper";
    string internal constant OETH_ZAPPER = "contracts/zapper/OETHZapper.sol:OETHZapper";
    string internal constant OS_ZAPPER = "contracts/zapper/OSonicZapper.sol:OSonicZapper";
    string internal constant WOETH_CCIP_ZAPPER = "contracts/zapper/WOETHCCIPZapper.sol:WOETHCCIPZapper";
}

library Mocks {
    string internal constant CCTP_MESSAGE_TRANSMITTER_MOCK_2 =
        "contracts/mocks/crosschain/CCTPMessageTransmitterMock2.sol:CCTPMessageTransmitterMock2";
    string internal constant CCTP_TOKEN_MESSENGER_MOCK =
        "contracts/mocks/crosschain/CCTPTokenMessengerMock.sol:CCTPTokenMessengerMock";
}
