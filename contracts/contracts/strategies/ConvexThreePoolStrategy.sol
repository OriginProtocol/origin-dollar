// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseCurveStrategy, CurveFunctions, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { ConvexStrategy } from "./ConvexStrategy.sol";
import { CurveThreeCoinFunctions } from "./curve/CurveThreeCoinFunctions.sol";

/**
 * @title Convex Strategy for the Curve 3Pool pool (3Crv)
 * @notice Investment strategy for investing Curve 3Crv tokens in a Convex pools.
 * @author Origin Protocol Inc
 */
contract ConvexThreePoolStrategy is CurveThreeCoinFunctions, ConvexStrategy {
    constructor(
        BaseStrategyConfig memory _stratConfig,
        CurveConfig memory _curveConfig,
        ConvexConfig memory _convexConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        BaseCurveStrategy(_curveConfig)
        ConvexStrategy(_convexConfig)
    {}

    function getCurveFunctions()
        internal
        pure
        override(BaseCurveStrategy, CurveThreeCoinFunctions)
        returns (CurveFunctions memory)
    {
        return CurveThreeCoinFunctions.getCurveFunctions();
    }
}
