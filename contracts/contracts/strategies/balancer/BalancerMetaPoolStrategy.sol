pragma solidity ^0.8.0;

/**
 * @title OETH Balancer MetaStablePool Strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BaseAuraStrategy } from "./BaseAuraStrategy.sol";
import { IBalancerVault } from "../../interfaces/balancer/IBalancerVault.sol";
import { IRateProvider } from "../../interfaces/balancer/IRateProvider.sol";
import { IMetaStablePool } from "../../interfaces/balancer/IMetaStablePool.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";

import "hardhat/console.sol";

contract BalancerMetaPoolStrategy is BaseAuraStrategy {
    using SafeERC20 for IERC20;
    address internal immutable stETH =
        0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address internal immutable wstETH =
        0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address internal immutable frxETH =
        0x5E8422345238F34275888049021821E8E08CAa1f;
    address internal immutable sfrxETH =
        0xac3E018457B222d93114458476f3E3416Abbe38F;

    function getRateProviderRate(address _asset)
        internal
        view
        override
        returns (uint256)
    {
        IMetaStablePool pool = IMetaStablePool(platformAddress);
        IRateProvider[] memory providers = pool.getRateProviders();

        uint256 providersLength = providers.length;
        for (uint256 i = 0; i < providersLength; ++i) {
            // _assets and corresponding rate providers are all in the same order
            if (poolAssetsMapped[i] == _asset) {
                // rate provider doesn't exist, defaults to 1e18
                if (address(providers[i]) == address(0)) {
                    return 1e18;
                }
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
    ) external override onlyVault nonReentrant {}

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {}

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

    function _deposit(address _asset, uint256 _amount) internal {
        /* dust rounding issues with stETH. When allocate is called it tries
         * to deposit 1-2 wei of stETH and the deposit fails with BPT amount check.
         *
         * TODO: solve this (only a problem when it is a default strategy for stETH)
         */
        if (_asset == stEth && _amount < 20) {
            return;
        }

        (address poolAsset, uint256 poolAmount) = toPoolAsset(_asset, _amount);

        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );
        uint256 tokensLength = tokens.length;
        uint256[] memory maxAmountsIn = new uint256[](tokensLength);
        uint256 assetIndex = 0;
        for (uint256 i = 0; i < tokensLength; ++i) {
            if (address(tokens[i]) == poolAsset) {
                maxAmountsIn[i] = poolAmount;
                assetIndex = i;
            } else {
                maxAmountsIn[i] = 0;
            }
        }

        wrapPoolAsset(_asset, _amount);

        // console.log("xxx");
        // console.log(uint256(IBalancerVault.WeightedPoolJoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT)); // 2
        // console.log(_amount); // 36523558823496626525
        // console.log(_asset); // 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
        // console.log("Max amounts in");
        // console.log(maxAmountsIn[0]); // 0
        // console.log(maxAmountsIn[1]); // 36523558823496626525

        // TODO: figure out why the slippage is so high
        uint256 minBPT = getMinBPTExpected(
            _asset,
            _amount,
            poolAsset,
            poolAmount
        );
        // console.log("Min BPT expected");
        // console.log(minBPT);

        /* TOKEN_IN_FOR_EXACT_BPT_OUT:
         * User sends an estimated but unknown (computed at run time) quantity of a single token,
         * and receives a precise quantity of BPT.
         *
         * ['uint256', 'uint256', 'uint256']
         * [TOKEN_IN_FOR_EXACT_BPT_OUT, bptAmountOut, enterTokenIndex]
         */
        bytes memory userData = abi.encode(
            IBalancerVault.WeightedPoolJoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT,
            minBPT,
            assetIndex
        );
        //bytes memory userData = abi.encode(IBalancerVault.WeightedPoolJoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT, 0, assetIndex);

        IBalancerVault.JoinPoolRequest memory request = IBalancerVault
            .JoinPoolRequest(poolAssetsMapped, maxAmountsIn, userData, false);
        console.log(IERC20(platformAddress).balanceOf(address(this)));
        balancerVault.joinPool(
            balancerPoolId,
            address(this),
            address(this),
            request
        );

        _lpDepositAll();
    }

    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            _approveAsset(assetsMapped[i]);
        }
        _approveBase();
    }

    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        (address poolAsset, ) = toPoolAsset(_asset, 0);
        // stEth
        if (_asset == stETH) {
            IERC20(stETH).approve(wstETH, 1e50);
            // if frxEth
        } else if (_asset == frxETH) {
            IERC20(frxETH).approve(sfrxETH, 1e50);
        }
        _approveAsset(poolAsset);
    }

    function _approveAsset(address _asset) internal {
        IERC20 asset = IERC20(_asset);
        // 3Pool for asset (required for adding liquidity)
        asset.safeApprove(address(balancerVault), 0);
        asset.safeApprove(address(balancerVault), type(uint256).max);
    }
}
