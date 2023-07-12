pragma solidity ^0.8.0;

/**
 * @title OETH Balancer MetaStablePool Strategy
 * @author Origin Protocol Inc
 */
import { BaseBalancerStrategy } from "./BaseBalancerStrategy.sol";
import { IRateProvider } from "../../interfaces/balancer/IRateProvider.sol";
import { IMetaStablePool } from "../../interfaces/balancer/IMetaStablePool.sol";

contract BalancerMetaPoolStrategy is BaseBalancerStrategy {

    function getRateProviderRate(address _asset)
        internal
        override
        view
        returns(uint256)
    {
        IMetaStablePool pool = IMetaStablePool(platformAddress);
        IRateProvider[] memory providers = pool.getRateProviders();

        uint256 providersLength = providers.length;
        for (uint256 i = 0; i < providersLength; ++i) {
          // _assets and corresponding rate providers are all in the same order
          if (assetsMapped[i] == _asset) {
            return providers[i].getRate();
          }
        }

        // should never happen
        require(false, "Can not find rateProvider");
    }

    function withdraw(
        address _recipient,
        address _weth,
        uint256 _amount
    ) external override onlyVault nonReentrant
    {

    }

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {

    }

    function deposit(address _weth, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
    }

    function depositAll() external override onlyVault nonReentrant {
    }

    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
    }

    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

}