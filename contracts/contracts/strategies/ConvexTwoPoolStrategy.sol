// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseCurveStrategy, CurveFunctions, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { ConvexStrategy } from "./ConvexStrategy.sol";
import { CurveTwoCoinFunctions } from "./curve/CurveTwoCoinFunctions.sol";

/**
 * @title Convex Strategy for Curve pools with two coins
 * @notice Investment strategy for investing Curve 3Crv tokens in a Convex pools.
 * @author Origin Protocol Inc
 */
contract ConvexTwoPoolStrategy is CurveTwoCoinFunctions, ConvexStrategy {
    constructor(
        BaseStrategyConfig memory _stratConfig,
        CurveConfig memory _curveConfig,
        ConvexConfig memory _convexConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        BaseCurveStrategy(_curveConfig)
        ConvexStrategy(_convexConfig)
        CurveTwoCoinFunctions(_curveConfig.curvePool)
    {}

    function getCurveFunctions()
        internal
        pure
        override(BaseCurveStrategy, CurveTwoCoinFunctions)
        returns (CurveFunctions memory)
    {
        return CurveTwoCoinFunctions.getCurveFunctions();
    }
}
