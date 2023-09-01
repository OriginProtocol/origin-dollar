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

    // The following slots have been deprecated with immutable variables
    // slither-disable-next-line constable-states
    address private _deprecated_cvxDepositorAddress;
    // slither-disable-next-line constable-states
    address private _deprecated_cvxRewardStaker;
    // slither-disable-next-line constable-states
    uint256 private _deprecated_cvxDepositorPTokenId;
    // slither-disable-next-line constable-states
    address private _deprecated_curvePool;
    // slither-disable-next-line constable-states
    address private _deprecated_lpToken;
    // slither-disable-next-line constable-states
    address private _deprecated_oeth;
    // slither-disable-next-line constable-states
    address private _deprecated_weth;

    // Ordered list of pool assets
    // slither-disable-next-line constable-states
    uint128 private _deprecated_oethCoinIndex = 1;
    // slither-disable-next-line constable-states
    uint128 private _deprecated_ethCoinIndex = 0;

    // New immutable variables that must be set in the constructor
    address public immutable cvxDepositorAddress;
    IRewardStaking public immutable cvxRewardStaker;
    uint256 public immutable cvxDepositorPTokenId;
    ICurveETHPoolV1 public immutable curvePool;
    IERC20 public immutable lpToken;
    IERC20 public immutable oToken;
    IERC20 public immutable asset;

    // Ordered list of pool assets
    uint128 public constant oTokenCoinIndex = 1;
    uint128 public constant assetCoinIndex = 0;

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
        address assetAddress; // Address of the asset token. eg WETH or frxETH
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        ConvexAMOConfig memory _convexConfig
    ) InitializableAbstractStrategy(_baseConfig) {
        lpToken = IERC20(_baseConfig.platformAddress);
        curvePool = ICurveETHPoolV1(_baseConfig.platformAddress);

        cvxDepositorAddress = _convexConfig.cvxDepositorAddress;
        cvxRewardStaker = IRewardStaking(_convexConfig.cvxRewardStakerAddress);
        cvxDepositorPTokenId = _convexConfig.cvxDepositorPTokenId;
        oToken = IERC20(_convexConfig.oTokenAddress);
        asset = IERC20(_convexConfig.assetAddress);
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Address of supported asset in an array. eg WETH or frxETH
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + CVX
        address[] calldata _assets
    ) external onlyGovernor initializer {
        require(_assets.length == 1, "Must have exactly one asset");

        address[] memory pTokens = new address[](1);
        pTokens[0] = address(curvePool);

        super._initialize(_rewardTokenAddresses, _assets, pTokens);

        _approveBase();
    }

    /***************************************
        Vault to Pool Asset Conversions
    ****************************************/

    /// @dev Converts the Vault asset to a Curve pool asset
    /// for WETH, it unwraps the ETH from WETH using a WETH withdraw
    /// for frxETH, it doesn't need to do anything
    /// @param amount The amount of Curve pool assets to unwrap
    function _unwrapAsset(uint256 amount) internal virtual;

    /// @dev Converts a Curve pool asset to the Vault asset
    /// for WETH, it wraps the ETH in WETH using a WETH deposit
    /// for frxETH, it doesn't need to do anything
    /// @param amount The amount of Curve pool assets to wrap
    function _wrapAsset(uint256 amount) internal virtual;

    /// @dev Converts all the Curve pool assets in this strategy to the Vault asset.
    /// for WETH, it get the ETH balance and wraps it in WETH using a WETH deposit
    /// for frxETH, it just gets the frxETH balance of this strategy contract
    /// @return assets The amount of Vault assets
    function _wrapAsset() internal virtual returns (uint256 assets);

    /***************************************
                    Curve Pool
    ****************************************/

    /// @dev Adds assets and/or OTokens to the Curve pool
    /// @param amounts The amount of Curve pool assets and OTokens to add to the pool
    function _addLiquidityToPool(
        uint256[2] memory amounts,
        uint256 minMintAmount
    ) internal virtual returns (uint256 lpDeposited);

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit an asset into the Curve pool
     * @param _asset Address of the Vault asset token. eg WETH or frxETH
     * @param _amount Amount of Vault asset tokens to deposit.
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");
        require(_asset == address(asset), "Unsupported asset");

        _unwrapAsset(_amount);

        emit Deposit(_asset, address(lpToken), _amount);

        // Get the asset and OToken balances in the Curve pool
        uint256[2] memory balances = curvePool.get_balances();
        // safe to cast since min value is at least 0
        uint256 oTokensToAdd = uint256(
            _max(
                0,
                int256(balances[assetCoinIndex]) +
                    int256(_amount) -
                    int256(balances[oTokenCoinIndex])
            )
        );

        /* Add so much OTokens so that the pool ends up being balanced. And at minimum
         * add as much OTokens as asset and at maximum twice as much OTokens.
         */
        oTokensToAdd = Math.max(oTokensToAdd, _amount);
        oTokensToAdd = Math.min(oTokensToAdd, _amount * 2);

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
        _amounts[assetCoinIndex] = _amount;
        _amounts[oTokenCoinIndex] = oTokensToAdd;

        uint256 valueInLpTokens = (_amount + oTokensToAdd).divPrecisely(
            curvePool.get_virtual_price()
        );
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Do the deposit to the Curve pool
        uint256 lpDeposited = _addLiquidityToPool(_amounts, minMintAmount);

        // Deposit the Curve pool LP tokens to the Convex rewards pool
        require(
            IConvexDeposits(cvxDepositorAddress).deposit(
                cvxDepositorPTokenId,
                lpDeposited,
                true // Deposit with staking
            ),
            "Depositing LP to Convex not successful"
        );
    }

    /**
     * @notice Deposit the strategy's entire balance of assets into the Curve pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = asset.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(asset), balance);
        }
    }

    /***************************************
                    Withdraw
    ****************************************/

    /**
     * @notice Withdraw asset and OToken from the Curve pool, burn the OTokens,
     * and transfer to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _asset Address of the asset token. eg WETH or frxETH
     * @param _amount Amount of asset tokens to withdraw.
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Invalid amount");
        require(_asset == address(asset), "Unsupported asset");

        emit Withdrawal(_asset, address(lpToken), _amount);

        uint256 requiredLpTokens = calcTokenToBurn(_amount);

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

        // Convert Curve pool asset to Vault asset
        _wrapAsset(_amount);

        // Transfer the requested number of assets to the recipient
        // this may leave some assets in this strategy contract if
        // more assets than expected were removed from the pool
        asset.safeTransfer(_recipient, _amount);
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

        uint256 assetBalance = _wrapAsset();

        // Transfer the asset to the Vault
        asset.safeTransfer(vaultAddress, assetBalance);

        emit Withdrawal(address(asset), address(lpToken), assetBalance);
        emit Withdrawal(address(oToken), address(lpToken), oTokenToBurn);
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

        // Convert OTokens, eg OETH, to Curve pool LP tokens
        uint256 valueInLpTokens = (_oTokens).divPrecisely(
            curvePool.get_virtual_price()
        );
        // Apply slippage to LP tokens
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Add the minted OTokens to the Curve pool
        uint256 lpDeposited = curvePool.add_liquidity(
            [0, _oTokens],
            minMintAmount
        );

        // Deposit the Curve pool LP tokens to the Convex rewards pool
        require(
            IConvexDeposits(cvxDepositorAddress).deposit(
                cvxDepositorPTokenId,
                lpDeposited,
                true // Deposit with staking
            ),
            "Failed to Deposit LP to Convex"
        );

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

        uint256 assetAmount = _wrapAsset();

        // Transfer the asset to the Vault
        asset.safeTransfer(vaultAddress, assetAmount);

        emit Withdrawal(address(asset), address(lpToken), assetAmount);
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
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return _asset == address(asset);
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
