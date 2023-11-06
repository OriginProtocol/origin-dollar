// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve Pool Strategy
 * @notice Investment strategy for investing in a Curve pool. eg 3Pool
 * @dev This strategy can NOT be set as the Vault's default strategy for an asset.
 * This is because deposits and withdraws can be sandwich attacked if not protected
 * by the `VaultValueChecker`. Only the trusted `Strategist` or `Governor` can call
 * the Vault deposit and withdraw functions for a strategy. When they do, they must call
 * `VaultValueChecker.takeSnapshot` before and `VaultValueChecker.checkDelta` afterwards.
 *
 * When implementing for a new Curve pool, read-only reentrancy needs to be checked.
 * This is possible in some Curve pools when using native ETH or a token that has hooks
 * that can hijack execution. For example, the Curve ETH/stETH pool is vulnerable to
 * read-only reentry.
 * https://x.com/danielvf/status/1657019677544001536
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurvePool } from "./curve/ICurvePool.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";

struct CurveFunctions {
    function(uint256[] memory, uint256) add_liquidity;
    function(uint256, uint256[] memory) remove_liquidity;
    function(
        uint256,
        uint256,
        uint256,
        address,
        address
    ) remove_liquidity_imbalance;
    function(uint256, uint256) view returns (uint256) calcWithdrawLpAmount;
}

abstract contract BaseCurveStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice Max allowed slippage of deposits and withdrawals to/from the Curve pool.
    /// 1e16 = 1%, same as the Curve UI
    uint256 public constant MAX_SLIPPAGE = 1e16;
    /// @notice number of assets in the Curve pool. eg 3 for the 3Pool
    uint256 public immutable CURVE_POOL_ASSETS_COUNT;
    /// @notice Address of the Curve pool contract
    address public immutable CURVE_POOL;
    /// @notice Address of the Curve pool's liquidity provider (LP) token.
    /// This can be different to the Curve pool. For example, 3Pool's 3Crv LP token.
    address public immutable CURVE_LP_TOKEN;

    // Only supporting up to 3 coins for now.
    // The new Stableswap pools support up to 8 coins, but
    // we'll add support for more than 3 pools later if needed.
    /// @notice The address of the first asset in the Curve pool
    address public immutable coin0;
    /// @notice The address of the second asset in the Curve pool
    address public immutable coin1;
    /// @notice The address of the third asset in the Curve pool.
    /// If only two assets in the Curve pool, this will be address(0).
    address public immutable coin2;
    /// @notice The number of decimals of the first asset in the Curve pool
    uint256 public immutable decimals0;
    /// @notice The number of decimals of the second asset in the Curve pool
    uint256 public immutable decimals1;
    /// @notice The number of decimals of the third asset in the Curve pool
    /// If only two assets in the Curve pool, this will be 0.
    uint256 public immutable decimals2;

    // slither-disable-next-line constable-states
    address private deprecated_pTokenAddress;

    int256[49] private __reserved;

    struct CurveConfig {
        uint256 curvePoolAssetsCount;
        address curvePool;
        address curveLpToken;
    }

    constructor(CurveConfig memory _curveConfig) {
        // Only support Curve pools with 2 or 3 coins for now.
        require(
            _curveConfig.curvePoolAssetsCount == 2 ||
                _curveConfig.curvePoolAssetsCount == 3,
            "Invalid Curve base assets"
        );
        require(_curveConfig.curvePool != address(0), "Invalid Curve pool");
        require(
            Helpers.getDecimals(_curveConfig.curveLpToken) == 18,
            "Invalid Curve LP token"
        );

        CURVE_POOL_ASSETS_COUNT = _curveConfig.curvePoolAssetsCount;
        CURVE_POOL = _curveConfig.curvePool;
        CURVE_LP_TOKEN = _curveConfig.curveLpToken;

        address asset0 = ICurvePool(_curveConfig.curvePool).coins(0);
        coin0 = asset0;
        decimals0 = Helpers.getDecimals(asset0);

        address asset1 = ICurvePool(_curveConfig.curvePool).coins(1);
        coin1 = asset1;
        decimals1 = Helpers.getDecimals(asset1);

        // Only get the address of the third coin (index 2) if a three coin pool
        address asset2 = _curveConfig.curvePoolAssetsCount == 3
            ? ICurvePool(_curveConfig.curvePool).coins(2)
            : address(0);
        coin2 = asset2;
        decimals2 = _curveConfig.curvePoolAssetsCount == 3
            ? Helpers.getDecimals(asset2)
            : 0;
    }

    function getCurveFunctions()
        internal
        pure
        virtual
        returns (CurveFunctions memory);

    /**
     * @notice Deposit a vault asset into the Curve pool.
     * This assumes the vault has already transferred the asset to this strategy contract.
     *
     * `deposit` must be protected by the `VaultValueChecker` when the `Strategist` or `Governor`
     * calls `depositToStrategy` on the `Vault`.
     *
     * @dev An invalid `_asset` will fail in `_getCoinIndex` with "Unsupported asset".
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        virtual
        override
        onlyVault
        nonReentrant
    {
        require(_amount > 0, "Must deposit something");
        emit Deposit(_asset, CURVE_POOL, _amount);

        // Curve requires passing deposit amounts for all assets
        uint256[] memory _amounts = new uint256[](CURVE_POOL_ASSETS_COUNT);
        uint256 poolCoinIndex = _getCoinIndex(_asset);

        // Set the amount of the asset we want to deposit
        _amounts[poolCoinIndex] = _amount;

        // Calculate the minimum amount of Curve LP tokens by converting the deposit amount
        // to the Curve pool's LP token value and reducing by the max slippage.
        uint256 depositValue = _amount
            .scaleBy(18, _getAssetDecimals(_asset))
            .divPrecisely(ICurvePool(CURVE_POOL).get_virtual_price());
        uint256 minMintAmount = depositValue.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Do the deposit to the Curve pool using a Curve library that
        // abstracts the number of coins in the Curve pool.
        CurveFunctions memory curveFunctions = getCurveFunctions();
        curveFunctions.add_liquidity(_amounts, minMintAmount);

        _lpDepositAll();
    }

    /**
     * @dev Deposit all Curve LP tokens in the strategy to a
     * Curve metapool, gauge or Convex pool.
     */
    function _lpDepositAll() internal virtual;

    /**
     * @notice Deposit the entire balance of the Curve pool assets in this strategy contract.
     * This assumes the vault has already transferred the assets to this strategy contract.
     *
     * `deposit` must be protected by the `VaultValueChecker` when the `Strategist` or `Governor`
     * calls `depositToStrategy` on the `Vault`.
     */
    function depositAll() external virtual override onlyVault nonReentrant {
        uint256[] memory _amounts = new uint256[](CURVE_POOL_ASSETS_COUNT);
        uint256 totalScaledAmount = 0;

        // For each of the Curve pool's assets
        for (uint256 i = 0; i < CURVE_POOL_ASSETS_COUNT; ++i) {
            address assetAddress = _getAsset(i);
            uint256 balance = IERC20(assetAddress).balanceOf(address(this));
            if (balance > 0) {
                // Set the amount on the asset we want to deposit
                _amounts[i] = balance;
                // Scale the asset amount up to 18 decimals and add to the total deposit amount scaled to 18 decimals
                totalScaledAmount += balance.scaleBy(
                    18,
                    _getAssetDecimals(assetAddress)
                );

                emit Deposit(assetAddress, CURVE_POOL, balance);
            }
        }

        // Get the Curve pool's virtual price
        uint256 curveVirtualPrice = ICurvePool(CURVE_POOL).get_virtual_price();

        // Reduce the total deposit amount scaled to 18 decimals by the max allowed slippage
        uint256 minMintAmount = totalScaledAmount
            .mulTruncate(uint256(1e18) - MAX_SLIPPAGE)
            .divPrecisely(curveVirtualPrice);

        // Do the deposit to the Curve pool using a Curve library that
        // abstracts the number of coins in the Curve pool.
        CurveFunctions memory curveFunctions = getCurveFunctions();
        curveFunctions.add_liquidity(_amounts, minMintAmount);

        /* In case of Curve Strategy all assets are mapped to the same Curve LP token, eg 3CRV.
         * Let descendants further handle the Curve LP token by either deploying to a Curve Metapool,
         * a Curve gauge or a Convex pool.
         */
        _lpDepositAll();
    }

    /***************************************
                    Withdraws
    ****************************************/

    /**
     * @dev Withdraw Curve LP tokens from a Curve metapool, gauge or Convex pool.
     */
    function _lpWithdraw(uint256 curveLpTokens) internal virtual;

    /**
     * @dev Withdraw all the strategy's Curve LP tokens from a Curve metapool, gauge or Convex pool.
     */
    function _lpWithdrawAll() internal virtual;

    /**
     * @notice Withdraw a single asset from the Curve pool.
     *
     * `withdraw` must be protected by the `VaultValueChecker` when the `Strategist` or `Governor`
     * calls `withdrawFromStrategy` on the `Vault`.
     *
     * @dev An invalid `_asset` will fail in `_getCoinIndex` with "Unsupported asset".
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");

        emit Withdrawal(_asset, CURVE_POOL, _amount);

        uint256 curveLpTokensInStrategy = IERC20(CURVE_LP_TOKEN).balanceOf(
            address(this)
        );

        // This also validates the asset is supported by the strategy
        uint256 coinIndex = _getCoinIndex(_asset);

        // Calculate the amount of Curve LP tokens required to withdraw the asset.
        // Depending on the implementation, this may be a little more than
        // what's required which will leave a small amount of Curve LP tokens
        // in this strategy contract. This will be picked up on the next deposit or withdraw.
        CurveFunctions memory curveFunctions = getCurveFunctions();
        uint256 maxCurveLpTokens = curveFunctions.calcWithdrawLpAmount(
            coinIndex,
            _amount
        );

        // We have enough LP tokens, make sure they are all on this contract
        if (curveLpTokensInStrategy < maxCurveLpTokens) {
            _lpWithdraw(maxCurveLpTokens - curveLpTokensInStrategy);
        }

        // Withdraw asset from the Curve pool and transfer to the recipient
        curveFunctions.remove_liquidity_imbalance(
            _amount,
            coinIndex,
            maxCurveLpTokens,
            _asset,
            _recipient
        );
    }

    /**
     * @notice Remove all assets from the Curve pool and send them to Vault contract.
     * @dev This must be protected by the `VaultValueChecker` when the `Strategist` or `Governor`
     * calls `withdrawAllFromStrategy` or `withdrawAllFromStrategies` on the `Vault`.
     * This will include all assets in the Curve pool and this strategy contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        _lpWithdrawAll();

        // Withdraws are proportional to assets held by Curve pool
        uint256[] memory minWithdrawAmounts = new uint256[](
            CURVE_POOL_ASSETS_COUNT
        );

        // Remove liquidity
        CurveFunctions memory curveFunctions = getCurveFunctions();
        curveFunctions.remove_liquidity(
            IERC20(CURVE_LP_TOKEN).balanceOf(address(this)),
            minWithdrawAmounts
        );

        // Transfer each asset out of the strategy to the Vault.
        // Note that Curve will provide all of the assets in the pool even if
        // we have not set PToken addresses for all of them in this strategy
        for (uint256 i = 0; i < CURVE_POOL_ASSETS_COUNT; ++i) {
            IERC20 asset = IERC20(_getAsset(i));
            uint256 balance = asset.balanceOf(address(this));
            if (balance > 0) {
                asset.safeTransfer(vaultAddress, balance);

                emit Withdrawal(address(asset), CURVE_POOL, balance);
            }
        }
    }

    /***************************************
                    Approvals
    ****************************************/

    /**
     * @notice Approve the spending of all assets by their corresponding pool tokens,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        _approveBase();
        // Approve each of the strategy's assets
        for (uint256 i = 0; i < CURVE_POOL_ASSETS_COUNT; ++i) {
            _approveAsset(_getAsset(i));
        }
    }

    /**
     * @dev Call the necessary approvals for the Curve pool and gauge
     * @param _asset Address of the asset
     */
    function _abstractSetPToken(address _asset, address) internal override {
        _approveAsset(_asset);
    }

    function _approveAsset(address _asset) internal {
        IERC20 asset = IERC20(_asset);
        // Approve the Curve pool, eg 3Pool, to transfer an asset (required for adding liquidity)
        // Need to handle USDT so have to set to zero first

        // slither-disable-next-line unused-return
        asset.approve(CURVE_POOL, 0);
        // slither-disable-next-line unused-return
        asset.approve(CURVE_POOL, type(uint256).max);
    }

    function _approveBase() internal virtual;

    /***************************************
                Curve pool helpers
    ****************************************/

    /**
     * @dev Get the Curve pool index of the asset.
     * This is reading from immutable variables to avoid costly storage reads.
     * Revert if the `_asset` is not supported by the Curve pool.
     */
    function _getCoinIndex(address _asset)
        internal
        view
        virtual
        returns (uint256 coinIndex)
    {
        // This check is needed for Curve pools with only two assets as
        // coin2, the third coin, will be address(0)
        require(_asset != address(0), "Invalid asset");

        if (_asset == coin0) {
            return 0;
        } else if (_asset == coin1) {
            return 1;
        } else if (_asset == coin2) {
            return 2;
        }
        revert("Unsupported asset");
    }

    /**
     * @dev Get the number of decimals of the asset token.
     * This is reading from immutable variables to avoid costly storage reads.
     * Revert if the `_asset` is not supported by the Curve pool.
     * @param _asset Address of the asset token.
     */
    function _getAssetDecimals(address _asset)
        internal
        view
        returns (uint256 decimals)
    {
        // This check is needed for Curve pools with only two assets as
        // coin2, the third coin, will be address(0)
        require(_asset != address(0), "Invalid asset");

        if (_asset == coin0) {
            return decimals0;
        } else if (_asset == coin1) {
            return decimals1;
        } else if (_asset == coin2) {
            return decimals2;
        }
        revert("Unsupported asset");
    }

    /**
     * @dev Get the token address for a given index value in a Curve pool.
     * This is reading from immutable variables to avoid costly storage reads.
     * Revert if the `_coinIndex` is not supported by the Curve pool.
     * @param _coinIndex Index value of the coin in the Curve pool.
     * Can be checked using Curve's `coins` getter method.
     */
    function _getAsset(uint256 _coinIndex)
        internal
        view
        returns (address asset)
    {
        if (_coinIndex == 0) {
            return coin0;
        } else if (_coinIndex == 1) {
            return coin1;
        } else if (_coinIndex == 2) {
            return coin2;
        }
        revert("Invalid coin index");
    }

    /***************************************
            Asset/coin validation
    ****************************************/

    /**
     * @notice Retuns bool indicating whether vault asset is supported by the strategy
     * @param _vaultAsset Address of the vault asset
     */
    function supportsAsset(address _vaultAsset)
        public
        view
        override
        returns (bool result)
    {
        result = _curveSupportedCoin(_vaultAsset);
    }

    /**
     * @dev validates that an asset is a coin in the Curve pool
     * @param _coin Address of the coin in the Curve pool
     */
    function _curveSupportedCoin(address _coin)
        internal
        view
        returns (bool result)
    {
        result =
            _coin != address(0) &&
            (_coin == coin0 || _coin == coin1 || _coin == coin2);
    }

    /***************************************
            Abstract Strategy Overrides
    ****************************************/

    function _setPTokenAddress(address _asset, address _pToken)
        internal
        override
    {
        require(_curveSupportedCoin(_asset), "Not a Curve pool coin");
        InitializableAbstractStrategy._setPTokenAddress(_asset, _pToken);
    }

    /**
     * @notice Can not add a new asset after the strategy has been initialized.
     */
    function setPTokenAddress(address, address) external pure override {
        revert("Unsupported");
    }

    /**
     * @notice Can not remove an asset from the strategy as checkBalance
     * assumes all assets are in the Curve pool are supported.
     */
    function removePToken(uint256) external pure override {
        revert("Unsupported");
    }
}
