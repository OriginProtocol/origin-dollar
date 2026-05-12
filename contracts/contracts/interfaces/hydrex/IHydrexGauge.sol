// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title IHydrexGauge
 * @notice Minimal interface exposing the staked-token getter used by the
 *         Hydrex GaugeV2 (>= v2.5). Hydrex renamed `TOKEN()` to `stakeToken()`
 *         in v2.5; the rest of the gauge surface (deposit / withdraw /
 *         getReward / emergency / emergencyWithdraw / balanceOf) is
 *         ABI-compatible with `IAlgebraGauge` and is invoked through that
 *         interface elsewhere in the strategy.
 */
interface IHydrexGauge {
    function stakeToken() external view returns (address);
}
