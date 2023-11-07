// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Balancer ComposableStablePool Strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BalancerMetaPoolStrategy } from "./BalancerMetaPoolStrategy.sol";
import { IBalancerVault } from "../../interfaces/balancer/IBalancerVault.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";

contract BalancerComposablePoolStrategy is BalancerMetaPoolStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

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

    /* enum Value that represents exit encoding where for BPT given
     * request exactly specifies the minimum amount of underlying assets
     * to be returned.
     */
    function _btpInExactTokensOutIndex()
        internal
        pure
        override
        returns (uint256)
    {
        return
            uint256(
                IBalancerVault
                    .ComposablePoolExitKind
                    .BPT_IN_FOR_EXACT_TOKENS_OUT
            );
    }

    /* User encoding where BPT tokens are supplied for proportional exit is required when
     * calling a withdrawAll
     */
    function _exactBptInTokensOutIndex()
        internal
        pure
        override
        returns (uint256)
    {
        return
            uint256(
                IBalancerVault
                    .ComposablePoolExitKind
                    .EXACT_BPT_IN_FOR_ALL_TOKENS_OUT
            );
    }

    function _assetConfigVerification(address[] calldata _assets)
        internal
        view
        override
    {
        require(
            // aside from BPT token all assets must be supported
            poolAssets.length - 1 == _assets.length,
            "Pool assets length mismatch"
        );
        for (uint256 i = 0; i < _assets.length; ++i) {
            require(
                _assets[i] == _fromPoolAsset(poolAssets[i + 1]),
                "Pool assets mismatch"
            );
        }
    }

    function _getUserDataEncodedAmounts(uint256[] memory _amounts)
        internal
        view
        virtual
        override
        returns (uint256[] memory amounts)
    {
        // first asset in the Composable stable pool is the BPT token.
        // skip over that entry and shift all other assets for 1 position
        // to the left
        amounts = new uint256[](_amounts.length - 1);
        for (uint256 i = 0; i < _amounts.length - 1; ++i) {
            amounts[i] = _amounts[i + 1];
        }
    }

    function _getUserDataEncodedAssets(address[] memory _assets)
        internal
        view
        virtual
        override
        returns (address[] memory assets)
    {
        // first asset in the Composable stable pool is the BPT token.
        // skip over that entry and shift all other assets for 1 position
        // to the left
        assets = new address[](_assets.length - 1);
        for (uint256 i = 0; i < _assets.length - 1; ++i) {
            assets[i] = _assets[i + 1];
        }
    }
}
