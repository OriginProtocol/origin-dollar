// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title MockCurveGaugeFactory
/// @notice Minimal mock for IChildLiquidityGaugeFactory used by BaseCurveAMOStrategy.
contract MockCurveGaugeFactory {
    function mint(address /* _gauge */ ) external {
        // no-op
    }
}
