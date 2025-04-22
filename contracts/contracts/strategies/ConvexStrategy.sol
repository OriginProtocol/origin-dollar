// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurvePool } from "./ICurvePool.sol";
import { IRewardStaking } from "./IRewardStaking.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IERC20, AbstractCurveStrategy, InitializableAbstractStrategy } from "./AbstractCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

/*
 * IMPORTANT(!) If ConvexStrategy needs to be re-deployed, it requires new
 * proxy contract with fresh storage slots. Changes in `AbstractCurveStrategy`
 * storage slots would break existing implementation.
 *
 * Remove this notice if ConvexStrategy is re-deployed
 */
contract ConvexStrategy is AbstractCurveStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    address internal cvxDepositorAddress;
    address internal cvxRewardStakerAddress;
    // slither-disable-next-line constable-states
    address private _deprecated_cvxRewardTokenAddress;
    uint256 internal cvxDepositorPTokenId;

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
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

        InitializableAbstractStrategy._initialize(
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

    function _lpWithdraw(uint256 numCrvTokens) internal override {
        uint256 gaugePTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );

        // Not enough in this contract or in the Gauge, can't proceed
        require(numCrvTokens > gaugePTokens, "Insufficient 3CRV balance");

        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards to this
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            numCrvTokens,
            true
        );
    }

    function _lpWithdrawAll() internal override {
        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards to this
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            IRewardStaking(cvxRewardStakerAddress).balanceOf(address(this)),
            true
        );
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
        uint256 gaugePTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );
        uint256 totalPTokens = contractPTokens + gaugePTokens;

        ICurvePool curvePool = ICurvePool(platformAddress);
        if (totalPTokens > 0) {
            uint256 virtual_price = curvePool.get_virtual_price();
            uint256 value = (totalPTokens * virtual_price) / 1e18;
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            balance = value.scaleBy(assetDecimals, 18) / 3;
        }
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
