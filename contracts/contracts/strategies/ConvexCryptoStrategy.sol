// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve CryptoSwap with Curve Gauge staking Strategy
 * @notice Investment into Curve CryptoSwap, eg TryLSD, and Liquidity Provider (LP) tokens in a Convex pool.
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICurveGauge } from "./curve/ICurveGauge.sol";
import { ICurveCrypto } from "./curve/ICurveCrypto.sol";
import { CurveFunctions, CurveCryptoFunctions } from "./curve/CurveCryptoFunctions.sol";
import { IERC20, BaseCurveStrategy, InitializableAbstractStrategy } from "./BaseCurveStrategy.sol";
import { ConvexStrategy } from "./ConvexStrategy.sol";
import { IRewardStaking } from "./IRewardStaking.sol";
import { IOracle } from "../interfaces/IOracle.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWstETH } from "../interfaces/IWstETH.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";

contract ConvexCryptoStrategy is CurveCryptoFunctions, ConvexStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    /// @notice The address of the vault collateral asset that is associated with
    // the first coin in the Curve pool
    address public immutable vaultAsset0;
    /// @notice The address of the vault collateral asset that is associated with
    // the second coin in the Curve pool
    address public immutable vaultAsset1;
    /// @notice The address of the vault collateral asset that is associated with
    // the third coin in the Curve pool
    /// If only two assets in the Curve pool, this will be address(0).
    address public immutable vaultAsset2;

    /// @notice unwrapped, rebasing vault asset
    address public immutable stETH;
    /// @notice wrapped, non-rebasing counterpart for stETH
    address public immutable wstETH;
    /// @notice unwrapped, rebasing vault asset
    address public immutable frxETH;
    /// @notice wrapped, non-rebasing counterpart for frxETH
    address public immutable sfrxETH;

    struct ConvexCryptoConfig {
        address stEthAddress; // Address of the stETH token
        address wstEthAddress; // Address of the wstETH token
        address frxEthAddress; // Address of the frxEth token
        address sfrxEthAddress; // Address of the sfrxEth token
        address[] vaultAssetAddresses;
    }

    constructor(
        BaseStrategyConfig memory _stratConfig,
        CurveConfig memory _curveConfig,
        ConvexConfig memory _convexConfig,
        ConvexCryptoConfig memory _convexCryptoConfig
    )
        InitializableAbstractStrategy(_stratConfig)
        BaseCurveStrategy(_curveConfig)
        ConvexStrategy(_convexConfig)
        CurveCryptoFunctions(_curveConfig.curvePool)
    {
        require(
            _convexCryptoConfig.vaultAssetAddresses.length ==
                _curveConfig.curvePoolAssetsCount
        );
        vaultAsset0 = _convexCryptoConfig.vaultAssetAddresses[0];
        vaultAsset1 = _convexCryptoConfig.vaultAssetAddresses[1];
        // curvePoolAssetsCount is validated to 2 or 3 in BaseCurveStrategy
        vaultAsset2 = _curveConfig.curvePoolAssetsCount == 3
            ? _convexCryptoConfig.vaultAssetAddresses[2]
            : address(0);

        stETH = _convexCryptoConfig.stEthAddress;
        wstETH = _convexCryptoConfig.wstEthAddress;
        frxETH = _convexCryptoConfig.frxEthAddress;
        sfrxETH = _convexCryptoConfig.sfrxEthAddress;
    }

    function getCurveFunctions()
        internal
        pure
        override(BaseCurveStrategy, CurveCryptoFunctions)
        returns (CurveFunctions memory)
    {
        return CurveCryptoFunctions.getCurveFunctions();
    }

    /**
     * @notice Get the asset's share of Curve LP value controlled by this strategy. This is the total value
     * of the Curve LP tokens staked in Convex and held in this strategy contract
     * weighted by the price of each of the Curve pool assets.
     * The weighted average is taken prevent the asset balances being manipulated by tilting the Curve pool.
     * @dev An invalid `_asset` will fail in `_getAssetDecimals` with "Unsupported asset"
     * @param _asset      Address of the asset
     * @return balance    Virtual balance of the asset
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(_curveSupportedCoin(_asset), "Not a Curve pool coin");

        // Curve LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 contractLpTokens = IERC20(CURVE_LP_TOKEN).balanceOf(
            address(this)
        );

        // Get the Curve LP tokens staked in the Convex pool.
        uint256 convexLpTokens = IRewardStaking(cvxRewardStaker).balanceOf(
            address(this)
        );
        uint256 totalLpToken = contractLpTokens + convexLpTokens;

        if (totalLpToken > 0) {
            // get the Strategy's total LP token value priced in the first token of the Curve pool.
            // eg wsthETH for TryLSD
            uint256 totalLpValueInCoin0 = totalLpToken.mulTruncate(
                ICurveCrypto(CURVE_POOL).get_virtual_price()
            );

            // Calculate the total LP token value in the unwrapped,rebasing asset used in the vault.
            // eg stETH for TryLSD
            uint256 totalLpValueInVaultAsset0 = _fromPoolAsset(
                vaultAsset0,
                totalLpValueInCoin0
            );

            // Get the exchange rate provider for the vault. ie the OracleRouter
            address priceProvider = IVault(vaultAddress).priceProvider();
            // Get the exchange rate for converting the vault assets corresponds to the
            // first coin in the Curve pool to OTokens.
            // For example, stETH/OETH for TryLSD.
            uint256 priceVaultAsset0 = IOracle(priceProvider).price(
                vaultAsset0
            );

            // the Strategy's total LP token value priced in OTokens. eg OETH
            // For exmaple, OETH for TryLSD
            uint256 totalLpValueInOTokens = totalLpValueInVaultAsset0 *
                priceVaultAsset0;

            // Divide by the number of assets in the Curve pool. eg 3 for the TryLSD pool.
            // An average is taken to prevent the balances being manipulated by tilting the Curve pool.
            // No matter what the balance of the asset in the Curve pool is, the value of each asset will
            // be the average of the Curve pool's total value in OTokens.
            balance = totalLpValueInOTokens / CURVE_POOL_ASSETS_COUNT;
        }
    }

    /**
     * @notice Deposit a vault asset into the Curve CryptoSwap pool and stake the Curve LP tokens in Convex.
     * This assumes the vault has already transferred the asset to this strategy contract.
     * The vault asset can be converted to a Curve pool asset. eg stETH to wstETH for TryLSD.
     *
     * `deposit` must be protected by the `VaultValueChecker` when the `Strategist` or `Governor`
     * calls `depositToStrategy` on the `Vault`.
     *
     * @dev An invalid `_asset` will fail in `_getCoinIndex` with "Unsupported asset".
     *
     * @param _vaultAsset Address of asset to deposit
     * @param _vaultAssetAmount Amount of vault assets to deposit
     */
    function deposit(address _vaultAsset, uint256 _vaultAssetAmount)
        external
        override
        onlyVault
        nonReentrant
    {
        require(_vaultAssetAmount > 0, "Must deposit something");
        emit Deposit(_vaultAsset, CURVE_POOL, _vaultAssetAmount);

        // Curve requires passing deposit amounts for all assets
        uint256[] memory _poolAmounts = new uint256[](CURVE_POOL_ASSETS_COUNT);
        uint256 poolCoinIndex = _getCoinIndex(_vaultAsset);
        // Convert the vault assets to the Curve pool assets and
        // set the amount of pool assets we are depositing
        _poolAmounts[poolCoinIndex] = _wrapPoolAsset(
            _vaultAsset,
            _vaultAssetAmount
        );

        // Get the exchange rate provider for the vault. ie the OracleRouter
        address priceProvider = IVault(vaultAddress).priceProvider();
        // Get the exchange rate for converting the vault assets corresponds to the
        // first coin in the Curve pool to OTokens.
        // For example, stETH/OETH for TryLSD.
        uint256 priceVaultAsset0 = IOracle(priceProvider).price(vaultAsset0);

        // Calculate the vault asset amount in the vault asset that corresponds to the first coin in the Curve pool.
        // For TryLSD, this convers all vault amounts to stETH.
        uint256 depositAmountInAsset0 = _calcAmountInAsset0(
            priceProvider,
            _vaultAsset,
            _vaultAssetAmount,
            priceVaultAsset0
        );

        // Convert the unwrapped, rebasing deposit amount to wrapped, non-rebaseing deposit amount.
        // For TryLSD, this is the wstETH amount from the stETH amount.
        uint256 depositAmountInCoin0 = _toPoolAsset(
            vaultAsset0,
            depositAmountInAsset0
        );

        // Calculate a fair amount of Curve LP tokens for the deposit amount.
        // For TryLSD, the Curve LP units is wstETH so
        //     virtual price = pool's total value in wstETH / total supply of Curve LP tokens
        // therefore, deposit amount in Curve LP tokens = deposit amount in wstETH / virtual price
        uint256 depositAmountInLp = depositAmountInCoin0.divPrecisely(
            ICurveCrypto(CURVE_POOL).get_virtual_price()
        );
        // The mimimum allowed LP amount = fair LP amount * (1 - max allowed slippage)
        uint256 minLpAmount = depositAmountInLp.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Do the deposit to the Curve pool using a Curve library that
        // abstracts the number of coins in the Curve pool.
        CurveFunctions memory curveFunctions = getCurveFunctions();
        curveFunctions.add_liquidity(_poolAmounts, minLpAmount);

        _lpDepositAll();
    }

    /**
     * @notice Deposit the entire balance of the Curve pool assets in this strategy contract.
     * This assumes the vault has already transferred the assets to this strategy contract.
     *
     * `deposit` must be protected by the `VaultValueChecker` when the `Strategist` or `Governor`
     * calls `depositToStrategy` on the `Vault`.
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256[] memory _poolAmounts = new uint256[](CURVE_POOL_ASSETS_COUNT);
        uint256 totalDepositAmountInAsset0 = 0;

        // Get the exchange rate provider for the vault. ie the OracleRouter
        address priceProvider = IVault(vaultAddress).priceProvider();

        // Get the exchange rate for converting the vault assets corresponds to the
        // first coin in the Curve pool to OTokens.
        // For example, stETH/OETH for TryLSD.
        uint256 priceVaultAsset0 = IOracle(priceProvider).price(vaultAsset0);

        // For each of the Curve pool's assets
        for (uint256 i = 0; i < CURVE_POOL_ASSETS_COUNT; ++i) {
            address vaultAsset = _getAsset(i);
            uint256 vaultAssetBalance = IERC20(vaultAsset).balanceOf(
                address(this)
            );

            if (vaultAssetBalance > 0) {
                // Convert the deposited vault assets to the Curve pool assets and
                // set the amount of pool assets we are depositing
                _poolAmounts[i] = _wrapPoolAsset(vaultAsset, vaultAssetBalance);

                // Calculate the vault asset amount in the vault asset that corresponds to the first coin in the Curve pool.
                // For TryLSD, this convers all vault amounts to stETH.
                totalDepositAmountInAsset0 += _calcAmountInAsset0(
                    priceProvider,
                    vaultAsset,
                    vaultAssetBalance,
                    priceVaultAsset0
                );

                emit Deposit(vaultAsset, CURVE_POOL, vaultAssetBalance);
            }
        }

        // Convert the unwrapped, rebasing deposit amount to wrapped, non-rebaseing deposit amount.
        // For TryLSD, this is the wstETH amount from the total deposit amount in stETH units.
        uint256 totalDepositAmountInCoin0 = _toPoolAsset(
            vaultAsset0,
            totalDepositAmountInAsset0
        );

        // Calculate a fair amount of Curve LP tokens for the deposit amount.
        // For TryLSD, the Curve LP units is wstETH so
        //     virtual price = pool's total value in wstETH / total supply of Curve LP tokens
        // therefore, deposit amount in Curve LP tokens = deposit amount in wstETH / virtual price
        uint256 totalDepositAmountInLp = totalDepositAmountInCoin0.divPrecisely(
            ICurveCrypto(CURVE_POOL).get_virtual_price()
        );
        // The mimimum allowed LP amount = fair LP amount * (1 - max allowed slippage)
        uint256 minLpAmount = totalDepositAmountInLp.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Do the deposit to the Curve pool using a Curve library that
        // abstracts the number of coins in the Curve pool.
        CurveFunctions memory curveFunctions = getCurveFunctions();
        curveFunctions.add_liquidity(_poolAmounts, minLpAmount);

        /* In case of Curve Strategy all assets are mapped to the same Curve LP token, eg 3CRV.
         * Let descendants further handle the Curve LP token by either deploying to a Curve Metapool,
         * a Curve gauge or a Convex pool.
         */
        _lpDepositAll();
    }

    /***************************************
                Curve pool helpers
    ****************************************/

    /**
     * @dev Get the Curve pool index of the associated vault collateral asset.
     * This is reading from immutable variables to avoid costly storage reads.
     * Revert if the `_vaultAsset` is not supported by the strategy.
     *
     * For the TryLSD pool, return 0 for stETH and 2 for frxETH which are associated
     * with the Curve coins wstETH and sfrxETH.
     */
    function _getCoinIndex(address _vaultAsset)
        internal
        view
        override
        returns (uint256 coinIndex)
    {
        // This check is needed for Curve pools with only two assets as
        // coin2, the third coin, will be address(0)
        require(_vaultAsset != address(0), "Invalid asset");

        if (_vaultAsset == vaultAsset0) {
            return 0;
        } else if (_vaultAsset == vaultAsset1) {
            return 1;
        } else if (_vaultAsset == vaultAsset2) {
            return 2;
        }
        revert("Unsupported asset");
    }

    /**
     * @dev Calculates the amount of wrapped, non-rebasing assets used in the Curve pool from
     * the amount of unwrapped, rebasing assets used in the vault.
     * @param vaultAsset Address of the rebasing assets used in the vault.
     * For example, stETH or frxETH
     * @param unwrappedAmount Amount of the rebasing assets used in the vault.
     * For example, the amount of stETH or frxETH
     * @return wrappedAmount The amount of wrapped assets associated with the rebasing asset.
     * For example, the amount of wstETH for stETH or sfrxETH for frxETH.
     */
    function _toPoolAsset(address vaultAsset, uint256 unwrappedAmount)
        internal
        view
        returns (uint256 wrappedAmount)
    {
        if (vaultAsset == stETH) {
            if (unwrappedAmount > 0) {
                wrappedAmount = IWstETH(wstETH).getWstETHByStETH(
                    unwrappedAmount
                );
            }
        } else if (vaultAsset == frxETH) {
            if (unwrappedAmount > 0) {
                wrappedAmount = IERC4626(sfrxETH).previewDeposit(
                    unwrappedAmount
                );
            }
        } else {
            wrappedAmount = unwrappedAmount;
        }
    }

    /**
     * @dev Calculates the amount of unwrapped, rebasing assets used in the vault from
     * the amount of wrapped, non-rebasing assets used in the Curve pool.
     
     * @param wrappedAmount The amount of wrapped, non-rebasing assets used in the Curve pool.
     * For example, the amount of wstETH or sfrxETH.
     * @return unwrappedAmount Amount of the unwrapped, rebasing assets used in the vault.
     * For example, the amount of stETH or frxETH
     */
    function _fromPoolAsset(address poolAsset, uint256 wrappedAmount)
        internal
        view
        returns (uint256 unwrappedAmount)
    {
        if (poolAsset == wstETH) {
            if (wrappedAmount > 0) {
                unwrappedAmount = IWstETH(wstETH).getStETHByWstETH(
                    wrappedAmount
                );
            }
        } else if (poolAsset == sfrxETH) {
            if (wrappedAmount > 0) {
                unwrappedAmount = IERC4626(sfrxETH).convertToAssets(
                    wrappedAmount
                );
            }
        } else {
            unwrappedAmount = wrappedAmount;
        }
    }

    /**
     * @dev Converts a unwrapped, rebasing assets used in the vault to
     * its wrapped, non-rebasing counterpart used in the Curve pool.
     * For exmaple, converts stETH to wstETH or frxETH to sfrxETH.
     * rETH is not rebasing so rETH is returned.
     *
     * @param vaultAsset Address of the unwrapped, rebasing assets used in the vault.
     * For example, stETH or frxETH
     * @param unwrappedAmount Amount of the unwrapped, rebasing assets used in the vault.
     * For example, the amount of stETH or frxETH
     * @return wrappedAmount The amount of wrapped, non-rebasing assets used in the Curve pool.
     * For example, the amount of wstETH or sfrxETH.
     */
    function _wrapPoolAsset(address vaultAsset, uint256 unwrappedAmount)
        internal
        returns (uint256 wrappedAmount)
    {
        if (vaultAsset == stETH) {
            if (unwrappedAmount > 0) {
                wrappedAmount = IWstETH(wstETH).wrap(unwrappedAmount);
            }
        } else if (vaultAsset == frxETH) {
            if (unwrappedAmount > 0) {
                wrappedAmount = IERC4626(sfrxETH).deposit(
                    unwrappedAmount,
                    address(this)
                );
            }
        } else {
            wrappedAmount = unwrappedAmount;
        }
    }

    /**
     * @dev Converts wrapped, non-rebasing assets used in the Curve pool to
     * its unwrapped, rebasing counterpart used in the vault.
     * For exmaple, converts wstETH to stETH or sfrxETH or frxETH.
     *
     * @param vaultAsset Address of the unwrapped, rebasing assets used in the vault. eg stETH or frxETH
     * @param wrappedAmount The amount of wrapped, non-rebasing assets used in the Curve pool.
     * For example, the amount of wstETH or sfrxETH
     * @return unwrappedAmount Amount of the unwrapped, rebasing assets used in the vault.
     * For example, the amount of stETH or frxETH
     */
    function _unwrapPoolAsset(address vaultAsset, uint256 wrappedAmount)
        internal
        returns (uint256 unwrappedAmount)
    {
        if (vaultAsset == stETH) {
            unwrappedAmount = IWstETH(wstETH).unwrap(wrappedAmount);
        } else if (vaultAsset == frxETH) {
            unwrappedAmount = IERC4626(sfrxETH).withdraw(
                wrappedAmount,
                address(this),
                address(this)
            );
        } else {
            unwrappedAmount = wrappedAmount;
        }
    }

    /**
     * @dev Calculates the amount in the vault asset that corresponds to the first coin in the Curve pool.
     * For example, converts vault assets like frxETH and rETH to stETH for TryLSD.
     * @param priceProvider the exchange rate provider for the vault. ie the OracleRouter
     * @param vaultAsset Address of the unwrapped, rebasing assets used in the vault. eg stETH, frxETH or rETH
     * @param vaultAssetAmount the amount of unwrapped, rebasing assets used in the vault.
     * @param priceVaultAsset0 the vault asset that corresponds to the first coin in the Curve pool.
     * For exmaple, stETH for TryLSD
     * @param amountInAsset0 the amount in the vault asset that corresponds to the first coin in the Curve pool.
     * For example, stETH for TryLSD
     */
    function _calcAmountInAsset0(
        address priceProvider,
        address vaultAsset,
        uint256 vaultAssetAmount,
        uint256 priceVaultAsset0
    ) internal returns (uint256 amountInAsset0) {
        // Calculate the minimum amount of Curve LP tokens by converting the deposit amount
        // to the Curve pool's LP token value and reducing by the max allowable slippage.
        // The first token in the Curve pool is the units of Curve pool's LP token.

        // Get the exchange rate for converting the deposited vault assets to OTokens.
        // For example, frxETH/OETH if depositing frxETH.
        uint256 priceDepositAsset = IOracle(priceProvider).price(vaultAsset);

        // Calculate the deposit amount in OTokens = deposit amount in vault assets * vault asset/OToken exchange rate
        // For example, deposit amount in OETH = frxETH amount * frxETH/OETH exchange rate
        uint256 depositAmounntInOTokens = vaultAssetAmount * priceDepositAsset;

        // Calculate the deposit amount in the vault asset that corresponds to the first coin in the Curve pool.
        // For example, stETH value = deposit value in OETH / stETH/OETH exchange rate
        amountInAsset0 = depositAmounntInOTokens / priceVaultAsset0;
    }
}
