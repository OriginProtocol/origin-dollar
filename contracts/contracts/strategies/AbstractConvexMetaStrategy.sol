// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IRewardStaking } from "./IRewardStaking.sol";
import { ICurvePool } from "./ICurvePool.sol";
import { ICurveMetaPool } from "./ICurveMetaPool.sol";
import { IERC20, AbstractCurveStrategy, InitializableAbstractStrategy } from "./AbstractCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

abstract contract AbstractConvexMetaStrategy is AbstractCurveStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    event MaxWithdrawalSlippageUpdated(
        uint256 _prevMaxSlippagePercentage,
        uint256 _newMaxSlippagePercentage
    );

    // used to circumvent the stack too deep issue
    struct InitConfig {
        address cvxDepositorAddress; //Address of the Convex depositor(AKA booster) for this pool
        address metapoolAddress; //Address of the Curve MetaPool
        address metapoolMainToken; //Address of Main metapool token
        address cvxRewardStakerAddress; //Address of the CVX rewards staker
        address metapoolLPToken; //Address of metapool LP token
        uint256 cvxDepositorPTokenId; //Pid of the pool referred to by Depositor and staker
    }

    address internal cvxDepositorAddress;
    address internal cvxRewardStakerAddress;
    uint256 internal cvxDepositorPTokenId;
    ICurveMetaPool internal metapool;
    IERC20 internal metapoolMainToken;
    IERC20 internal metapoolLPToken;
    // Ordered list of metapool assets
    address[] internal metapoolAssets;
    // Max withdrawal slippage denominated in 1e18 (1e18 == 100%)
    uint256 public maxWithdrawalSlippage;
    uint128 internal crvCoinIndex;
    uint128 internal mainCoinIndex;

    int256[41] private ___reserved;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     * @param initConfig Various addresses and info for initialization state
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + CVX
        address[] calldata _assets,
        address[] calldata _pTokens,
        InitConfig calldata initConfig
    ) external onlyGovernor initializer {
        require(_assets.length == 3, "Must have exactly three assets");
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        cvxDepositorAddress = initConfig.cvxDepositorAddress;
        pTokenAddress = _pTokens[0];
        metapool = ICurveMetaPool(initConfig.metapoolAddress);
        metapoolMainToken = IERC20(initConfig.metapoolMainToken);
        cvxRewardStakerAddress = initConfig.cvxRewardStakerAddress;
        metapoolLPToken = IERC20(initConfig.metapoolLPToken);
        cvxDepositorPTokenId = initConfig.cvxDepositorPTokenId;
        maxWithdrawalSlippage = 1e16;

        metapoolAssets = [metapool.coins(0), metapool.coins(1)];
        crvCoinIndex = _getMetapoolCoinIndex(pTokenAddress);
        mainCoinIndex = _getMetapoolCoinIndex(initConfig.metapoolMainToken);
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        virtual
        override
        returns (uint256 balance)
    {
        require(assetToPToken[_asset] != address(0), "Unsupported asset");
        balance = 0;

        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 contractPTokens = IERC20(pTokenAddress).balanceOf(
            address(this)
        );
        ICurvePool curvePool = ICurvePool(platformAddress);
        if (contractPTokens > 0) {
            uint256 virtual_price = curvePool.get_virtual_price();
            uint256 value = contractPTokens.mulTruncate(virtual_price);
            balance += value;
        }

        /* We intentionally omit the metapoolLp tokens held by the metastrategyContract
         * since the contract should never (except in the middle of deposit/withdrawal
         * transaction) hold any amount of those tokens in normal operation. There
         * could be tokens sent to it by a 3rd party and we decide to actively ignore
         * those.
         */
        uint256 metapoolGaugePTokens = IRewardStaking(cvxRewardStakerAddress)
            .balanceOf(address(this));

        if (metapoolGaugePTokens > 0) {
            uint256 value = metapoolGaugePTokens.mulTruncate(
                metapool.get_virtual_price()
            );
            balance += value;
        }

        uint256 assetDecimals = Helpers.getDecimals(_asset);
        balance = balance.scaleBy(assetDecimals, 18) / THREEPOOL_ASSET_COUNT;
    }

    /**
     * @dev This function is completely analogous to _calcCurveTokenAmount[AbstractCurveStrategy]
     * and just utilizes different Curve (meta)pool API
     */
    function _calcCurveMetaTokenAmount(uint128 _coinIndex, uint256 _amount)
        internal
        returns (uint256 requiredMetapoolLP)
    {
        uint256[2] memory _amounts = [uint256(0), uint256(0)];
        _amounts[uint256(_coinIndex)] = _amount;

        // LP required when removing required asset ignoring fees
        uint256 lpRequiredNoFees = metapool.calc_token_amount(_amounts, false);
        /* LP required if fees would apply to entirety of removed amount
         *
         * fee is 1e10 denominated number: https://curve.readthedocs.io/exchange-pools.html#StableSwap.fee
         */
        uint256 lpRequiredFullFees = lpRequiredNoFees.mulTruncateScale(
            1e10 + metapool.fee(),
            1e10
        );

        /* asset received when withdrawing full fee applicable LP accounting for
         * slippage and fees
         */
        uint256 assetReceivedForFullLPFees = metapool.calc_withdraw_one_coin(
            lpRequiredFullFees,
            int128(_coinIndex)
        );

        // exact amount of LP required
        requiredMetapoolLP =
            (lpRequiredFullFees * _amount) /
            assetReceivedForFullLPFees;
    }

    function _approveBase() internal override {
        IERC20 pToken = IERC20(pTokenAddress);
        // 3Pool for LP token (required for removing liquidity)
        pToken.safeApprove(platformAddress, 0);
        pToken.safeApprove(platformAddress, type(uint256).max);
        // Gauge for LP token
        metapoolLPToken.safeApprove(cvxDepositorAddress, 0);
        metapoolLPToken.safeApprove(cvxDepositorAddress, type(uint256).max);
        // Metapool for LP token
        pToken.safeApprove(address(metapool), 0);
        pToken.safeApprove(address(metapool), type(uint256).max);
        // Metapool for Metapool main token
        metapoolMainToken.safeApprove(address(metapool), 0);
        metapoolMainToken.safeApprove(address(metapool), type(uint256).max);
    }

    /**
     * @dev Get the index of the coin
     */
    function _getMetapoolCoinIndex(address _asset)
        internal
        view
        returns (uint128)
    {
        for (uint128 i = 0; i < 2; i++) {
            if (metapoolAssets[i] == _asset) return i;
        }
        revert("Invalid Metapool asset");
    }

    /**
     * @dev Sets max withdrawal slippage that is considered when removing
     * liquidity from Metapools.
     * @param _maxWithdrawalSlippage Max withdrawal slippage denominated in
     *        wad (number with 18 decimals): 1e18 == 100%, 1e16 == 1%
     *
     * IMPORTANT Minimum maxWithdrawalSlippage should actually be 0.1% (1e15)
     * for production usage. Contract allows as low value as 0% for confirming
     * correct behavior in test suite.
     */
    function setMaxWithdrawalSlippage(uint256 _maxWithdrawalSlippage)
        external
        onlyVaultOrGovernorOrStrategist
    {
        require(
            _maxWithdrawalSlippage <= 1e18,
            "Max withdrawal slippage needs to be between 0% - 100%"
        );
        emit MaxWithdrawalSlippageUpdated(
            maxWithdrawalSlippage,
            _maxWithdrawalSlippage
        );
        maxWithdrawalSlippage = _maxWithdrawalSlippage;
    }

    /**
     * @dev Collect accumulated CRV and CVX and send to Harvester.
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

    /**
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }
}
