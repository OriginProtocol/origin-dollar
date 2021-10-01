// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */

import { IRewardStaking } from "./IRewardStaking.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IERC20, BaseCurveStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

contract ConvexStrategy is BaseCurveStrategy {
    using StableMath for uint256;

    event RewardTokenCollected(
        address recipient,
        address token,
        uint256 amount
    );

    address internal cvxDepositorAddress;
    address internal cvxRewardStakerAddress;
    address internal crvRewardTokenAddress;
    uint256 internal cvxDepositorPTokenId;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the Curve 3pool
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddress Address of CRVX
     * @param _crvRewardTokenAddress Address of CRV *yes we get both*
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     * @param _cvxDepositorAddress Address of the Convex depositor(AKA booster) for this pool
     * @param _cvxRewardStakerAddress Address of the CRVX rewards staker
     * @param _cvxDepositorPTokenId Pid of the pool referred to by Depositor and staker
     */
    function initialize(
        address _platformAddress, // 3Pool address
        address _vaultAddress,
        address _rewardTokenAddress, // CRVX
        address _crvRewardTokenAddress,
        address[] calldata _assets,
        address[] calldata _pTokens,
        address _cvxDepositorAddress,
        address _cvxRewardStakerAddress,
        uint256 _cvxDepositorPTokenId
    ) external onlyGovernor initializer {
        require(_assets.length == 3, "Must have exactly three assets");
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        cvxDepositorAddress = _cvxDepositorAddress;
        cvxRewardStakerAddress = _cvxRewardStakerAddress;
        cvxDepositorPTokenId = _cvxDepositorPTokenId;
        crvRewardTokenAddress = _crvRewardTokenAddress;
        pTokenAddress = _pTokens[0];
        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddress,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    function _lpDepositAll() internal override {
        IERC20 pToken = IERC20(pTokenAddress);
        // Deposit with staking
        IConvexDeposits(cvxDepositorAddress).deposit(
            cvxDepositorPTokenId,
            pToken.balanceOf(address(this)),
            true
        );
    }

    function _lpWithdraw(uint256 numPTokens) internal override {
        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards to this
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            numPTokens,
            true
        );
    }

    /**
     * @dev Calculate the total platform token balance (i.e. 3CRV) that exist in
     * this contract or is staked in the Gauge (or in other words, the total
     * amount platform tokens we own).
     * @return contractPTokens Amount of platform tokens in this contract
     * @return gaugePTokens Amount of platform tokens staked in gauge
     * @return totalPTokens Total amount of platform tokens in native decimals
     */
    function _getTotalPTokens()
        internal
        view
        override
        returns (
            uint256 contractPTokens,
            uint256 gaugePTokens, // gauge is a misnomer here, need a better name
            uint256 totalPTokens
        )
    {
        contractPTokens = IERC20(pTokenAddress).balanceOf(address(this));
        gaugePTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        ); //booster.poolInfo[pid].token.balanceOf(address(this)) Not needed if we always stake..
        totalPTokens = contractPTokens.add(gaugePTokens);
    }

    function _approveBase() internal override {
        IERC20 pToken = IERC20(pTokenAddress);
        // 3Pool for LP token (required for removing liquidity)
        pToken.safeApprove(platformAddress, 0);
        pToken.safeApprove(platformAddress, uint256(-1));
        // Gauge for LP token
        pToken.safeApprove(cvxDepositorAddress, 0);
        pToken.safeApprove(cvxDepositorAddress, uint256(-1));
    }

    /**
     * @dev Collect accumulated CRV and send to Vault.
     */
    function collectRewardToken() external override onlyVault nonReentrant {
        // Collect is done automatically with withdrawAndUnwrap
        // Send CVX
        IERC20 crvxToken = IERC20(rewardTokenAddress);
        uint256 balance = crvxToken.balanceOf(address(this));
        emit RewardTokenCollected(vaultAddress, rewardTokenAddress, balance);
        crvxToken.safeTransfer(vaultAddress, balance);
        // Send CRV
        IERC20 crvToken = IERC20(crvRewardTokenAddress);
        balance = crvToken.balanceOf(address(this));
        emit RewardTokenCollected(vaultAddress, crvRewardTokenAddress, balance);
        crvToken.safeTransfer(vaultAddress, balance);
    }
}
