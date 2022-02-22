// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IRewardStaking } from "./IRewardStaking.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IERC20, BaseCurveStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

contract ConvexStrategy is BaseCurveStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    address internal cvxDepositorAddress;
    address internal cvxRewardStakerAddress;
    // slither-disable-next-line constable-states
    address public _deprecated_cvxRewardTokenAddress;
    uint256 internal cvxDepositorPTokenId;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the Curve 3pool
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     * @param _cvxDepositorAddress Address of the Convex depositor(AKA booster) for this pool
     * @param _cvxRewardStakerAddress Address of the CVX rewards staker
     * @param _cvxDepositorPTokenId Pid of the pool referred to by Depositor and staker
     */
    function initialize(
        address _platformAddress, // 3Pool address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // CRV + CVX
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
        pTokenAddress = _pTokens[0];

        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    function _lpDepositAll() internal override {
        IERC20 pToken = IERC20(pTokenAddress);
        // Deposit with staking
        bool success = IConvexDeposits(cvxDepositorAddress).deposit(
            cvxDepositorPTokenId,
            pToken.balanceOf(address(this)),
            true
        );
        require(success, "Failed to deposit to Convex");
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
        totalPTokens = contractPTokens + gaugePTokens;
    }

    function _approveBase() internal override {
        IERC20 pToken = IERC20(pTokenAddress);
        // 3Pool for LP token (required for removing liquidity)
        pToken.safeApprove(platformAddress, 0);
        pToken.safeApprove(platformAddress, type(uint256).max);
        // Gauge for LP token
        pToken.safeApprove(cvxDepositorAddress, 0);
        pToken.safeApprove(cvxDepositorAddress, type(uint256).max);
    }

    /**
     * @dev Collect accumulated CRV and CVX and send to Vault.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect CRV and CVX
        IRewardStaking(cvxRewardStakerAddress).getReward();
        _collectRewardTokens();
    }
}
