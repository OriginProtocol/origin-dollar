// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Balancer ComposableStablePool Strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BalancerMetaPoolStrategy } from "./BalancerMetaPoolStrategy.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";

contract BalancerComposablePoolStrategy is BalancerMetaPoolStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /* @notice position of BPT token in the Balancer's pool
     *
     * @dev this could be a storage variable that gets set by reading Balancer's pool
     * tokens and comparing it to platformAddress. Seems more convenient, but we rather
     * go for gas savings of an immutable variable.
     */
    uint256 public immutable bptTokenPoolPosition;

    constructor(
        BaseStrategyConfig memory _stratConfig,
        BaseBalancerConfig memory _balancerConfig,
        BaseMetaPoolConfig memory _metapoolConfig,
        address _auraRewardPoolAddress,
        uint256 _bptTokenPoolPosition
    )
        BalancerMetaPoolStrategy(
            _stratConfig,
            _balancerConfig,
            _metapoolConfig,
            _auraRewardPoolAddress
        )
    {
        bptTokenPoolPosition = _bptTokenPoolPosition;
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

        require(
            // BPT position should be correctly configured
            poolAssets[bptTokenPoolPosition] == platformAddress,
            "BPT token position incorrect"
        );

        for (uint256 i = 0; i < _assets.length; ++i) {
            require(
                _assets[i] ==
                    _fromPoolAsset(
                        poolAssets[i >= bptTokenPoolPosition ? i + 1 : i]
                    ),
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
            amounts[i] = _amounts[i >= bptTokenPoolPosition ? i + 1 : i];
        }
        // TODO verify this works with various pools
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
            assets[i] = _assets[i >= bptTokenPoolPosition ? i + 1 : i];
        }
        // TODO verify this works with various pools
    }
}
