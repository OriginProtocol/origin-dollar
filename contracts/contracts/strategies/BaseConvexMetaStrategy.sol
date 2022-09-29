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

    address internal cvxDepositorAddress;
    address internal cvxRewardStakerAddress;
    uint256 internal cvxDepositorPTokenId;
    ICurveMetaPool internal metapool;
    IERC20 internal metapoolMainToken;
    IERC20 internal metapoolLPToken;
    // Ordered list of metapool assets
    address[] internal metapoolAssets;
    uint128 crvCoinIndex;
    uint128 mainCoinIndex;

    int256[30] private _reserved;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     * @param _initAddresses Various addresses containing the following:
     *  - _platformAddress Address of the Curve 3pool
     *  - _vaultAddress Address of the vault
     *  - _cvxDepositorAddress Address of the Convex depositor(AKA booster) for this pool
     *  - _metapoolAddress Address of the Curve MetaPool
     *  - _metapoolMainToken Address of Main metapool token
     *  - _cvxRewardStakerAddress Address of the CVX rewards staker
     * @param _cvxDepositorPTokenId Pid of the pool referred to by Depositor and staker
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + CVX
        address[] calldata _assets,
        address[] calldata _pTokens,
        /**
         * in the following order: _platformAddress(3Pool address), _vaultAddress, _cvxDepositorAddress
         * _metapoolAddress, _metapoolMainToken, _cvxRewardStakerAddress, _metapoolLPToken
         */
        address[] calldata _initAddresses,
        uint256 _cvxDepositorPTokenId
    ) external onlyGovernor initializer {
        require(_assets.length == 3, "Must have exactly three assets");
        require(
            _initAddresses.length == 7,
            "_initAddresses must have exactly seven items"
        );
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        cvxDepositorAddress = _initAddresses[2];
        pTokenAddress = _pTokens[0];
        metapool = ICurveMetaPool(_initAddresses[3]);
        metapoolMainToken = IERC20(_initAddresses[4]);
        cvxRewardStakerAddress = _initAddresses[5];
        metapoolLPToken = IERC20(_initAddresses[6]);
        cvxDepositorPTokenId = _cvxDepositorPTokenId;

        metapoolAssets = [metapool.coins(0), metapool.coins(1)];
        crvCoinIndex = _getMetapoolCoinIndex(pTokenAddress);
        mainCoinIndex = _getMetapoolCoinIndex(_initAddresses[4]);
        super._initialize(
            _initAddresses[0],
            _initAddresses[1],
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
