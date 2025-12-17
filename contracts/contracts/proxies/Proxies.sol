// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { InitializeGovernedUpgradeabilityProxy } from "./InitializeGovernedUpgradeabilityProxy.sol";

/**
 * @notice OUSDProxy delegates calls to an OUSD implementation
 */
contract OUSDProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice WrappedOUSDProxy delegates calls to a WrappedOUSD implementation
 */
contract WrappedOUSDProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice VaultProxy delegates calls to a Vault implementation
 */
contract VaultProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice CompoundStrategyProxy delegates calls to a CompoundStrategy implementation
 */
contract CompoundStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice AaveStrategyProxy delegates calls to a AaveStrategy implementation
 */
contract AaveStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice ConvexStrategyProxy delegates calls to a ConvexStrategy implementation
 */
contract ConvexStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice HarvesterProxy delegates calls to a Harvester implementation
 */
contract HarvesterProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice DripperProxy delegates calls to a Dripper implementation
 */
contract DripperProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice MorphoCompoundStrategyProxy delegates calls to a MorphoCompoundStrategy implementation
 */
contract MorphoCompoundStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice ConvexOUSDMetaStrategyProxy delegates calls to a ConvexOUSDMetaStrategy implementation
 */
contract ConvexOUSDMetaStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice MorphoAaveStrategyProxy delegates calls to a MorphoCompoundStrategy implementation
 */
contract MorphoAaveStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHProxy delegates calls to nowhere for now
 */
contract OETHProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice WOETHProxy delegates calls to nowhere for now
 */
contract WOETHProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHVaultProxy delegates calls to a Vault implementation
 */
contract OETHVaultProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHDripperProxy delegates calls to a OETHDripper implementation
 */
contract OETHDripperProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHHarvesterProxy delegates calls to a Harvester implementation
 */
contract OETHHarvesterProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice CurveEthStrategyProxy delegates calls to a CurveEthStrategy implementation
 */
contract ConvexEthMetaStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice BuybackProxy delegates calls to Buyback implementation
 */
contract BuybackProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHMorphoAaveStrategyProxy delegates calls to a MorphoAaveStrategy implementation
 */
contract OETHMorphoAaveStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHBalancerMetaPoolrEthStrategyProxy delegates calls to a BalancerMetaPoolStrategy implementation
 */
contract OETHBalancerMetaPoolrEthStrategyProxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice OETHBalancerMetaPoolwstEthStrategyProxy delegates calls to a BalancerMetaPoolStrategy implementation
 */
contract OETHBalancerMetaPoolwstEthStrategyProxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice MakerDsrStrategyProxy delegates calls to a Generalized4626Strategy implementation
 */
contract MakerDsrStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHBuybackProxy delegates calls to Buyback implementation
 */
contract OETHBuybackProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice BridgedWOETHProxy delegates calls to BridgedWOETH implementation
 */
contract BridgedWOETHProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice NativeStakingSSVStrategyProxy delegates calls to NativeStakingSSVStrategy implementation
 */
contract NativeStakingSSVStrategyProxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice NativeStakingFeeAccumulatorProxy delegates calls to FeeAccumulator implementation
 */
contract NativeStakingFeeAccumulatorProxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice NativeStakingSSVStrategy2Proxy delegates calls to NativeStakingSSVStrategy implementation
 */
contract NativeStakingSSVStrategy2Proxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice NativeStakingFeeAccumulator2Proxy delegates calls to FeeAccumulator implementation
 */
contract NativeStakingFeeAccumulator2Proxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice NativeStakingSSVStrategy3Proxy delegates calls to NativeStakingSSVStrategy implementation
 */
contract NativeStakingSSVStrategy3Proxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice NativeStakingFeeAccumulator3Proxy delegates calls to FeeAccumulator implementation
 */
contract NativeStakingFeeAccumulator3Proxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice MetaMorphoStrategyProxy delegates calls to a Generalized4626Strategy implementation
 */
contract MetaMorphoStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice ARMBuybackProxy delegates calls to Buyback implementation
 */
contract ARMBuybackProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice MorphoGauntletPrimeUSDCStrategyProxy delegates calls to a Generalized4626Strategy implementation
 */
contract MorphoGauntletPrimeUSDCStrategyProxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice MorphoGauntletPrimeUSDTStrategyProxy delegates calls to a Generalized4626USDTStrategy implementation
 */
contract MorphoGauntletPrimeUSDTStrategyProxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice CurvePoolBoosterProxy delegates calls to a CurvePoolBooster implementation
 */
contract CurvePoolBoosterProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHFixedRateDripperProxy delegates calls to a OETHFixedRateDripper implementation
 */
contract OETHFixedRateDripperProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHSimpleHarvesterProxy delegates calls to a OETHSimpleHarvester implementation
 */
contract OETHSimpleHarvesterProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice PoolBoostCentralRegistryProxy delegates calls to the PoolBoostCentralRegistry implementation
 */
contract PoolBoostCentralRegistryProxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice MakerSSRStrategyProxy delegates calls to a Generalized4626Strategy implementation
 */
contract MakerSSRStrategyProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OUSDCurveAMOProxy delegates calls to a CurveAMOStrategy implementation
 */
contract OUSDCurveAMOProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice OETHCurveAMOProxy delegates calls to a CurveAMOStrategy implementation
 */
contract OETHCurveAMOProxy is InitializeGovernedUpgradeabilityProxy {

}

/**
 * @notice CompoundingStakingSSVStrategyProxy delegates calls to a CompoundingStakingSSVStrategy implementation
 */
contract CompoundingStakingSSVStrategyProxy is
    InitializeGovernedUpgradeabilityProxy
{

}

/**
 * @notice OUSDMorphoV2StrategyProxy delegates calls to a Generalized4626Strategy implementation
 */
contract OUSDMorphoV2StrategyProxy is InitializeGovernedUpgradeabilityProxy {

}
