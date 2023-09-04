// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Abstract Convex Automated Market Maker (AMO) Strategy
 * @notice Investment strategy for investing assets in Curve and Convex pools
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { ICurveETHPoolV1 } from "../ICurveETHPoolV1.sol";
import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IConvexDeposits } from "../IConvexDeposits.sol";
import { IRewardStaking } from "../IRewardStaking.sol";

abstract contract BaseConvexAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI

    // New immutable variables that must be set in the constructor
    address public immutable cvxDepositorAddress;
    IRewardStaking public immutable cvxRewardStaker;
    uint256 public immutable cvxDepositorPTokenId;
    /// @notice The Curve pool that the strategy invests in
    ICurveETHPoolV1 public immutable curvePool;
    /// @notice The Curve pool LP token that the strategy invests in
    IERC20 public immutable lpToken;
    /// @notice The OToken that is used in the Curve pool. eg OETH or OUSD
    IERC20 public immutable oToken;
    /// @notice The asset token that is used in the Curve pool. eg WETH, frxETH or 3CRV
    IERC20 public immutable asset;

    // Index position of oToken in Curve pool. For example
    // for OETH/ETH, OETH = 1
    // for OUSD/3CRV, OUSD = 0
    uint128 public immutable oTokenCoinIndex;
    // Index position of asset in Curve pool. For example
    // for OETH/ETH, ETH = 0
    // for OUSD/3CRV, 3CRV = 1
    uint128 public immutable assetCoinIndex;

    /// @notice Validates the vault asset is supported by this strategy.
    modifier onlyAsset(address _vaultAsset) {
        require(_isVaultAsset(_vaultAsset), "Unsupported asset");
        _;
    }

    /**
     * @dev Verifies that the caller is the Strategist.
     */
    modifier onlyStrategist() {
        require(
            msg.sender == IVault(vaultAddress).strategistAddr(),
            "Caller is not the Strategist"
        );
        _;
    }

    /**
     * @dev Checks the pool's balances have improved and the balances
     * have not tipped to the other side.
     */
    modifier improvePoolBalance() {
        // Get the asset and OToken balances in the Curve pool
        uint256[2] memory balancesBefore = curvePool.get_balances();
        // diff = asset balance - OToken balance
        int256 diffBefore = int256(balancesBefore[assetCoinIndex]) -
            int256(balancesBefore[oTokenCoinIndex]);

        _;

        // Get the asset and OToken balances in the Curve pool
        uint256[2] memory balancesAfter = curvePool.get_balances();
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
    struct ConvexAMOConfig {
        address cvxDepositorAddress; // Address of the Convex depositor(AKA booster) for this pool
        address cvxRewardStakerAddress; // Address of the CVX rewards staker
        uint256 cvxDepositorPTokenId; // Pid of the pool referred to by Depositor and staker
        address oTokenAddress; // Address of the OToken. eg OETH or OUSD
        address assetAddress; // Address of the asset token. eg WETH, frxETH or 3CRV
        uint128 oTokenCoinIndex;
        uint128 assetCoinIndex;
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        ConvexAMOConfig memory _convexConfig
    ) InitializableAbstractStrategy(_baseConfig) {
        // Is the Curve pool the AMO is adding liquidity to. eg OETH/ETH, OUSD/3CRV or OETH/frxETH
        curvePool = ICurveETHPoolV1(_baseConfig.platformAddress);
        // This assumes the Curve pool and LP token have the same address
        lpToken = IERC20(_baseConfig.platformAddress);

        cvxDepositorAddress = _convexConfig.cvxDepositorAddress;
        cvxRewardStaker = IRewardStaking(_convexConfig.cvxRewardStakerAddress);
        cvxDepositorPTokenId = _convexConfig.cvxDepositorPTokenId;
        oToken = IERC20(_convexConfig.oTokenAddress);
        asset = IERC20(_convexConfig.assetAddress);

        oTokenCoinIndex = _convexConfig.oTokenCoinIndex;
        assetCoinIndex = _convexConfig.assetCoinIndex;
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     */
    function initialize(
        address[] calldata _rewardTokenAddresses // CRV + CVX
    ) external onlyGovernor initializer {
        address[] memory assets = new address[](1);
        assets[0] = address(asset);
        // pTokens are not used by this strategy
        // it is only included for backward compatibility with the
        // parent InitializableAbstractStrategy contract
        address[] memory pTokens = new address[](1);
        pTokens[0] = address(curvePool);

        super._initialize(_rewardTokenAddresses, assets, pTokens);

        _approveBase();
    }

    /***************************************
            Vault Asset Validation
    ****************************************/

    /// @dev Validates the vault asset is supported by this strategy.
    /// Default implementation is the vault asset matches the pool asset.
    /// This needs to be overriden for OUSD AMO as the vault assets are DAI, USDC and USDT
    /// while the pool asset is 3CRV.
    function _isVaultAsset(address _vaultAsset)
        internal
        view
        virtual
        returns (bool supported)
    {
        supported = _vaultAsset == address(asset);
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

    /// @dev Convert pool asset amount to an oToken amount.
    /// @param poolAssetAmount The amount of pool assets to convert. eg ETH, 3CRV or frxETH
    function _toOTokens(uint256 poolAssetAmount)
        internal
        virtual
        returns (uint256 oTokenAmount);

    /***************************************
                Curve Pool Deposits
    ****************************************/

    /// @dev Adds assets and/or OTokens to the Curve pool
    /// @param amounts The amount of Curve pool assets and OTokens to add to the pool
    function _addLiquidityToPool(
        uint256[2] memory amounts,
        uint256 minMintAmount
    ) internal virtual returns (uint256 lpDeposited);

    /***************************************
            Curve Pool Withdrawals
    ****************************************/

    /// @dev Converts all the pool assets in this strategy to the Vault assets.
    /// and transfers them to the Vault.
    function _withdrawAllAsset(address recipient) internal virtual;

    /***************************************
                Convex Reward Pool
    ****************************************/

    /// @dev Deposit the Curve pool LP tokens to the Convex rewards pool
    function _stakeCurveLp(uint256 lpDeposited) internal virtual {
        require(
            IConvexDeposits(cvxDepositorAddress).deposit(
                cvxDepositorPTokenId,
                lpDeposited,
                true // Deposit with staking
            ),
            "Failed to Deposit LP to Convex"
        );
    }

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit an asset into the Curve pool
     * @param _vaultAsset Address of the Vault asset token. eg WETH or frxETH
     * @param _amount Amount of Vault asset tokens to deposit.
     */
    function deposit(address _vaultAsset, uint256 _amount)
        external
        override
        onlyVault
        onlyAsset(_vaultAsset)
        nonReentrant
    {
        emit Deposit(_vaultAsset, address(lpToken), _amount);
        uint256 poolAssetAmount = _toPoolAsset(_vaultAsset, _amount);
        _deposit(poolAssetAmount);
    }

    function _deposit(uint256 _poolAssetAmount) internal {
        require(_poolAssetAmount > 0, "Must deposit something");

        // Get the asset and OToken balances in the Curve pool
        uint256[2] memory balances = curvePool.get_balances();

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
            .divPrecisely(curvePool.get_virtual_price());
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Deposit to the Curve pool and receive Curve pool LP tokens. eg OUSD/3CRV-f or OETH/ETH-f
        uint256 lpDeposited = _addLiquidityToPool(_amounts, minMintAmount);

        // Deposit the Curve pool LP tokens to the Convex rewards pool
        _stakeCurveLp(lpDeposited);
    }

    /**
     * @notice Deposit the strategy's entire balance of assets into the Curve pool
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
     * @notice Withdraw asset and OToken from the Curve pool, burn the OTokens,
     * and transfer to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _vaultAsset Address of the asset token. eg WETH or frxETH
     * @param _amount Amount of asset tokens to withdraw.
     */
    function withdraw(
        address _recipient,
        address _vaultAsset,
        uint256 _amount
    ) external override onlyVault onlyAsset(_vaultAsset) nonReentrant {
        require(_amount > 0, "Invalid amount");

        emit Withdrawal(_vaultAsset, address(lpToken), _amount);

        uint256 requiredLpTokens = calcTokenToBurn(_amount);

        // Withdraw pool LP tokens from Convex pool
        _lpWithdraw(requiredLpTokens);

        /* math in requiredLpTokens should correctly calculate the amount of LP to remove
         * in that the strategy receives enough asset tokens on balanced removal
         */
        uint256[2] memory _minWithdrawalAmounts = [uint256(0), uint256(0)];
        _minWithdrawalAmounts[assetCoinIndex] = _amount;
        // slither-disable-next-line unused-return
        curvePool.remove_liquidity(requiredLpTokens, _minWithdrawalAmounts);

        // Burn all the removed OTokens and any that was left in the strategy
        uint256 oTokenToBurn = oToken.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oTokenToBurn);

        emit Withdrawal(address(oToken), address(lpToken), oTokenToBurn);

        // Convert all the pool assets in this strategy to Vault assets
        // and transfer them to the vault
        _withdrawAllAsset(_recipient);
    }

    function calcTokenToBurn(uint256 _amount)
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

        uint256 poolAssetBalance = curvePool.balances(assetCoinIndex);
        /* K is multiplied by 1e36 which is used for higher precision calculation of required
         * pool LP tokens. Without it the end value can have rounding errors up to precision of
         * 10 digits. This way we move the decimal point by 36 places when doing the calculation
         * and again by 36 places when we are done with it.
         */
        uint256 k = (1e36 * lpToken.totalSupply()) / poolAssetBalance;
        // prettier-ignore
        // slither-disable-next-line divide-before-multiply
        uint256 diff = (_amount + 1) * k;
        lpToBurn = diff / 1e36;
    }

    /**
     * @notice Remove all assets and OTokens from the pool, burn the OTokens,
     * transfer the assets to the Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 gaugeTokens = cvxRewardStaker.balanceOf(address(this));
        _lpWithdraw(gaugeTokens);

        // Withdraws are proportional to assets held by 3Pool
        uint256[2] memory minWithdrawAmounts = [uint256(0), uint256(0)];

        // Remove liquidity
        // slither-disable-next-line unused-return
        curvePool.remove_liquidity(
            lpToken.balanceOf(address(this)),
            minWithdrawAmounts
        );

        // Burn all the OTokens. eg OETH
        uint256 oTokenToBurn = oToken.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oTokenToBurn);

        emit Withdrawal(address(oToken), address(lpToken), oTokenToBurn);

        // Convert all the pool assets in this strategy to Vault assets
        // and transfer them to the vault
        _withdrawAllAsset(vaultAddress);
    }

    /***************************************
            Curve Pool Rebalancing
    ****************************************/

    /**
     * @notice Mint OTokens and one-sided add to the Curve pool.
     * This is used when the Curve pool does not have enough OTokens and too many ETH.
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

        // Convert OTokens, eg OETH, to Curve pool LP tokens
        uint256 valueInLpTokens = (_oTokens).divPrecisely(
            curvePool.get_virtual_price()
        );
        // Apply slippage to LP tokens
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Add the minted OTokens to the Curve pool
        uint256 lpDeposited = _addLiquidityToPool(_amounts, minMintAmount);

        // Deposit the Curve pool LP tokens to the Convex rewards pool
        _stakeCurveLp(lpDeposited);

        emit Deposit(address(oToken), address(lpToken), _oTokens);
    }

    /**
     * @notice One-sided remove of OTokens from the Curve pool which are then burned.
     * This is used when the Curve pool has too many OTokens and not enough ETH.
     * The amount of assets in the vault is unchanged.
     * The total supply of OTokens is reduced.
     * The asset value of the strategy and vault is reduced.
     * @param _lpTokens The amount of Curve pool LP tokens to be burned for OTokens.
     */
    function removeAndBurnOTokens(uint256 _lpTokens)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        // Withdraw Curve pool LP tokens from Convex and remove OTokens from the Curve pool
        uint256 oTokenToBurn = _withdrawAndRemoveFromPool(
            _lpTokens,
            oTokenCoinIndex
        );

        // The vault burns the OTokens from this strategy
        IVault(vaultAddress).burnForStrategy(oTokenToBurn);

        emit Withdrawal(address(oToken), address(lpToken), oTokenToBurn);
    }

    /**
     * @notice One-sided remove of assets, eg ETH, from the Curve pool,
     * convert to the asset and transfer to the vault.
     * This is used when the Curve pool does not have enough OTokens and too many assets.
     * The OToken/Asset, eg OETH/ETH, price with decrease.
     * The amount of assets in the vault increases.
     * The total supply of OTokens does not change.
     * The asset value of the strategy reduces.
     * The asset value of the vault should be close to the same.
     * @param _lpTokens The amount of Curve pool LP tokens to be burned for ETH.
     * @dev Curve pool LP tokens is used rather than assets as Curve does not
     * have a way to accurately calculate the amount of LP tokens for a required
     * amount of assets. Curve's `calc_token_amount` functioun does not include fees.
     * A 3rd party libary can be used that takes into account the fees, but this
     * is a gas intensive process. It's easier for the trusted strategist to
     * caclulate the amount of Curve pool LP tokens required off-chain.
     */
    function removeOnlyAssets(uint256 _lpTokens)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        // Withdraw Curve pool LP tokens from Convex and remove asset from the Curve pool
        _withdrawAndRemoveFromPool(_lpTokens, assetCoinIndex);

        // Convert all the pool assets in this strategy to Vault assets
        // and transfer them to the vault
        _withdrawAllAsset(vaultAddress);
    }

    /**
     * @dev Remove Curve pool LP tokens from the Convex pool and
     * do a one-sided remove of assets or OTokens from the Curve pool.
     * @param _lpTokens The amount of Curve pool LP tokens to be removed from the Convex pool.
     * @param coinIndex The index of the coin to be removed from the Curve pool. eg 0 = ETH, 1 = OETH.
     * @return coinsRemoved The amount of assets or OTokens removed from the Curve pool.
     */
    function _withdrawAndRemoveFromPool(uint256 _lpTokens, uint128 coinIndex)
        internal
        returns (uint256 coinsRemoved)
    {
        // Withdraw Curve pool LP tokens from Convex pool
        _lpWithdraw(_lpTokens);

        // Convert Curve pool LP tokens to asset value
        uint256 valueInEth = _lpTokens.mulTruncate(
            curvePool.get_virtual_price()
        );
        // Apply slippage to ETH value
        uint256 minAmount = valueInEth.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Remove just the ETH from the Curve pool
        coinsRemoved = curvePool.remove_liquidity_one_coin(
            _lpTokens,
            int128(coinIndex),
            minAmount,
            address(this)
        );
    }

    /***************************************
                Assets and Rewards
    ****************************************/

    /**
     * @notice Collect accumulated CRV and CVX rewards and send to the Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect CRV and CVX
        cvxRewardStaker.getReward();
        _collectRewardTokens();
    }

    function _lpWithdraw(uint256 _lpAmount) internal {
        // withdraw and unwrap with claim takes back the lpTokens
        // and also collects the rewards for deposit
        cvxRewardStaker.withdrawAndUnwrap(_lpAmount, true);
    }

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
     * @param _vaultAsset Address of the vault asset
     */
    function supportsAsset(address _vaultAsset)
        external
        view
        override
        returns (bool)
    {
        return _isVaultAsset(_vaultAsset);
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
