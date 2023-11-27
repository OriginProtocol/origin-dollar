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

    // Max withdrawal deviation denominated in 1e18 (1e18 == 100%)
    uint256 public maxWithdrawalDeviation;
    // Max deposit deviation denominated in 1e18 (1e18 == 100%)
    uint256 public maxDepositDeviation;

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

    event MaxWithdrawalDeviationUpdated(
        uint256 _prevMaxDeviationPercentage,
        uint256 _newMaxDeviationPercentage
    );
    event MaxDepositDeviationUpdated(
        uint256 _prevMaxDeviationPercentage,
        uint256 _newMaxDeviationPercentage
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
    ) external onlyGovernor initializer {
        maxWithdrawalDeviation = 1e16;
        maxDepositDeviation = 1e16;

        emit MaxWithdrawalDeviationUpdated(0, maxWithdrawalDeviation);
        emit MaxDepositDeviationUpdated(0, maxDepositDeviation);

        IERC20[] memory poolAssets = _getPoolAssets();
        require(
            poolAssets.length == _assets.length,
            "Pool assets length mismatch"
        );
        for (uint256 i = 0; i < _assets.length; ++i) {
            address asset = _fromPoolAsset(address(poolAssets[i]));
            require(_assets[i] == asset, "Pool assets mismatch");
        }

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
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
        require(assetToPToken[_asset] != address(0), "Unsupported asset");

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
        if (_toPoolAsset(_asset) == _asset) {
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
     * @notice BPT price is calculated by taking the rate from the rateProvider of the asset in
     * question. If one does not exist it defaults to 1e18. To get the final BPT expected that
     * is multiplied by the underlying asset amount divided by BPT token rate. BPT token rate is
     * similar to Curve's virtual_price and expresses how much has the price of BPT appreciated
     * (e.g. due to swap fees) in relation to the underlying assets
     *
     * Using the above approach makes the strategy vulnerable to a possible MEV attack using
     * flash loan to manipulate the pool before a deposit/withdrawal since the function ignores
     * market values of the assets being priced in BPT.
     *
     * At the time of writing there is no safe on-chain approach to pricing BPT in a way that it
     * would make it invulnerable to MEV pool manipulation. See recent Balancer exploit:
     * https://www.notion.so/originprotocol/Balancer-OETH-strategy-9becdea132704e588782a919d7d471eb?pvs=4#1cf07de12fc64f1888072321e0644348
     *
     * To mitigate MEV possibilities during deposits and withdraws, the VaultValueChecker will use checkBalance before and after the move
     * to ensure the expected changes took place.
     *
     * @param _asset Address of the Balancer pool asset
     * @param _amount Amount of the Balancer pool asset
     * @return bptExpected of BPT expected in exchange for the asset
     *
     * @dev
     * bptAssetPrice = 1e18 (asset peg) * pool_asset_rate
     *
     * bptExpected = bptAssetPrice * asset_amount / BPT_token_rate
     *
     * bptExpected = 1e18 (asset peg) * pool_asset_rate * asset_amount / BPT_token_rate
     * bptExpected = asset_amount * pool_asset_rate / BPT_token_rate
     *
     * further information available here:
     * https://www.notion.so/originprotocol/Balancer-OETH-strategy-9becdea132704e588782a919d7d471eb?pvs=4#ce01495ae70346d8971f5dced809fb83
     */
    /* solhint-enable max-line-length */
    function _getBPTExpected(address _asset, uint256 _amount)
        internal
        view
        virtual
        returns (uint256 bptExpected)
    {
        uint256 bptRate = IRateProvider(platformAddress).getRate();
        uint256 poolAssetRate = _getRateProviderRate(_asset);
        bptExpected = _amount.mulTruncate(poolAssetRate).divPrecisely(bptRate);
    }

    function _getBPTExpected(
        address[] memory _assets,
        uint256[] memory _amounts
    ) internal view virtual returns (uint256 bptExpected) {
        require(_assets.length == _amounts.length, "Assets & amounts mismatch");

        for (uint256 i = 0; i < _assets.length; ++i) {
            uint256 poolAssetRate = _getRateProviderRate(_assets[i]);
            // convert asset amount to ETH amount
            bptExpected += _amounts[i].mulTruncate(poolAssetRate);
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
        // slither-disable-next-line unused-return
        (assets, , ) = balancerVault.getPoolTokens(balancerPoolId);
    }

    /**
     * @dev If an asset is rebasing the Balancer pools have a wrapped versions of assets
     * that the strategy supports. This function converts the pool(wrapped) asset
     * and corresponding amount to strategy asset.
     */
    function _toPoolAsset(address asset, uint256 amount)
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
    function _toPoolAsset(address asset) internal view returns (address) {
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
    function _wrapPoolAsset(address asset, uint256 amount)
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
    function _unwrapPoolAsset(address asset, uint256 amount)
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
    function _fromPoolAsset(address poolAsset, uint256 poolAmount)
        internal
        view
        returns (address asset, uint256 amount)
    {
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

    function _fromPoolAsset(address poolAsset)
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
     * @notice Sets max withdrawal deviation that is considered when removing
     * liquidity from Balancer pools.
     * @param _maxWithdrawalDeviation Max withdrawal deviation denominated in
     *        wad (number with 18 decimals): 1e18 == 100%, 1e16 == 1%
     *
     * IMPORTANT Minimum maxWithdrawalDeviation will be 1% (1e16) for production
     * usage. Vault value checker in combination with checkBalance will
     * catch any unexpected manipulation.
     */
    function setMaxWithdrawalDeviation(uint256 _maxWithdrawalDeviation)
        external
        onlyVaultOrGovernorOrStrategist
    {
        require(
            _maxWithdrawalDeviation <= 1e18,
            "Withdrawal dev. out of bounds"
        );
        emit MaxWithdrawalDeviationUpdated(
            maxWithdrawalDeviation,
            _maxWithdrawalDeviation
        );
        maxWithdrawalDeviation = _maxWithdrawalDeviation;
    }

    /**
     * @notice Sets max deposit deviation that is considered when adding
     * liquidity to Balancer pools.
     * @param _maxDepositDeviation Max deposit deviation denominated in
     *        wad (number with 18 decimals): 1e18 == 100%, 1e16 == 1%
     *
     * IMPORTANT Minimum maxDepositDeviation will default to 1% (1e16)
     * for production usage. Vault value checker in combination with
     * checkBalance will catch any unexpected manipulation.
     */
    function setMaxDepositDeviation(uint256 _maxDepositDeviation)
        external
        onlyVaultOrGovernorOrStrategist
    {
        require(_maxDepositDeviation <= 1e18, "Deposit dev. out of bounds");
        emit MaxDepositDeviationUpdated(
            maxDepositDeviation,
            _maxDepositDeviation
        );
        maxDepositDeviation = _maxDepositDeviation;
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
