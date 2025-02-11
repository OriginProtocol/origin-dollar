// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { BaseCurveAMOStrategy } from "../BaseCurveAMOStrategy.sol";

/**
 * @title Curve AMO Strategy for the Origin Sonic Vault
 * @author Origin Protocol Inc
 */
contract SonicCurveAMOStrategy is BaseCurveAMOStrategy {
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _os,
        address _ws,
        address _gauge,
        address _gaugeFactory,
        uint128 _osCoinIndex,
        uint128 _wsCoinIndex
    )
        BaseCurveAMOStrategy(
            _baseConfig,
            _os,
            _ws,
            _gauge,
            _gaugeFactory,
            _osCoinIndex,
            _wsCoinIndex
        )
    {}
}
