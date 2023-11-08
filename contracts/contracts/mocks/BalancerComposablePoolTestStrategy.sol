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

contract BalancerComposablePoolTestStrategy is BalancerComposablePoolStrategy {
    constructor(
        BaseStrategyConfig memory _stratConfig,
        BaseBalancerConfig memory _balancerConfig,
        BaseMetaPoolConfig memory _metapoolConfig,
        address _auraRewardPoolAddress,
        uint256 _bptTokenPoolPosition
    )
        BalancerComposablePoolStrategy(
            _stratConfig,
            _balancerConfig,
            _metapoolConfig,
            _auraRewardPoolAddress,
            _bptTokenPoolPosition
        )
    {}

    function getRateProviderRate(address _asset)
        external
        view
        returns (uint256)
    {
        return _getRateProviderRate(_asset);
    }

    function assetConfigVerification(address[] calldata _assets)
        external
        view
        returns (uint256)
    {
        _assetConfigVerification(_assets);
    }

    function getUserDataEncodedAmounts(uint256[] memory _amounts)
        external
        view
        returns (uint256[] memory amounts)
    {
        return _getUserDataEncodedAmounts(_amounts);
    }

    function getUserDataEncodedAssets(address[] memory _assets)
        external
        view
        returns (address[] memory assets)
    {
        return _getUserDataEncodedAssets(_assets);
    }
}
