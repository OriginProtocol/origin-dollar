pragma solidity ^0.8.0;

/**
 * @title OETH Balancer MetaStablePool Strategy
 * @author Origin Protocol Inc
 */
import { BaseBalancerStrategy } from "./BaseBalancerStrategy.sol";
import { IBalancerVault } from "../../interfaces/balancer/IBalancerVault.sol";
import { IRateProvider } from "../../interfaces/balancer/IRateProvider.sol";
import { IMetaStablePool } from "../../interfaces/balancer/IMetaStablePool.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";

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
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant
    {

    }

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {

    }

    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    function depositAll() external override onlyVault nonReentrant {
        uint256 assetsLength = assetsMapped.length;
        for (uint256 i = 0; i < assetsLength; ++i) {
            uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
            if (balance > 0) {
                _deposit(assetsMapped[i], balance);
            }
        }
    }

    function _deposit(address _asset, uint256 _amount)
        internal
    {
        (address poolAsset, uint256 poolAmount) = toPoolAsset(_asset, _amount);

        (IERC20[] memory tokens,,) = balancerVault.getPoolTokens(balancerPoolId);
        uint256 tokensLength = tokens.length;
        uint256[] memory maxAmountsIn = new uint256[](tokensLength);
        uint256 assetIndex = 0;
        address[] memory joinPoolAssets = new address[](tokensLength);
        for (uint256 i = 0; i < tokensLength; ++i) {
            joinPoolAssets[i] = address(tokens[i]);
            if (address(tokens[i]) == poolAsset) {
                maxAmountsIn[i] = poolAmount;
                assetIndex = i;
            } else {
                maxAmountsIn[i] = 0;
            }
        }

        /* TOKEN_IN_FOR_EXACT_BPT_OUT:
         * User sends an estimated but unknown (computed at run time) quantity of a single token,
         * and receives a precise quantity of BPT.
         *
         * ['uint256', 'uint256', 'uint256']
         * [TOKEN_IN_FOR_EXACT_BPT_OUT, bptAmountOut, enterTokenIndex]
         */
        bytes memory userData = abi.encode(IBalancerVault.WeightedPoolJoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT, getMinBPTExpected(poolAsset, poolAmount), assetIndex);

        IBalancerVault.JoinPoolRequest memory request = IBalancerVault.JoinPoolRequest(joinPoolAssets, maxAmountsIn, userData, false);
        balancerVault.joinPool(balancerPoolId, address(this), address(this), request);

        _lpDepositAll();
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