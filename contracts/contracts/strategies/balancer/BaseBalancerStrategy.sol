// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Base Balancer Abstract Strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IBalancerVault } from "../../interfaces/balancer/IBalancerVault.sol";
import { IRateProvider } from "../../interfaces/balancer/IRateProvider.sol";
import { IOracle } from "../../interfaces/IOracle.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IWstETH } from "../../interfaces/IWstETH.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { StableMath } from "../../utils/StableMath.sol";

import "hardhat/console.sol";

abstract contract BaseBalancerStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;
    IBalancerVault internal immutable balancerVault =
        IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);
    address internal immutable stEth =
        0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
    address internal immutable wstEth =
        0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
    address internal immutable frxEth =
        0x5E8422345238F34275888049021821E8E08CAa1f;
    address internal immutable sfrxEth =
        0xac3E018457B222d93114458476f3E3416Abbe38F;

    address internal pTokenAddress;
    bytes32 internal balancerPoolId;
    // Full list of all assets as they are present in the Balancer pool
    address[] internal poolAssetsMapped;
    // Max withdrawal slippage denominated in 1e18 (1e18 == 100%) - TODO better name also considered with deposits
    uint256 public maxWithdrawalSlippage;
    int256[50] private __reserved;

    event MaxWithdrawalSlippageUpdated(
        uint256 _prevMaxSlippagePercentage,
        uint256 _newMaxSlippagePercentage
    );

    /**
     * @dev Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return assetToPToken[_asset] != address(0);
    }

    function checkBalance(address _asset)
        external
        view
        virtual
        override
        returns (uint256)
    {
        (
            IERC20[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangeBlock
        ) = balancerVault.getPoolTokens(balancerPoolId);
        // yourPoolShare denominated in 1e18. (1e18 == 100%)
        uint256 yourPoolShare = IERC20(pTokenAddress)
            .balanceOf(address(this))
            .divPrecisely(IERC20(pTokenAddress).totalSupply());

        uint256 balancesLength = balances.length;
        for (uint256 i = 0; i < balances.length; ++i) {
            (address poolAsset, ) = toPoolAsset(_asset, 0);

            if (address(tokens[i]) == poolAsset) {
                return balances[i].mulTruncate(yourPoolShare);
            }
        }
    }

    function getMinBPTExpected(
        address _asset,
        uint256 _amount,
        address _poolAsset,
        uint256 _poolAmount
    ) internal view virtual returns (uint256 minBptAmount) {
        /* minBPT price is calculated by dividing the pool (sometimes wrapped) market price by the
         * rateProviderRate of that asset:
         *
         * minBptPrice = pool_a_oracle_price / pool_a_rate
         *
         * Since we only have oracle prices for the unwrapped version of the assets the equation
         * turns into:
         *
         * minBptPrice = from_pool_token(asset_oracle_price) / pool_a_rate
         *
         */
        console.log("getMinBPTExpected function");
        console.log("_poolAsset");
        console.log(_poolAsset);
        uint256 rateProviderRate = getRateProviderRate(_poolAsset);
        address priceProvider = IVault(vaultAddress).priceProvider();
        uint256 marketPrice = IOracle(priceProvider).price(_asset);

        console.log("market price");
        console.log(marketPrice); // 1000000000000000000
        console.log("rate provider price");
        console.log(rateProviderRate); // 1000000000000000000
        (, uint256 assetAmount) = fromPoolAsset(_poolAsset, 1e18);
        console.log("fromPoolAsset assetAmount");
        console.log(assetAmount);
        uint256 minBPTnoSlippage = assetAmount
            .mulTruncate(marketPrice)
            .divPrecisely(rateProviderRate)
            .mulTruncate(_amount);
        console.log("minBPTnoSlippage");
        console.log(minBPTnoSlippage);
        minBptAmount =
            minBPTnoSlippage -
            minBPTnoSlippage.mulTruncate(maxWithdrawalSlippage);
        console.log("minBptAmount with slippage");
        console.log(minBptAmount);
    }

    function getRateProviderRate(address _asset)
        internal
        view
        virtual
        returns (uint256);

    function _lpDepositAll() internal virtual {}

    function _lpWithdrawAll() internal virtual {}

    /**
     * Balancer returns assets and rateProviders for corresponding assets ordered
     * by numerical order.
     */
    function getPoolAssets() internal view returns (IERC20[] memory assets) {
        (
            IERC20[] memory tokens,
            uint256[] memory balances,
            uint256 lastChangeBlock
        ) = balancerVault.getPoolTokens(balancerPoolId);
        return tokens;
    }

    /**
     * Balancer pools might have wrapped versions of assets that the strategy
     * is handling. This function takes care of the conversion:
     * strategy asset -> pool asset
     */
    function toPoolAsset(address asset, uint256 amount)
        internal
        view
        returns (address poolAsset, uint256 poolAmount)
    {
        poolAmount = 0;
        // if stEth
        if (asset == stEth) {
            // wstEth
            poolAsset = wstEth;
            if (amount > 0) {
                poolAmount = IWstETH(wstEth).getWstETHByStETH(amount);
            }
            // if frxEth
        } else if (asset == frxEth) {
            // sfrxEth
            poolAsset = sfrxEth;
            if (amount > 0) {
                poolAmount = IERC4626(sfrxEth).convertToShares(amount);
            }
        } else {
            poolAsset = asset;
            poolAmount = amount;
        }
    }

    function wrapPoolAsset(address asset, uint256 amount)
        internal
        returns (uint256 wrappedAmount)
    {
        // if stEth
        if (asset == stEth) {
            wrappedAmount = IWstETH(wstEth).wrap(amount);
            // if frxEth
        } else if (asset == frxEth) {
            wrappedAmount = IERC4626(sfrxEth).deposit(amount, address(this));
        } else {
            wrappedAmount = amount;
        }
    }

    function unwrapPoolAsset(address asset, uint256 amount)
        internal
        returns (uint256 wrappedAmount)
    {
        // if stEth
        if (asset == stEth) {
            wrappedAmount = IWstETH(wstEth).unwrap(amount);
            // if frxEth
        } else if (asset == frxEth) {
            wrappedAmount = IERC4626(sfrxEth).withdraw(
                amount,
                address(this),
                address(this)
            );
        } else {
            wrappedAmount = amount;
        }
    }

    function fromPoolAsset(address poolAsset, uint256 poolAmount)
        internal
        view
        returns (address asset, uint256 amount)
    {
        amount = 0;
        // if wstEth
        if (poolAsset == wstEth) {
            // stEth
            asset = stEth;
            if (poolAmount > 0) {
                amount = IWstETH(wstEth).getStETHByWstETH(poolAmount);
            }
            // if frxEth
        } else if (poolAsset == sfrxEth) {
            // sfrxEth
            asset = frxEth;
            if (poolAmount > 0) {
                amount = IERC4626(sfrxEth).convertToAssets(poolAmount);
            }
        } else {
            asset = poolAsset;
            amount = poolAmount;
        }
    }

    /**
     * @dev Sets max withdrawal slippage that is considered when removing
     * liquidity from Balancer pools.
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

    function _approveBase() internal virtual {
        IERC20 pToken = IERC20(pTokenAddress);
        // Balancer vault for BPT token (required for removing liquidity)
        pToken.safeApprove(address(balancerVault), 0);
        pToken.safeApprove(address(balancerVault), type(uint256).max);
    }
}
