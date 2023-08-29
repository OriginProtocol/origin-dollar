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
import { VaultReentrancyLib } from "./VaultReentrancyLib.sol";
import { IOracle } from "../../interfaces/IOracle.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IWstETH } from "../../interfaces/IWstETH.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { StableMath } from "../../utils/StableMath.sol";

abstract contract BaseBalancerStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    address public immutable rETH;
    address public immutable stETH;
    address public immutable wstETH;
    address public immutable frxETH;
    address public immutable sfrxETH;

    /// @notice Address of the Balancer vault
    IBalancerVault public immutable balancerVault;
    /// @notice Balancer pool identifier
    bytes32 public immutable balancerPoolId;

    // Max withdrawal slippage denominated in 1e18 (1e18 == 100%)
    uint256 public maxWithdrawalSlippage;
    // Max deposit slippage denominated in 1e18 (1e18 == 100%)
    uint256 public maxDepositSlippage;

    int256[48] private __reserved;

    struct BaseBalancerConfig {
        address rEthAddress; // Address of the rETH token
        address stEthAddress; // Address of the stETH token
        address wstEthAddress; // Address of the wstETH token
        address frxEthAddress; // Address of the frxEth token
        address sfrxEthAddress; // Address of the sfrxEth token
        address balancerVaultAddress; // Address of the Balancer vault
        bytes32 balancerPoolId; // Balancer pool identifier
    }

    event MaxWithdrawalSlippageUpdated(
        uint256 _prevMaxSlippagePercentage,
        uint256 _newMaxSlippagePercentage
    );
    event MaxDepositSlippageUpdated(
        uint256 _prevMaxSlippagePercentage,
        uint256 _newMaxSlippagePercentage
    );

    /**
     * @dev Ensure we are not in a Vault context when this function is called, by attempting a no-op internal
     * balance operation. If we are already in a Vault transaction (e.g., a swap, join, or exit), the Vault's
     * reentrancy protection will cause this function to revert.
     *
     * Use this modifier with any function that can cause a state change in a pool and is either public itself,
     * or called by a public function *outside* a Vault operation (e.g., join, exit, or swap).
     *
     * This is to protect against Balancer's read-only re-entrancy vulnerability:
     * https://www.notion.so/originprotocol/Balancer-read-only-reentrancy-c686e72c82414ef18fa34312bb02e11b
     */
    modifier whenNotInBalancerVaultContext() {
        VaultReentrancyLib.ensureNotInVaultContext(balancerVault);
        _;
    }

    constructor(BaseBalancerConfig memory _balancerConfig) {
        rETH = _balancerConfig.rEthAddress;
        stETH = _balancerConfig.stEthAddress;
        wstETH = _balancerConfig.wstEthAddress;
        frxETH = _balancerConfig.frxEthAddress;
        sfrxETH = _balancerConfig.sfrxEthAddress;

        balancerVault = IBalancerVault(_balancerConfig.balancerVaultAddress);
        balancerPoolId = _balancerConfig.balancerPoolId;
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
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // BAL & AURA
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external override onlyGovernor initializer {
        maxWithdrawalSlippage = 1e15;
        maxDepositSlippage = 1e15;

        emit MaxWithdrawalSlippageUpdated(0, maxWithdrawalSlippage);
        emit MaxDepositSlippageUpdated(0, maxDepositSlippage);

        IERC20[] memory poolAssets = _getPoolAssets();
        require(
            poolAssets.length == _assets.length,
            "Pool assets length mismatch"
        );
        for (uint256 i = 0; i < _assets.length; ++i) {
            (address asset, ) = fromPoolAsset(address(poolAssets[i]), 0);
            require(_assets[i] == asset, "Pool assets mismatch");
        }

        super._initialize(_rewardTokenAddresses, _assets, _pTokens);
        _approveBase();
    }

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
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

    /**
     * @notice Get strategy's share of an assets in the Balancer pool.
     * This is not denominated in OUSD/ETH value of the assets in the Balancer pool.
     * @param _asset  Address of the Vault collateral asset
     * @return amount  the amount of vault collateral assets
     *
     * IMPORTANT if this function is overridden it needs to have a whenNotInBalancerVaultContext
     * modifier on it or it is susceptible to read-only re-entrancy attack
     *
     * @dev it is important that this function is not affected by reporting inflated
     * values of assets in case of any pool manipulation. Such a manipulation could easily
     * exploit the protocol by:
     *  - minting OETH
     *  - tilting Balancer pool to report higher balances of assets
     *  - rebasing() -> all that extra token balances get distributed to OETH holders
     *  - tilting pool back
     *  - redeeming OETH
     */
    function checkBalance(address _asset)
        external
        view
        virtual
        override
        whenNotInBalancerVaultContext
        returns (uint256 amount)
    {
        uint256 bptBalance = _getBalancerPoolTokens();

        /* To calculate the worth of queried asset:
         *  - assume that all tokens normalized to their ETH value have an equal split balance
         *    in the pool when it is balanced
         *  - multiply the BPT amount with the bpt rate to get the ETH denominated amount
         *    of strategy's holdings
         *  - divide that by the number of tokens we support in the pool to get ETH denominated
         *    amount that is applicable to each supported token in the pool.
         *
         *    It would be possible to support only 1 asset in the pool (and be exposed to all
         *    the assets while holding BPT tokens) and deposit/withdraw/checkBalance using only
         *    that asset. TBD: changes to other functions still required if we ever decide to
         *    go with such configuration.
         */
        amount = (bptBalance.mulTruncate(
            IRateProvider(platformAddress).getRate()
        ) / assetsMapped.length);

        /* If the pool asset is equal to (strategy )_asset it means that a rate
         * provider for that asset exists and that asset is not necessarily
         * pegged to a unit (ETH).
         *
         * Because this function returns the balance of the asset and is not denominated in
         * ETH units we need to convert the ETH denominated amount to asset amount.
         */
        if (toPoolAsset(_asset) == _asset) {
            amount = amount.divPrecisely(_getRateProviderRate(_asset));
        }
    }

    /**
     * @notice Returns the value of all assets managed by this strategy.
     * Uses the Balancer pool's rate (virtual price) to convert the strategy's
     * Balancer Pool Tokens (BPT) to ETH value.
     * @return value The ETH value
     *
     * IMPORTANT if this function is overridden it needs to have a whenNotInBalancerVaultContext
     * modifier on it or it is susceptible to read-only re-entrancy attack
     */
    function checkBalance()
        external
        view
        virtual
        whenNotInBalancerVaultContext
        returns (uint256 value)
    {
        uint256 bptBalance = _getBalancerPoolTokens();

        // Convert BPT to ETH value
        value = bptBalance.mulTruncate(
            IRateProvider(platformAddress).getRate()
        );
    }

    /// @notice Balancer Pool Tokens (BPT) in the Balancer pool.
    function _getBalancerPoolTokens()
        internal
        view
        virtual
        returns (uint256 balancerPoolTokens)
    {
        balancerPoolTokens = IERC20(platformAddress).balanceOf(address(this));
    }

    /* solhint-disable max-line-length */
    /**
     * @notice BPT price is calculated by dividing the pool (sometimes wrapped) market price by the
     * rateProviderRate of that asset. To get BPT expected we need to multiply that by underlying
     * asset amount divided by BPT token rate. BPT token rate is similar to Curve's virtual_price
     * and expresses how much has the price of BPT appreciated in relation to the underlying assets.
     *
     * @dev
     * bptPrice = pool_asset_oracle_price / pool_asset_rate
     *
     * Since we only have oracle prices for the unwrapped version of the assets the equation
     * turns into:
     *
     * bptPrice = from_pool_token(asset_amount).amount * oracle_price / pool_asset_rate
     *
     * bptExpected = bptPrice(in relation to specified asset) * asset_amount / BPT_token_rate
     *
     * and since from_pool_token(asset_amount).amount and pool_asset_rate cancel each-other out
     * this makes the final equation:
     *
     * bptExpected = oracle_price * asset_amount / BPT_token_rate
     *
     * more explanation here:
     * https://www.notion.so/originprotocol/Support-Balancer-OETH-strategy-9becdea132704e588782a919d7d471eb?pvs=4#382834f9815e46a7937f3acca0f637c5
     */
    /* solhint-enable max-line-length */
    function _getBPTExpected(address _asset, uint256 _amount)
        internal
        view
        virtual
        returns (uint256 bptExpected)
    {
        address priceProvider = IVault(vaultAddress).priceProvider();
        uint256 strategyAssetMarketPrice = IOracle(priceProvider).price(_asset);
        uint256 bptRate = IRateProvider(platformAddress).getRate();

        bptExpected = _amount
            .mulTruncate(strategyAssetMarketPrice)
            .divPrecisely(bptRate);
    }

    function _getBPTExpected(address[] memory _assets, uint256[] memory _amounts)
        internal
        view
        virtual
        returns (uint256 bptExpected)
    {
        // Get the oracle from the OETH Vault
        address priceProvider = IVault(vaultAddress).priceProvider();

        for (uint256 i = 0; i < _assets.length; ++i) {
            uint256 strategyAssetMarketPrice = IOracle(priceProvider).price(
                _assets[i]
            );
            // convert asset amount to ETH amount
            bptExpected =
                bptExpected +
                _amounts[i].mulTruncate(strategyAssetMarketPrice);
        }

        uint256 bptRate = IRateProvider(platformAddress).getRate();
        // Convert ETH amount to BPT amount
        bptExpected = bptExpected.divPrecisely(bptRate);
    }

    function _lpDepositAll() internal virtual;

    function _lpWithdraw(uint256 numBPTTokens) internal virtual;

    function _lpWithdrawAll() internal virtual;

    /**
     * @notice Balancer returns assets and rateProviders for corresponding assets ordered
     * by numerical order.
     */
    function _getPoolAssets() internal view returns (IERC20[] memory assets) {
        (assets, , ) = balancerVault.getPoolTokens(balancerPoolId);
    }

    /**
     * @dev If an asset is rebasing the Balancer pools have a wrapped versions of assets
     * that the strategy supports. This function converts the pool(wrapped) asset
     * and corresponding amount to strategy asset.
     */
    function toPoolAsset(address asset, uint256 amount)
        internal
        view
        returns (address poolAsset, uint256 poolAmount)
    {
        if (asset == stETH) {
            poolAsset = wstETH;
            if (amount > 0) {
                poolAmount = IWstETH(wstETH).getWstETHByStETH(amount);
            }
        } else if (asset == frxETH) {
            poolAsset = sfrxETH;
            if (amount > 0) {
                poolAmount = IERC4626(sfrxETH).convertToShares(amount);
            }
        } else {
            poolAsset = asset;
            poolAmount = amount;
        }
    }

    /**
     * @dev Converts a Vault collateral asset to a Balancer pool asset.
     * stETH becomes wstETH, frxETH becomes sfrxETH and everything else stays the same.
     * @param asset Address of the Vault collateral asset.
     * @return Address of the Balancer pool asset.
     */
    function toPoolAsset(address asset) internal view returns (address) {
        if (asset == stETH) {
            return wstETH;
        } else if (asset == frxETH) {
            return sfrxETH;
        }
        return asset;
    }

    /**
     * @dev Converts rebasing asset to its wrapped counterpart.
     */
    function wrapPoolAsset(address asset, uint256 amount)
        internal
        returns (address wrappedAsset, uint256 wrappedAmount)
    {
        if (asset == stETH) {
            wrappedAsset = wstETH;
            if (amount > 0) {
                wrappedAmount = IWstETH(wstETH).wrap(amount);
            }
        } else if (asset == frxETH) {
            wrappedAsset = sfrxETH;
            if (amount > 0) {
                wrappedAmount = IERC4626(sfrxETH).deposit(
                    amount,
                    address(this)
                );
            }
        } else {
            wrappedAsset = asset;
            wrappedAmount = amount;
        }
    }

    /**
     * @dev Converts wrapped asset to its rebasing counterpart.
     */
    function unwrapPoolAsset(address asset, uint256 amount)
        internal
        returns (uint256 unwrappedAmount)
    {
        if (asset == stETH) {
            unwrappedAmount = IWstETH(wstETH).unwrap(amount);
        } else if (asset == frxETH) {
            unwrappedAmount = IERC4626(sfrxETH).withdraw(
                amount,
                address(this),
                address(this)
            );
        } else {
            unwrappedAmount = amount;
        }
    }

    /**
     * @dev If an asset is rebasing the Balancer pools have a wrapped versions of assets
     * that the strategy supports. This function converts the rebasing strategy asset
     * and corresponding amount to wrapped(pool) asset.
     */
    function fromPoolAsset(address poolAsset, uint256 poolAmount)
        internal
        view
        returns (address asset, uint256 amount)
    {
        amount = 0;
        if (poolAsset == wstETH) {
            asset = stETH;
            if (poolAmount > 0) {
                amount = IWstETH(wstETH).getStETHByWstETH(poolAmount);
            }
        } else if (poolAsset == sfrxETH) {
            asset = frxETH;
            if (poolAmount > 0) {
                amount = IERC4626(sfrxETH).convertToAssets(poolAmount);
            }
        } else {
            asset = poolAsset;
            amount = poolAmount;
        }
    }

    function fromPoolAsset(address poolAsset)
        internal
        view
        returns (address asset)
    {
        if (poolAsset == wstETH) {
            asset = stETH;
        } else if (poolAsset == sfrxETH) {
            asset = frxETH;
        } else {
            asset = poolAsset;
        }
    }

    /**
     * @notice Sets max withdrawal slippage that is considered when removing
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

    /**
     * @notice Sets max deposit slippage that is considered when adding
     * liquidity to Balancer pools.
     * @param _maxDepositSlippage Max deposit slippage denominated in
     *        wad (number with 18 decimals): 1e18 == 100%, 1e16 == 1%
     *
     * IMPORTANT Minimum maxDepositSlippage should actually be 0.1% (1e15)
     * for production usage. Contract allows as low value as 0% for confirming
     * correct behavior in test suite.
     */
    function setMaxDepositSlippage(uint256 _maxDepositSlippage)
        external
        onlyVaultOrGovernorOrStrategist
    {
        require(
            _maxDepositSlippage <= 1e18,
            "Max deposit slippage needs to be between 0% - 100%"
        );
        emit MaxDepositSlippageUpdated(maxDepositSlippage, _maxDepositSlippage);
        maxDepositSlippage = _maxDepositSlippage;
    }

    function _approveBase() internal virtual {
        IERC20 pToken = IERC20(platformAddress);
        // Balancer vault for BPT token (required for removing liquidity)
        pToken.safeApprove(address(balancerVault), type(uint256).max);
    }

    function _getRateProviderRate(address _asset)
        internal
        view
        virtual
        returns (uint256);
}
