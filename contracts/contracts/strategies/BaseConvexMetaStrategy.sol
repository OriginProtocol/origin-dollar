// SPDX-License-Identifier: agpl-3.0
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
import { IERC20, BaseCurveStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

abstract contract BaseConvexMetaStrategy is BaseCurveStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;
    event MaxWithdrawalSlippageUpdated(
        uint256 _prevMaxSlippagePercentage,
        uint256 _newMaxSlippagePercentage
    );

    // used to circumvent the stack too deep issue
    struct InitState {
        address platformAddress; //Address of the Curve 3pool
        address vaultAddress; //Address of the vault
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
    uint256 public maxWithdrawalSlippage = 1e16;
    uint128 crvCoinIndex;
    uint128 mainCoinIndex;

    int256[30] private __reserved;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     * @param initState Various addresses and info for initialization state
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + CVX
        address[] calldata _assets,
        address[] calldata _pTokens,
        InitState calldata initState
    ) external onlyGovernor initializer {
        require(_assets.length == 3, "Must have exactly three assets");
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        cvxDepositorAddress = initState.cvxDepositorAddress;
        pTokenAddress = _pTokens[0];
        metapool = ICurveMetaPool(initState.metapoolAddress);
        metapoolMainToken = IERC20(initState.metapoolMainToken);
        cvxRewardStakerAddress = initState.cvxRewardStakerAddress;
        metapoolLPToken = IERC20(initState.metapoolLPToken);
        cvxDepositorPTokenId = initState.cvxDepositorPTokenId;

        metapoolAssets = [metapool.coins(0), metapool.coins(1)];
        crvCoinIndex = _getMetapoolCoinIndex(pTokenAddress);
        mainCoinIndex = _getMetapoolCoinIndex(initState.metapoolMainToken);
        super._initialize(
            initState.platformAddress,
            initState.vaultAddress,
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

        uint256 metapoolPTokens = metapoolLPToken.balanceOf(address(this));
        uint256 metapoolGaugePTokens = IRewardStaking(cvxRewardStakerAddress)
            .balanceOf(address(this));
        uint256 metapoolTotalPTokens = metapoolPTokens + metapoolGaugePTokens;

        if (metapoolTotalPTokens > 0) {
            uint256 metapool_virtual_price = metapool.get_virtual_price();
            uint256 value = (metapoolTotalPTokens * metapool_virtual_price) /
                1e18;
            balance += value;
        }

        uint256 assetDecimals = Helpers.getDecimals(_asset);
        balance = balance.scaleBy(assetDecimals, 18) / 3;
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
     *
     * 1e18 == 100%, 1e16 == 1%
     */
    function setMaxWithdrawalSlippage(uint256 _maxWithdrawalSlippage)
        external
        onlyVaultOrGovernorOrStrategist
    {
        require(
            _maxWithdrawalSlippage >= 1e15 && _maxWithdrawalSlippage <= 1e17,
            "Max withdrawal slippage needs to be between 0.1% - 10%"
        );
        emit MaxWithdrawalSlippageUpdated(
            maxWithdrawalSlippage,
            _maxWithdrawalSlippage
        );
        maxWithdrawalSlippage = _maxWithdrawalSlippage;
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

    /**
     * @dev If x a negative number return 0 else return x
     */
    function toPositive(int256 x) internal pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(0);
    }
}
