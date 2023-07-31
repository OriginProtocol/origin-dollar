// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurveGauge } from "./ICurveGauge.sol";
import { ICurvePool } from "./ICurvePool.sol";
import { ICRVMinter } from "./ICRVMinter.sol";
import { IERC20, BaseCurveStrategy, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

/*
 * IMPORTANT(!) If ThreePoolStrategy needs to be re-deployed, it requires new
 * proxy contract with fresh storage slots. Changes in `BaseCurveStrategy`
 * storage slots would break existing implementation.
 *
 * Remove this notice if ThreePoolStrategy is re-deployed
 */
contract ThreePoolStrategy is BaseCurveStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    address internal crvGaugeAddress;
    address internal crvMinterAddress;

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddress Address of CRV
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     * @param _crvGaugeAddress Address of the Curve DAO gauge for this pool
     * @param _crvMinterAddress Address of the CRV minter for rewards
     */
    function initialize(
        address[] calldata _rewardTokenAddress, // CRV
        address[] calldata _assets,
        address[] calldata _pTokens,
        address _crvGaugeAddress,
        address _crvMinterAddress
    ) external onlyGovernor initializer {
        require(_assets.length == 3, "Must have exactly three assets");
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        crvGaugeAddress = _crvGaugeAddress;
        crvMinterAddress = _crvMinterAddress;
        pTokenAddress = _pTokens[0];
        super._initialize(_rewardTokenAddress, _assets, _pTokens);
        _approveBase();
    }

    function _lpDepositAll() internal override {
        IERC20 pToken = IERC20(pTokenAddress);
        // Deposit into Gauge
        ICurveGauge(crvGaugeAddress).deposit(
            pToken.balanceOf(address(this)),
            address(this)
        );
    }

    function _lpWithdraw(uint256 numPTokens) internal override {
        // Not enough of pool token exists on this contract, some must be
        // staked in Gauge, unstake difference
        ICurveGauge(crvGaugeAddress).withdraw(numPTokens);
    }

    function _lpWithdrawAll() internal override {
        ICurveGauge gauge = ICurveGauge(crvGaugeAddress);
        gauge.withdraw(gauge.balanceOf(address(this)));
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(assetToPToken[_asset] != address(0), "Unsupported asset");
        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety

        uint256 contractPTokens = IERC20(pTokenAddress).balanceOf(
            address(this)
        );
        ICurveGauge gauge = ICurveGauge(crvGaugeAddress);
        uint256 gaugePTokens = gauge.balanceOf(address(this));
        uint256 totalPTokens = contractPTokens + gaugePTokens;

        ICurvePool curvePool = ICurvePool(platformAddress);
        if (totalPTokens > 0) {
            uint256 virtual_price = curvePool.get_virtual_price();
            uint256 value = (totalPTokens * virtual_price) / 1e18;
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            balance = value.scaleBy(assetDecimals, 18) / 3;
        }
    }

    function _approveBase() internal override {
        IERC20 pToken = IERC20(pTokenAddress);
        // 3Pool for LP token (required for removing liquidity)
        pToken.safeApprove(platformAddress, 0);
        pToken.safeApprove(platformAddress, type(uint256).max);
        // Gauge for LP token
        pToken.safeApprove(crvGaugeAddress, 0);
        pToken.safeApprove(crvGaugeAddress, type(uint256).max);
    }

    /**
     * @dev Collect accumulated CRV and send to Vault.
     */
    function collectRewardTokens() public override onlyHarvester nonReentrant {
        // Collect
        ICRVMinter(crvMinterAddress).mint(crvGaugeAddress);
        // Send
        IERC20 crvToken = IERC20(rewardTokenAddresses[0]);
        uint256 balance = crvToken.balanceOf(address(this));
        emit RewardTokenCollected(
            harvesterAddress,
            rewardTokenAddresses[0],
            balance
        );
        crvToken.safeTransfer(harvesterAddress, balance);
    }
}
