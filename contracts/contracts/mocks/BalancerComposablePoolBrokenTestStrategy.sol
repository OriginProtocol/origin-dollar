// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Balancer BalancerComposablePoolTest Strategy
 * This one is required to expose internal functions to our test suite. In fixtures
 * we replace the mainnet byte code with the one from this contract.
 *
 * @author Origin Protocol Inc
 */
import { BalancerComposablePoolStrategy } from "../strategies/balancer/BalancerComposablePoolStrategy.sol";

contract BalancerComposablePoolBrokenTestStrategy is BalancerComposablePoolStrategy {
    constructor(
        BaseStrategyConfig memory _stratConfig,
        BaseBalancerConfig memory _balancerConfig,
        address _auraRewardPoolAddress,
        uint256 _bptTokenPoolPosition
    )
        BalancerComposablePoolStrategy(
            _stratConfig,
            _balancerConfig,
            _auraRewardPoolAddress,
            _bptTokenPoolPosition
        )
    {}

    
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        //require(false, "Simulating a failed call");
    }   
}
