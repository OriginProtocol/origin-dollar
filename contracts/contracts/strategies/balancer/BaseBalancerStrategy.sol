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
    IBalancerVault internal immutable balancerVault = IBalancerVault(0xBA12222222228d8Ba445958a75a0704d566BF2C8);

    address internal auraDepositorAddress;
    address internal auraRewardStakerAddress;
    uint256 internal auraDepositorPTokenId;
    address internal pTokenAddress;
    bytes32 internal balancerPoolId;
    // Max withdrawal slippage denominated in 1e18 (1e18 == 100%)
    uint256 public maxWithdrawalSlippage;
    int256[50] private __reserved;

    event MaxWithdrawalSlippageUpdated(
        uint256 _prevMaxSlippagePercentage,
        uint256 _newMaxSlippagePercentage
    );

    struct InitConfig {
        address platformAddress; // platformAddress Address of the Balancer's pool
        address vaultAddress; // vaultAddress Address of the vault
        address auraDepositorAddress; // auraDepositorAddress Address of the Auraa depositor(AKA booster) for this pool
        address auraRewardStakerAddress; // auraRewardStakerAddress Address of the Aura rewards staker
        uint256 auraDepositorPTokenId; // auraDepositorPTokenId Address of the Aura rewards staker
        bytes32 balancerPoolId; // balancerPoolId bytes32 poolId
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Balancer's strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of BAL & AURA
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                WETH, stETH
     * @param _pTokens Platform Token corresponding addresses
     * @param initConfig additional configuration
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // BAL & AURA
        address[] calldata _assets,
        address[] calldata _pTokens,
        InitConfig calldata initConfig
    ) external onlyGovernor initializer {
        auraDepositorAddress = initConfig.auraDepositorAddress;
        auraRewardStakerAddress = initConfig.auraRewardStakerAddress;
        auraDepositorPTokenId = initConfig.auraDepositorPTokenId;
        pTokenAddress = _pTokens[0];
        maxWithdrawalSlippage = 1e15;
        balancerPoolId = initConfig.balancerPoolId;
        IERC20[] memory poolAssets = getPoolAssets();
        uint256 assetsLength = _assets.length;
        require (poolAssets.length == assetsLength, "Pool assets and _assets should be the same length.");
        for (uint256 i = 0; i < assetsLength; ++i) {
            (address strategyAsset, ) = fromPoolAsset(address(poolAssets[i]), 0);
            require(_assets[i] == strategyAsset, "Pool assets and _assets should all have the same numerical order.");
        }

        super._initialize(
            initConfig.platformAddress,
            initConfig.vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

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
        override
        returns (uint256)
    {
        (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = balancerVault.getPoolTokens(balancerPoolId);
        // TODO: override in AURA implementation
        uint256 yourPoolShare = IERC20(pTokenAddress).balanceOf(address(this)) / IERC20(pTokenAddress).totalSupply();
        
        uint256 balancesLength = balances.length;
        for (uint256 i=0; i < balances.length; ++i){
            if(address(tokens[i]) == _asset) {
                return balances[i] * yourPoolShare;
            }
        }
    }



    function getMinBPTExpected(address _asset, uint256 _amount)
        internal
        view
        virtual
        returns (uint256 minBptAmount)
    {
        address priceProvider = IVault(vaultAddress).priceProvider();
        uint256 marketPrice = IOracle(priceProvider).price(_asset);
        uint256 rateProviderRate = getRateProviderRate(_asset);

        // TODO: account for some slippage?
        return marketPrice.divPrecisely(rateProviderRate);
    }

    function getRateProviderRate(address _asset) internal virtual view returns(uint256);

    function _lpDepositAll() internal virtual
    {

    }

    function _lpWithdrawAll() internal virtual
    {
        
    }

    /**
     * Balancer returns assets and rateProviders for corresponding assets ordered 
     * by numerical order.
     */
    function getPoolAssets()
        internal
        view
        returns(IERC20[] memory assets)
    {
        (IERC20[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock) = balancerVault.getPoolTokens(balancerPoolId);
        return tokens;
    }

    /**
     * Balancer pools might have wrapped versions of assets that the strategy
     * is handling. This function takes care of the conversion: 
     * strategy asset -> pool asset
     */
    function toPoolAsset(address asset, uint256 amount)
        view
        internal
        returns(address poolAsset, uint256 poolAmount)
    {
        // if stEth
        if (asset == 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84) {
            // wstEth
            poolAsset = 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0;
            poolAmount = IWstETH(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0).getWstETHByStETH(amount);
        // if frxEth
        } else if (asset == 0x5E8422345238F34275888049021821E8E08CAa1f) {
            // sfrxEth
            poolAsset = 0xac3E018457B222d93114458476f3E3416Abbe38F;
            poolAmount = IERC4626(0xac3E018457B222d93114458476f3E3416Abbe38F).convertToShares(amount);
        } else {
            poolAsset = asset;
            poolAmount = amount;
        }
    }

    function wrapPoolAsset(address asset, uint256 amount)
        internal
        returns(uint256 wrappedAmount)
    {
        // if stEth
        if (asset == 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84) {
            wrappedAmount = IWstETH(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0).wrap(amount);
        // if frxEth
        } else if (asset == 0x5E8422345238F34275888049021821E8E08CAa1f) {
            wrappedAmount = IERC4626(0xac3E018457B222d93114458476f3E3416Abbe38F).deposit(amount, address(this));
        } else {
            wrappedAmount = amount;
        }
    }

    function unwrapPoolAsset(address asset, uint256 amount)
        internal
        returns(uint256 wrappedAmount)
    {
        // if stEth
        if (asset == 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84) {
            wrappedAmount = IWstETH(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0).unwrap(amount);
        // if frxEth
        } else if (asset == 0x5E8422345238F34275888049021821E8E08CAa1f) {
            wrappedAmount = IERC4626(0xac3E018457B222d93114458476f3E3416Abbe38F).withdraw(amount, address(this), address(this));
        } else {
            wrappedAmount = amount;
        }
    }

    function fromPoolAsset(address asset, uint256 amount)
        view
        internal
        returns(address strategyAsset, uint256 strategyAmount)
    {
        // if wstEth
        if (asset == 0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0) {
            // stEth
            strategyAsset = 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84;
            strategyAmount = IWstETH(0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0).getStETHByWstETH(amount);
        // if frxEth
        } else if (asset == 0xac3E018457B222d93114458476f3E3416Abbe38F) {
            // sfrxEth
            strategyAsset = 0x5E8422345238F34275888049021821E8E08CAa1f;
            strategyAmount = IERC4626(0xac3E018457B222d93114458476f3E3416Abbe38F).convertToAssets(amount);
        } else {
            strategyAsset = asset;
            strategyAmount = amount;
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

    function _approveBase() internal {
        IERC20 pToken = IERC20(pTokenAddress);
        // Balancer vault for BPT token (required for removing liquidity)
        pToken.safeApprove(address(balancerVault), 0);
        pToken.safeApprove(address(balancerVault), type(uint256).max);

        // Gauge for LP token
        pToken.safeApprove(auraDepositorAddress, 0);
        pToken.safeApprove(auraDepositorAddress, type(uint256).max);
    }

}