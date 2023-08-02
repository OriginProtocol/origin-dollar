// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Base Balancer Abstract Strategy
 * @author Origin Protocol Inc
 */

import { BaseBalancerStrategy } from "./BaseBalancerStrategy.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IRateProvider } from "../../interfaces/balancer/IRateProvider.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { StableMath } from "../../utils/StableMath.sol";
import { IRewardStaking } from "../IRewardStaking.sol";

abstract contract BaseAuraStrategy is BaseBalancerStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /// @notice Address of the Aura rewards pool
    address public immutable auraRewardPoolAddress;

    // renamed from __reserved to not shadow BaseBalancerStrategy.__reserved,
    int256[50] private __reserved_2;

    constructor(address _auraRewardPoolAddress) {
        auraRewardPoolAddress = _auraRewardPoolAddress;
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Balancer's strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of BAL & AURA
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                WETH, stETH
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // BAL & AURA
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external override onlyGovernor initializer {
        maxWithdrawalSlippage = 1e15;
        maxDepositSlippage = 1e15;

        IERC20[] memory poolAssets = getPoolAssets();
        require(
            poolAssets.length == _assets.length,
            "Pool assets length mismatch"
        );
        for (uint256 i = 0; i < _assets.length; ++i) {
            (address asset, ) = fromPoolAsset(address(poolAssets[i]), 0);
            require(_assets[i] == asset, "Pool assets mismatch");
        }

        super._initialize(_rewardTokenAddresses, _assets, _pTokens);
        _approveBase();
    }

    /**
     * @dev Deposit all Balancer Pool Tokens (BPT) in this strategy contract
     * to the Aura rewards pool.
     */
    function _lpDepositAll() internal virtual override {
        uint256 bptBalance = IERC20(platformAddress).balanceOf(address(this));
        uint256 auraLp = IERC4626(auraRewardPoolAddress).deposit(
            bptBalance,
            address(this)
        );
        require(bptBalance == auraLp, "Aura LP != BPT");
    }

    /**
     * @dev Withdraw `numBPTTokens` Balancer Pool Tokens (BPT) from
     * the Aura rewards pool to this strategy contract.
     * @param numBPTTokens Number of Balancer Pool Tokens (BPT) to withdraw
     */
    function _lpWithdraw(uint256 numBPTTokens) internal virtual override {
        IRewardStaking(auraRewardPoolAddress).withdrawAndUnwrap(
            numBPTTokens,
            true // also claim reward tokens
        );
    }
    
    /**
     * @dev Withdraw all Balancer Pool Tokens (BPT) from
     * the Aura rewards pool to this strategy contract.
     */
    function _lpWithdrawAll() internal virtual override {
        // Get all the strategy's BPTs in Aura
        // maxRedeem is implemented as balanceOf(address) in Aura
        uint256 bptBalance = IERC4626(auraRewardPoolAddress).maxRedeem(
            address(this)
        );

        IRewardStaking(auraRewardPoolAddress).withdrawAndUnwrap(
            bptBalance,
            true // also claim reward tokens
        );
    }

    /**
     * @notice Collects BAL and AURA tokens from the rewards pool.
     */
    function collectRewardTokens()
        external
        virtual
        override
        onlyHarvester
        nonReentrant
    {
        // Collect BAL and AURA
        IRewardStaking(auraRewardPoolAddress).getReward();
        _collectRewardTokens();
    }

    /// @notice Balancer Pool Tokens (BPT) in the Balancer pool and the Aura rewards pool.
    function _getBalancerPoolTokens()
        internal
        view
        override
        returns (uint256 balancerPoolTokens)
    {
        balancerPoolTokens =
            IERC20(platformAddress).balanceOf(address(this)) +
            // maxRedeem is implemented as balanceOf(address) in Aura
            IERC4626(auraRewardPoolAddress).maxRedeem(address(this));
    }

    function _approveBase() internal virtual override {
        super._approveBase();

        IERC20 pToken = IERC20(platformAddress);
        pToken.safeApprove(auraRewardPoolAddress, 0);
        pToken.safeApprove(auraRewardPoolAddress, type(uint256).max);
    }
}
