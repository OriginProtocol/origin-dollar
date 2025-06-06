// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Rooster AMO strategy exposing extra functionality
 * @author Origin Protocol Inc
 */

import { RoosterAMOStrategy } from "../strategies/plume/RoosterAMOStrategy.sol";
import { IMaverickV2Pool } from "../interfaces/plume/IMaverickV2Pool.sol";

contract MockRoosterAMOStrategy is RoosterAMOStrategy {
    constructor(
        BaseStrategyConfig memory _stratConfig,
        address _wethAddress,
        address _oethpAddress,
        address _liquidityManager,
        address _poolLens,
        address _maverickPosition,
        address _maverickQuoter,
        address _mPool,
        bool _upperTickAtParity,
        address _votingDistributor,
        address _poolDistributor
    )
        RoosterAMOStrategy(
            _stratConfig,
            _wethAddress,
            _oethpAddress,
            _liquidityManager,
            _poolLens,
            _maverickPosition,
            _maverickQuoter,
            _mPool,
            _upperTickAtParity,
            _votingDistributor,
            _poolDistributor
        )
    {}

    function reservesInTickForGivenPrice(int32 tick, uint256 newSqrtPrice)
        external
        view
        returns (
            IMaverickV2Pool.TickState memory tickState,
            bool tickLtActive,
            bool tickGtActive
        )
    {
        return _reservesInTickForGivenPrice(tick, newSqrtPrice);
    }

    function getCurrentWethShare() external view returns (uint256) {
        uint256 _currentPrice = getPoolSqrtPrice();

        return _getWethShare(_currentPrice);
    }
}
