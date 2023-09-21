// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Balancer ComposableStablePool Strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BaseAuraStrategy, BaseBalancerStrategy } from "./BaseAuraStrategy.sol";
import { BalancerMetaPoolStrategy } from "./BalancerMetaPoolStrategy.sol";
import { IBalancerVault } from "../../interfaces/balancer/IBalancerVault.sol";
import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
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

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Balancer's strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of BAL & AURA
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                WETH, stETH -> skipping the BPT token on the 0 position
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // BAL & AURA
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external virtual override onlyGovernor initializer {
        maxWithdrawalDeviation = 1e16;
        maxDepositDeviation = 1e16;

        emit MaxWithdrawalDeviationUpdated(0, maxWithdrawalDeviation);
        emit MaxDepositDeviationUpdated(0, maxDepositDeviation);

        IERC20[] memory poolAssets = _getPoolAssets();
        require(
            // aside from BPT token all assets must be supported
            poolAssets.length - 1 == _assets.length,
            "Pool assets length mismatch"
        );
        for (uint256 i = 0; i < _assets.length; ++i) {
            address asset = _fromPoolAsset(address(poolAssets[i + 1]));
            require(_assets[i] == asset, "Pool assets mismatch");
        }

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    function _getUserDataEncodedAmountsIn(uint256[] memory _amountsIn)
        internal
        view
        virtual
        override
        returns (uint256[] memory amountsIn)
    {
        // first asset in the Composable stable pool is the BPT token.
        // skip over that entry and shift all other assets for 1 position
        // to the left
        amountsIn = new uint256[](_amountsIn.length - 1);
        for (uint256 i = 0; i < _amountsIn.length - 1; ++i) {
            amountsIn[i] = _amountsIn[i + 1];
        }
    }
}
