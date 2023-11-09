// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Balancer BalancerMetaPoolTest Strategy
 * This one is required to expose internal functions to our test suite. In fixtures
 * we replace the mainnet byte code with the one from this contract.
 *
 * @author Origin Protocol Inc
 */
import { BalancerMetaPoolStrategy } from "../strategies/balancer/BalancerMetaPoolStrategy.sol";

contract BalancerMetaPoolTestStrategy is BalancerMetaPoolStrategy {
    constructor(
        BaseStrategyConfig memory _stratConfig,
        BaseBalancerConfig memory _balancerConfig,
        address _auraRewardPoolAddress
    )
        BalancerMetaPoolStrategy(
            _stratConfig,
            _balancerConfig,
            _auraRewardPoolAddress
        )
    {}

    function getRateProviderRate(address _asset)
        external
        view
        returns (uint256)
    {
        return _getRateProviderRate(_asset);
    }

    /**
     * @notice This exposes the function that is currently not implemented
     * just to future proof the usage of _deposit.
     */
    function deposit(
        address[] calldata _strategyAssets,
        uint256[] calldata _strategyAmounts
    ) external override onlyVault nonReentrant {
        _deposit(_strategyAssets, _strategyAmounts);
    }
}
