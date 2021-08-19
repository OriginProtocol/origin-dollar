pragma solidity 0.5.11;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */

import { ICurvePool } from "./ICurvePool.sol";
import { ICurveGauge } from "./ICurveGauge.sol";
import { ICRVMinter } from "./ICRVMinter.sol";
import {
    IERC20,
    InitializableAbstractStrategy
} from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";
import { ThreePoolStrategyBase } from "./ThreePoolStrategyBase.sol";

contract ThreePoolStrategy is ThreePoolStrategyBase {
    event RewardTokenCollected(address recipient, uint256 amount);

    address crvGaugeAddress;
    address crvMinterAddress;
    uint256 constant maxSlippage = 1e16; // 1%, same as the Curve UI

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the Curve 3pool
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddress Address of CRV
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     * @param _crvGaugeAddress Address of the Curve DAO gauge for this pool
     * @param _crvMinterAddress Address of the CRV minter for rewards
     */
    function initialize(
        address _platformAddress, // 3Pool address
        address _vaultAddress,
        address _rewardTokenAddress, // CRV
        address[] calldata _assets,
        address[] calldata _pTokens,
        address _crvGaugeAddress,
        address _crvMinterAddress
    ) external onlyGovernor initializer {
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        crvGaugeAddress = _crvGaugeAddress;
        crvMinterAddress = _crvMinterAddress;
        InitializableAbstractStrategy._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddress,
            _assets,
            _pTokens
        );
    }

    // Reward tokens
    // ------------

    /**
     * @dev Setup allowances for rewards
     */
    function _setupRewards(address pToken) internal {
        require(address(pToken) != address(0), "x");
        // Gauge for LP token
        IERC20(pToken).safeApprove(crvGaugeAddress, 0);
        IERC20(pToken).safeApprove(crvGaugeAddress, uint256(-1));
    }

    /**
     * @dev Place 3CRV into from Rewards
     */
    function _depositToRewards() internal {
        // Deposit into Gauge
        // The PToken is the same (3Crv) for all mapped
        // assets, so just get the address from the first one
        IERC20 pToken = IERC20(assetToPToken[assetsMapped[0]]);
        ICurveGauge(crvGaugeAddress).deposit(
            pToken.balanceOf(address(this)),
            address(this)
        );
    }

    /**
     * @dev Get 3CRV from Rewards
     */
    function _withdrawFromRewards(uint256 amount) internal {
        ICurveGauge(crvGaugeAddress).withdraw(amount);
    }

    /**
     * @dev Amount of 3CRV held in rewards
     */
    function _balanceOfPtokensInRewards()
        internal
        view
        returns (uint256 amount)
    {
        ICurveGauge gauge = ICurveGauge(crvGaugeAddress);
        return gauge.balanceOf(address(this));
    }

    /**
     * @dev Collect accumulated CRV and send to Vault.
     */
    function collectRewardToken() external onlyVault nonReentrant {
        // Collect
        ICRVMinter(crvMinterAddress).mint(crvGaugeAddress);
        // Send
        IERC20 crvToken = IERC20(rewardTokenAddress);
        uint256 balance = crvToken.balanceOf(address(this));
        emit RewardTokenCollected(vaultAddress, balance);
        crvToken.safeTransfer(vaultAddress, balance);
    }
}
