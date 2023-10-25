// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Abstract Convex Automated Market Maker (AMO) Strategy
 * @notice Investment strategy for investing assets in Curve and Convex pools
 * @author Origin Protocol Inc
 */
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";
import { IVault } from "../../interfaces/IVault.sol";

abstract contract BaseAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;

    uint256 public constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI

    /// @notice The AMO pool LP token that the strategy invests in
    IERC20 public immutable lpToken;
    /// @notice The OToken that is used in the AMO pool. eg OETH or OUSD
    IERC20 public immutable oToken;
    /// @notice The asset token that is used in the AMO pool. eg WETH, frxETH or 3CRV
    IERC20 public immutable asset;

    // Index position of oToken in AMO pool. For example
    // for OETH/ETH, OETH = 1
    // for OUSD/3CRV, OUSD = 0
    // for frxETH/OUSD, OETH = 1
    uint128 public immutable oTokenCoinIndex;
    // Index position of asset in AMO pool. For example
    // for OETH/ETH, ETH = 0
    // for OUSD/3CRV, 3CRV = 1
    // for frxETH/OUSD, frxETH = 0
    uint128 public immutable assetCoinIndex;

    /// @notice Validates the vault asset is supported by this strategy.
    modifier onlyAsset(address _vaultAsset) {
        require(_isVaultAsset(_vaultAsset), "Unsupported asset");
        _;
    }

    /// @notice Validates all the vault assets are supported by this strategy.
    modifier onlyAssets(address[] memory _vaultAssets) {
        require(_isVaultAssets(_vaultAssets), "Unsupported assets");
        _;
    }

    /// @dev Verifies that the caller is the Strategist
    modifier onlyStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist"
        );
        _;
    }

    /**
     * @dev Checks the AMO pool's balances have improved and the balances
     * have not tipped to the other side.
     */
    modifier improvePoolBalance() {
        // Get the asset and OToken balances in the AMO pool
        uint256[2] memory balancesBefore = _getBalances();
        // diff = asset balance - OToken balance
        int256 diffBefore = int256(balancesBefore[assetCoinIndex]) -
            int256(balancesBefore[oTokenCoinIndex]);

        _;

        // Get the asset and OToken balances in the AMO pool
        uint256[2] memory balancesAfter = _getBalances();
        // diff = asset balance - OToken balance
        int256 diffAfter = int256(balancesAfter[assetCoinIndex]) -
            int256(balancesAfter[oTokenCoinIndex]);

        if (diffBefore <= 0) {
            // If the pool was originally imbalanced in favor of the OToken, then
            // we want to check that the pool is now more balanced
            require(diffAfter <= 0, "OTokens overshot peg");
            require(diffBefore < diffAfter, "OTokens balance worse");
        }
        if (diffBefore >= 0) {
            // If the pool was originally imbalanced in favor of the asset, then
            // we want to check that the pool is now more balanced
            require(diffAfter >= 0, "Assets overshot peg");
            require(diffAfter < diffBefore, "Assets balance worse");
        }
    }

    // Used to circumvent the stack too deep issue
    struct AMOConfig {
        address oTokenAddress; // Address of the OToken. eg OETH or OUSD
        address assetAddress; // Address of the asset token. eg WETH, frxETH or 3CRV
        uint128 oTokenCoinIndex;
        uint128 assetCoinIndex;
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        AMOConfig memory _amoConfig
    ) InitializableAbstractStrategy(_baseConfig) {
        // This assumes the AMO pool and LP token have the same address
        lpToken = IERC20(_baseConfig.platformAddress);
        oToken = IERC20(_amoConfig.oTokenAddress);
        asset = IERC20(_amoConfig.assetAddress);
        oTokenCoinIndex = _amoConfig.oTokenCoinIndex;
        assetCoinIndex = _amoConfig.assetCoinIndex;
    }

    /***************************************
            Vault Asset Validation
    ****************************************/

    /// @dev Validates the vault asset is supported by this strategy.
    /// The default implementation is the vault asset matches the pool asset.
    /// This needs to be overriden for OUSD AMO as the vault assets are DAI, USDC and USDT
    /// while the pool asset is 3CRV.
    /// @param _vaultAsset Address of the vault asset
    function _isVaultAsset(address _vaultAsset)
        internal
        view
        virtual
        returns (bool supported)
    {
        supported = _vaultAsset == address(asset);
    }

    /// @dev Returns bool indicating whether all the assets are supported by this strategy.
    /// The default implementation is the vault asset matches the pool asset.
    /// This needs to be overriden for OUSD AMO as the vault assets are DAI, USDC and USDT
    /// while the pool asset is 3CRV.
    /// @param _vaultAssets Addresses of the vault assets
    function _isVaultAssets(address[] memory _vaultAssets)
        internal
        view
        virtual
        returns (bool)
    {
        require(_vaultAssets.length == 1, "Only one asset supported");
        return _isVaultAsset(_vaultAssets[0]);
    }

    /***************************************
        Vault to Pool Asset Conversions
    ****************************************/

    /// @dev Converts Vault assets to a pool assets.
    /// @param vaultAsset The address of the Vault asset to convert. eg WETH, frxETH, DAI
    /// @param vaultAssetAmount The amount of vault assets to convert.
    /// @return poolAssets The amount of pool assets. eg ETH, frxETH or 3CRV
    function _toPoolAsset(address vaultAsset, uint256 vaultAssetAmount)
        internal
        virtual
        returns (uint256 poolAssets);

    /// @dev Calculates the required amount of pool assets to be removed from
    /// the pool in order to get the specified amount of vault assets.
    /// For example, the amount of 3CRV to remove from the pool to withdraw USDT.
    function _calcPoolAsset(address vaultAsset, uint256 vaultAssetAmount)
        internal
        virtual
        returns (uint256 poolAssets);

    /// @dev Convert pool asset amount to an oToken amount.
    /// @param poolAssetAmount The amount of pool assets to convert. eg ETH, 3CRV or frxETH
    function _toOTokens(uint256 poolAssetAmount)
        internal
        virtual
        returns (uint256 oTokenAmount);

    /// @dev Returns the index position of the coin in the AMO pool.
    function _getCoinIndex(address _asset) internal view returns (uint128) {
        if (_asset == address(oToken)) {
            return oTokenCoinIndex;
        } else if (_asset == address(asset)) {
            return assetCoinIndex;
        } else {
            revert("Unsupported asset");
        }
    }

    /***************************************
                AMO Pool Deposits
    ****************************************/

    /// @dev Adds pool assets and/or OTokens to the AMO pool
    /// @param poolAmounts The amount of AMO pool assets and OTokens to add to the pool
    /// @param minLpAmount The minimum amount of AMO pool LP tokens that is acceptable to receive
    function _addLiquidityToPool(
        uint256[2] memory poolAmounts,
        uint256 minLpAmount
    ) internal virtual returns (uint256 lpDeposited);

    /// @dev Removes pool assets and/or OTokens from the AMO pool.
    /// Curve will burn an exact amount of AMO LP tokens in exchange for a calculated amount of pool assets.
    /// Balancer will withdraw and exact amount of pool assets in exchange for a calculated amount of AMO LP tokens.
    /// @param lpTokens The maximum amount of AMO pool LP tokens to be burnt
    /// @param poolAssetAmounts The minimum amount of AMO pool assets that are acceptable to receive
    function _removeLiquidityFromPool(
        uint256 lpTokens,
        uint256[2] memory poolAssetAmounts
    ) internal virtual;

    /// @dev Removes either pool assets or OTokens from the AMO pool.
    /// Curve will burn an exact amount of AMO LP tokens in exchange for a calculated amount of pool assets.
    /// Balancer will withdraw and exact amount of pool assets in exchange for a calculated amount of AMO LP tokens.
    /// @param poolAsset The address of the AMO pool asset to be removed. eg OETH, OUSD, ETH, 3CRV, frxETH
    /// @param lpTokens The maximum amount of AMO pool LP tokens to be burnt
    /// @param poolAssetAmount The minimum amount of AMO pool assets that are acceptable to receive. eg OETH or ETH
    function _removeOneSidedLiquidityFromPool(
        address poolAsset,
        uint256 lpTokens,
        uint256 poolAssetAmount
    ) internal virtual returns (uint256 coinsRemoved);

    /// @dev Returns the current balances of the AMO pool
    function _getBalances()
        internal
        view
        virtual
        returns (uint256[2] memory balances);

    /// @dev Returns the current balances of the AMO pool
    function _getBalance(address poolAsset)
        internal
        view
        virtual
        returns (uint256 balance);

    /// @dev Returns the price of one AMO pool LP token in base asset terms.
    function _getVirtualPrice()
        internal
        view
        virtual
        returns (uint256 virtualPrice);

    /***************************************
            AMO Pool Withdrawals
    ****************************************/

    /// @dev Converts all the pool assets in this strategy to a single Vault asset
    /// and transfers them to the Vault.
    /// For OUSD, this converts 3CRV to either DAI, USDC or USDT.
    function _withdrawAsset(
        address vaultAsset,
        uint256 vaultAssetAmount,
        address recipient
    ) internal virtual;

    /// @dev Converts all the pool assets in this strategy to the Vault assets
    /// and transfers them to the Vault.
    /// For OUSD, this converts 3CRV to DAI, USDC and USDT.
    function _withdrawAllAsset(address recipient) internal virtual;

    /***************************************
                Convex Reward Pool
    ****************************************/

    /// @dev Deposit the AMO pool LP tokens to the rewards pool.
    /// eg Curve LP tokens into Convex or Balancer LP tokens into Aura
    /// @param lpAmount the amount of AMO pool LP tokens to deposit
    function _stakeCurveLp(uint256 lpAmount) internal virtual;

    /// @dev Withdraw a specific amount of AMO pool LP tokens from the rewards pool
    /// eg Curve LP tokens from Convex or Balancer LP tokens from Aura
    /// @param lpAmount the amount of AMO pool LP tokens to withdraw
    function _unStakeLpTokens(uint256 lpAmount) internal virtual;

    /// @dev Withdraw all AMO pool LP tokens from the rewards pool
    function _unStakeAllLpTokens() internal virtual;

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit a vault asset into the AMO strategy.
     * @param _vaultAsset Address of the vault asset token. eg WETH, frxETH, DAI, USDC or USDT
     * @param _vaultAssetAmount Amount of vault asset tokens to deposit.
     */
    function deposit(address _vaultAsset, uint256 _vaultAssetAmount)
        external
        override
        onlyVault
        onlyAsset(_vaultAsset)
        nonReentrant
    {
        emit Deposit(_vaultAsset, address(lpToken), _vaultAssetAmount);
        uint256 poolAssetAmount = _toPoolAsset(_vaultAsset, _vaultAssetAmount);
        _deposit(poolAssetAmount);
    }

    /**
     * @notice Deposit multiple vault assets into the AMO strategy.
     * @param _vaultAssets Addresses of the vault asset tokens. eg WETH, frxETH, DAI, USDC or USDT
     * @param _vaultAssetAmounts Amounts of vault asset tokens to deposit.
     * @dev Only the OUSD Curve AMO supports depositing multiple assets in DAI, USDC and USDT.
     * The default implementation only supports a single asset and must be overriden for the OUSD AMO.
     */
    function deposit(
        address[] memory _vaultAssets,
        uint256[] memory _vaultAssetAmounts
    ) external virtual onlyVault onlyAssets(_vaultAssets) nonReentrant {
        // validate the number of assets matches the number of amounts
        // The onlyAssets modified ensures the correct number of assets are supported.
        // Most AMOs will be just one asset but for OUSD's 3CRV AMO it will be 3 assets.
        require(
            _vaultAssets.length == _vaultAssetAmounts.length,
            "Assets and amounts mismatch"
        );
        uint256 poolAssetAmount = _toPoolAsset(
            _vaultAssets[0],
            _vaultAssetAmounts[0]
        );
        _deposit(poolAssetAmount);
    }

    function _deposit(uint256 _poolAssetAmount) internal {
        require(_poolAssetAmount > 0, "Must deposit something");

        // Get the asset and OToken balances in the AMO pool
        uint256[2] memory balances = _getBalances();

        // Add the old balance with the new deposit amount
        // and then convert to the pool asset value.
        // For example, convert 3CRV to USD value
        uint256 newAssetsValueInOTokens = _toOTokens(
            balances[assetCoinIndex] + _poolAssetAmount
        );

        // Calculate the amount of OTokens to add to the pool
        // safe to cast since min value is at least 0
        uint256 oTokensToAdd = uint256(
            _max(
                0,
                int256(newAssetsValueInOTokens) -
                    int256(balances[oTokenCoinIndex])
            )
        );

        /* Add so much OTokens so that the pool ends up being balanced. And at minimum
         * add as much OTokens as asset and at maximum twice as much OTokens.
         */
        oTokensToAdd = Math.max(oTokensToAdd, _poolAssetAmount);
        oTokensToAdd = Math.min(oTokensToAdd, _poolAssetAmount * 2);

        /* Mint OTokens with a strategy that attempts to contribute to stability of pool. Try
         * to mint so much OTokens that after deployment of liquidity pool ends up being balanced.
         *
         * To manage unpredictability minimal OTokens minted will always be at least equal or greater
         * to the asset amount deployed. And never larger than twice the asset amount deployed even if
         * it would have a further beneficial effect on pool stability.
         */
        IVault(vaultAddress).mintForStrategy(oTokensToAdd);

        emit Deposit(address(oToken), address(lpToken), oTokensToAdd);

        uint256[2] memory _amounts;
        _amounts[assetCoinIndex] = _poolAssetAmount;
        _amounts[oTokenCoinIndex] = oTokensToAdd;

        uint256 valueInLpTokens = (_poolAssetAmount + oTokensToAdd)
            .divPrecisely(_getVirtualPrice());
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Deposit to the AMO pool and receive LP tokens. eg OUSD/3CRV-f or OETH/ETH-f
        uint256 lpDeposited = _addLiquidityToPool(_amounts, minMintAmount);

        // Stake the AMO pool LP tokens for rewards
        _stakeCurveLp(lpDeposited);
    }

    /**
     * @notice Deposit the strategy's entire balance of assets into the AMO pool
     */
    function depositAll() external virtual override onlyVault nonReentrant {
        uint256 vaultAssetBalance = asset.balanceOf(address(this));

        emit Deposit(address(asset), address(lpToken), vaultAssetBalance);

        uint256 poolAssetAmount = _toPoolAsset(
            address(asset),
            vaultAssetBalance
        );
        if (vaultAssetBalance > 0) {
            _deposit(poolAssetAmount);
        }
    }

    /***************************************
                    Withdraw
    ****************************************/

    /**
     * @notice Withdraw pool asset and OToken from the AMO pool, burn the OTokens,
     * convert pool asset to vault asset and transfer the vault asset to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the vault or redeemer.
     * @param _vaultAsset Address of the vault asset token. eg WETH, frxETH, DAI, USDC or USDT
     * @param _vaultAssetAmount Amount of vault asset tokens to withdraw.
     */
    function withdraw(
        address _recipient,
        address _vaultAsset,
        uint256 _vaultAssetAmount
    ) external override onlyVault onlyAsset(_vaultAsset) nonReentrant {
        _withdraw(_recipient, _vaultAsset, _vaultAssetAmount);
    }

    /**
     * @notice Withdraw pool asset and OToken from the AMO pool, burn the OTokens,
     * convert pool asset to vault assets and transfer the vault assets to the recipient.
     * @dev Only the OUSD Curve AMO supports withdrawing multiple assets in DAI, USDC and USDT.
     * The default implementation only supports a single asset and must be overriden for the OUSD AMO.
     * @param _recipient Address to receive withdrawn asset which is normally the vault or redeemer.
     * @param _vaultAssets Addresses of the vault asset tokens. eg WETH, frxETH, DAI, USDC or USDT
     * @param _vaultAssetAmounts Amounts of vault asset tokens to withdraw.
     */
    function withdraw(
        address _recipient,
        address[] memory _vaultAssets,
        uint256[] memory _vaultAssetAmounts
    ) external virtual onlyVault onlyAssets(_vaultAssets) nonReentrant {
        // validate the number of assets matches the number of amounts
        // The onlyAssets modified ensures the correct number of assets are supported.
        // Most AMOs will be just one asset but for OUSD's 3CRV AMO it will be 3 assets.
        require(
            _vaultAssets.length == _vaultAssetAmounts.length,
            "Assets and amounts mismatch"
        );
        _withdraw(_recipient, _vaultAssets[0], _vaultAssetAmounts[0]);
    }

    function _withdraw(
        address _recipient,
        address _vaultAsset,
        uint256 _vaultAssetAmount
    ) internal {
        require(_vaultAssetAmount > 0, "Must withdraw something");

        // Calc required number of pool assets for specified number of vault assets
        uint256 poolAssetAmount = _calcPoolAsset(
            _vaultAsset,
            _vaultAssetAmount
        );

        uint256 requiredLpTokens = calcLpTokensToBurn(poolAssetAmount);

        // Withdraw AMO pool LP tokens from the rewards pool
        _unStakeLpTokens(requiredLpTokens);

        /* math in calcLpTokensToBurn should correctly calculate the amount of Curve LP tokens
         * to burn so the strategy receives enough asset tokens on balanced removal
         */
        uint256[2] memory _minWithdrawalAmounts = [uint256(0), uint256(0)];
        _minWithdrawalAmounts[assetCoinIndex] = poolAssetAmount;
        _removeLiquidityFromPool(requiredLpTokens, _minWithdrawalAmounts);

        // Burn all the removed OTokens and any that was left in the strategy
        uint256 oTokenToBurn = oToken.balanceOf(address(this));
        if (oTokenToBurn > 0) {
            IVault(vaultAddress).burnForStrategy(oTokenToBurn);

            emit Withdrawal(address(oToken), address(lpToken), oTokenToBurn);
        }

        // Convert the pool assets in this strategy to the Vault asset
        // and transfer them to the vault.
        // Also emits the Withdraw event.
        _withdrawAsset(_vaultAsset, _vaultAssetAmount, _recipient);
    }

    function calcLpTokensToBurn(uint256 _vaultAssetAmount)
        internal
        view
        returns (uint256 lpToBurn)
    {
        /* The rate between coins in the pool determines the rate at which pool returns
         * tokens when doing balanced removal (remove_liquidity call). And by knowing how much assets
         * we want we can determine how much of OToken we receive by removing liquidity.
         *
         * Because we are doing balanced removal we should be making profit when removing liquidity in a
         * pool tilted to either side.
         *
         * Important: A downside is that the Strategist / Governor needs to be
         * cognisant of not removing too much liquidity. And while the proposal to remove liquidity
         * is being voted on the pool tilt might change so much that the proposal that has been valid while
         * created is no longer valid.
         */

        uint256 poolAssetBalance = _getBalance(address(asset));
        /* K is multiplied by 1e36 which is used for higher precision calculation of required
         * pool LP tokens. Without it the end value can have rounding errors up to precision of
         * 10 digits. This way we move the decimal point by 36 places when doing the calculation
         * and again by 36 places when we are done with it.
         */
        uint256 k = (1e36 * lpToken.totalSupply()) / poolAssetBalance;
        // prettier-ignore
        // slither-disable-next-line divide-before-multiply
        uint256 diff = (_vaultAssetAmount + 1) * k;
        lpToBurn = diff / 1e36;
    }

    /**
     * @notice Remove all assets and OTokens from the pool, burn the OTokens,
     * transfer the assets to the Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        _unStakeAllLpTokens();

        // Withdraws are proportional to assets held by the Curve pool
        uint256[2] memory minWithdrawAmounts = [uint256(0), uint256(0)];

        // Only withdraw from pool if the strategy has assets in the pool
        uint256 poolLpTokens = lpToken.balanceOf(address(this));
        if (poolLpTokens > 0) {
            // Remove liquidity from the pool
            _removeLiquidityFromPool(poolLpTokens, minWithdrawAmounts);

            // Burn all the OTokens. eg OETH or OUSD
            uint256 oTokenToBurn = oToken.balanceOf(address(this));
            IVault(vaultAddress).burnForStrategy(oTokenToBurn);

            emit Withdrawal(address(oToken), address(lpToken), oTokenToBurn);
        }

        // Convert all the pool assets in this strategy to Vault assets
        // and transfer them to the vault.
        // Also emits the Withdraw events for each vault asset.
        _withdrawAllAsset(vaultAddress);
    }

    /***************************************
                AMO Pool Rebalancing
    ****************************************/

    /**
     * @notice Mint OTokens and one-sided add to the AMO pool.
     * This is used when the AMO pool does not have enough OTokens and too many ETH.
     * The OToken/Asset, eg OETH/ETH, price with increase.
     * The amount of assets in the vault is unchanged.
     * The total supply of OTokens is increased.
     * The asset value of the strategy and vault is increased.
     * @param _oTokens The amount of OTokens to be minted and added to the pool.
     */
    function mintAndAddOTokens(uint256 _oTokens)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        IVault(vaultAddress).mintForStrategy(_oTokens);

        uint256[2] memory _amounts;
        _amounts[assetCoinIndex] = 0;
        _amounts[oTokenCoinIndex] = _oTokens;

        // Convert OTokens, eg OETH, to AMO pool LP tokens
        uint256 valueInLpTokens = (_oTokens).divPrecisely(_getVirtualPrice());
        // Apply slippage to LP tokens
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Add the minted OTokens to the AMO pool
        uint256 lpDeposited = _addLiquidityToPool(_amounts, minMintAmount);

        // Deposit the AMO pool LP tokens to the rewards pool. eg Convex or Aura
        _stakeCurveLp(lpDeposited);

        emit Deposit(address(oToken), address(lpToken), _oTokens);
    }

    /**
     * @notice One-sided remove of OTokens from the AMO pool which are then burned.
     * This is used when the AMO pool has too many OTokens and not enough ETH.
     * The amount of assets in the vault is unchanged.
     * The total supply of OTokens is reduced.
     * The asset value of the strategy and vault is reduced.
     * @param _lpTokens The amount of AMO pool LP tokens to be burned for OTokens.
     */
    function removeAndBurnOTokens(uint256 _lpTokens)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        // Withdraw AMO pool LP tokens from the rewards pool and remove OTokens from the AMO pool
        uint256 oTokenToBurn = _withdrawAndRemoveFromPool(
            _lpTokens,
            address(oToken)
        );

        // The vault burns the OTokens from this strategy
        IVault(vaultAddress).burnForStrategy(oTokenToBurn);

        emit Withdrawal(address(oToken), address(lpToken), oTokenToBurn);
    }

    /**
     * @notice One-sided remove of assets, eg ETH, from the AMO pool,
     * convert to the asset and transfer to the vault.
     * This is used when the AMO pool does not have enough OTokens and too many assets.
     * The OToken/Asset, eg OETH/ETH, price with decrease.
     * The amount of assets in the vault increases.
     * The total supply of OTokens does not change.
     * The asset value of the strategy reduces.
     * The asset value of the vault should be close to the same.
     * @param _lpTokens The amount of AMO pool LP tokens to be burned for pool assets.
     * @dev Curve pool LP tokens is used rather than assets as Curve does not
     * have a way to accurately calculate the amount of LP tokens for a required
     * amount of assets. Curve's `calc_token_amount` functioun does not include fees.
     * A 3rd party libary can be used that takes into account the fees, but this
     * is a gas intensive process. It's easier for the trusted strategist to
     * caclulate the amount of AMO pool LP tokens required off-chain.
     */
    function removeOnlyAssets(uint256 _lpTokens)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        // Withdraw AMO pool LP tokens from rewards pool and remove asset from the AMO pool
        _withdrawAndRemoveFromPool(_lpTokens, address(asset));

        // Convert all the pool assets in this strategy to Vault assets
        // and transfer them to the vault
        _withdrawAllAsset(vaultAddress);
    }

    /**
     * @dev Remove AMO pool LP tokens from the rewards pool and
     * do a one-sided remove of pool assets or OTokens from the AMO pool.
     * @param _lpTokens The amount of AMO pool LP tokens to be removed from the Convex pool.
     * @param removeAsset The address of the AMO pool asset or OTokens to be removed.
     * @return coinsRemoved The amount of assets or OTokens removed from the AMO pool.
     */
    function _withdrawAndRemoveFromPool(uint256 _lpTokens, address removeAsset)
        internal
        returns (uint256 coinsRemoved)
    {
        // Withdraw AMO pool LP tokens from rewards pool
        _unStakeLpTokens(_lpTokens);

        // Convert AMO pool LP tokens to asset value
        uint256 valueInEth = _lpTokens.mulTruncate(_getVirtualPrice());
        // Apply slippage to asset value
        uint256 minAmount = valueInEth.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        coinsRemoved = _removeOneSidedLiquidityFromPool(
            removeAsset,
            _lpTokens,
            minAmount
        );
    }

    /***************************************
                Assets
    ****************************************/

    /**
     * @notice Returns bool indicating whether asset is supported by this strategy
     * @param _vaultAsset Address of the vault asset
     */
    function supportsAsset(address _vaultAsset)
        public
        view
        override
        returns (bool)
    {
        return _isVaultAsset(_vaultAsset);
    }

    /**
     * @notice Approve the spending of all assets by their corresponding pool tokens,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens()
        external
        virtual
        override
        onlyGovernor
        nonReentrant
    {
        _approveBase();
    }

    function _approveBase() internal virtual {}

    /***************************************
                    Utils
    ****************************************/

    /**
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }
}
