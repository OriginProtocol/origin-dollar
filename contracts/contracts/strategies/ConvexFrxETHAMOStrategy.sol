// SPDX-License-Identifier: MITetCoinIndex
pragma solidity ^0.8.0;

/**
 * @title Convex Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve frxETH/OETH pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { ICurveETHPoolV1 } from "./ICurveETHPoolV1.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IRewardStaking } from "./IRewardStaking.sol";

contract ConvexFrxETHAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI

    // New immutable variables that must be set in the constructor
    address public immutable cvxDepositorAddress;
    IRewardStaking public immutable cvxRewardStaker;
    uint256 public immutable cvxDepositorPTokenId;
    ICurveETHPoolV1 public immutable curvePool;
    IERC20 public immutable lpToken;
    IERC20 public immutable oToken;
    IERC20 public immutable asset;

    // Ordered list of pool assets
    uint128 public constant assetCoinIndex = 0; // frxETH
    uint128 public constant oTokenCoinIndex = 1; // OETH

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
     * @dev Checks the Curve pool's balances have improved and the balances
     * have not tipped to the other side.
     * This modifier only works on functions that do a single sided add or remove.
     * The standard deposit function adds to both sides of the pool in a way that
     * the pool's balance is not worsened.
     * Withdrawals are proportional so doesn't change the pools asset balance.
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
            // If the pool was originally imbalanced in favor of OETH, then
            // we want to check that the pool is now more balanced
            require(diffAfter <= 0, "OTokens overshot peg");
            require(diffBefore < diffAfter, "OTokens balance worse");
        }
        if (diffBefore >= 0) {
            // If the pool was originally imbalanced in favor of frxETH, then
            // we want to check that the pool is now more balanced
            require(diffAfter >= 0, "Assets overshot peg");
            require(diffAfter < diffBefore, "Assets balance worse");
        }
    }

    // Used to circumvent the stack too deep issue
    struct ConvexEthMetaConfig {
        address cvxDepositorAddress; //Address of the Convex depositor(AKA booster) for this pool
        address cvxRewardStakerAddress; //Address of the CVX rewards staker
        uint256 cvxDepositorPTokenId; //Pid of the pool referred to by Depositor and staker
        address oTokenAddress; //Address of OETH token
        address assetAddress; //Address of frxETH
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        ConvexEthMetaConfig memory _convexConfig
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
     */
    function initialize(
        address[] calldata _rewardTokenAddresses // CRV + CVX
    ) external onlyGovernor initializer {
        address[] memory assets = new address[](1);
        assets[0] = address(asset);

        address[] memory pTokens = new address[](1);
        pTokens[0] = address(curvePool);

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            assets,
            pTokens
        );

        _approveBase();
    }

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit frxETH into the Curve pool
     * @param _asset Address of the frxETH token.
     * @param _amount Amount of frxETH to deposit.
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

        emit Deposit(_asset, address(lpToken), _amount);

        // Get the asset and OToken balances in the Curve pool
        uint256[2] memory balances = curvePool.get_balances();
        // safe to cast since min value is at least 0
        uint256 oethToAdd = uint256(
            _max(
                0,
                int256(balances[assetCoinIndex]) +
                    int256(_amount) -
                    int256(balances[oTokenCoinIndex])
            )
        );

        /* Add so much OETH so that the pool ends up being balanced. And at minimum
         * add as much OETH as frxETH and at maximum twice as much OETH.
         */
        oethToAdd = Math.max(oethToAdd, _amount);
        oethToAdd = Math.min(oethToAdd, _amount * 2);

        /* Mint OETH with a strategy that attempts to contribute to stability of the frxETH/OETH pool. Try
         * to mint so much OETH that after deployment of liquidity pool ends up being balanced.
         *
         * To manage unpredictability minimal OETH minted will always be at least equal or greater
         * to frxETH amount deployed. And never larger than twice the frxETH amount deployed even if
         * it would have a further beneficial effect on pool stability.
         */
        IVault(vaultAddress).mintForStrategy(oethToAdd);

        emit Deposit(address(oToken), address(lpToken), oethToAdd);

        uint256[2] memory _amounts;
        _amounts[assetCoinIndex] = _amount;
        _amounts[oTokenCoinIndex] = oethToAdd;

        uint256 valueInLpTokens = (_amount + oethToAdd).divPrecisely(
            curvePool.get_virtual_price()
        );
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Do the deposit to the Curve pool
        // slither-disable-next-line arbitrary-send
        uint256 lpDeposited = curvePool.add_liquidity(_amounts, minMintAmount);

        // Deposit the Curve pool's LP tokens into the Convex rewards pool
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
     * @notice Deposit the strategy's entire balance of frxETH into the Curve pool
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
     * @notice Withdraw frxETH and OETH from the Curve pool, burn the OETH,
     * cand transfer the frxETH to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _asset Address of the frxETH token.
     * @param _amount Amount of frxETH to withdraw.
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
         * in that the strategy receives enough frxETH on balanced removal
         */
        uint256[2] memory _minWithdrawalAmounts = [uint256(0), uint256(0)];
        _minWithdrawalAmounts[assetCoinIndex] = _amount;
        // slither-disable-next-line unused-return
        curvePool.remove_liquidity(requiredLpTokens, _minWithdrawalAmounts);

        // Burn all the removed OETH and any that was left in the strategy
        uint256 oethToBurn = oToken.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        emit Withdrawal(address(oToken), address(lpToken), oethToBurn);

        // Transfer asset to the recipient
        require(
            asset.transfer(_recipient, _amount),
            "Transfer of asset not successful"
        );
    }

    function calcTokenToBurn(uint256 _amount)
        internal
        view
        returns (uint256 lpToBurn)
    {
        /* The rate between coins in the pool determines the rate at which pool returns
         * tokens when doing balanced removal (remove_liquidity call). And by knowing how much frxETH
         * we want we can determine how much of OETH we receive by removing liquidity.
         *
         * Because we are doing balanced removal we should be making profit when removing liquidity in a
         * pool tilted to either side.
         *
         * Important: A downside is that the Strategist / Governor needs to be
         * cognisant of not removing too much liquidity. And while the proposal to remove liquidity
         * is being voted on the pool tilt might change so much that the proposal that has been valid while
         * created is no longer valid.
         */

        uint256 poolWETHBalance = curvePool.balances(assetCoinIndex);
        /* K is multiplied by 1e36 which is used for higher precision calculation of required
         * pool LP tokens. Without it the end value can have rounding errors up to precision of
         * 10 digits. This way we move the decimal point by 36 places when doing the calculation
         * and again by 36 places when we are done with it.
         */
        uint256 k = (1e36 * lpToken.totalSupply()) / poolWETHBalance;
        // prettier-ignore
        // slither-disable-next-line divide-before-multiply
        uint256 diff = (_amount + 1) * k;
        lpToBurn = diff / 1e36;
    }

    /**
     * @notice Remove all frxETH and OETH from the Curve pool, burn the OETH
     * and transfer the frxETH to the Vault contract.
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

        // Burn all OETH
        uint256 oethToBurn = oToken.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        // Get the strategy contract's ether balance.
        // This includes all that was removed from the Curve pool and
        // any ether that was sitting in the strategy contract before the removal.
        uint256 assetBalance = asset.balanceOf(address(this));
        require(
            asset.transfer(vaultAddress, assetBalance),
            "Transfer of asset not successful"
        );

        emit Withdrawal(address(asset), address(lpToken), assetBalance);
        emit Withdrawal(address(oToken), address(lpToken), oethToBurn);
    }

    /***************************************
            Curve pool Rebalancing
    ****************************************/

    /**
     * @notice Mint OTokens and one-sided add to the Curve pool.
     * This is used when the Curve pool does not have enough OTokens and too many frxETH.
     * The OToken/Asset, eg frxETH/OETH, price with increase.
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

        uint256[2] memory amounts = [uint256(0), uint256(0)];
        amounts[oTokenCoinIndex] = _oTokens;

        // Convert OETH to Curve pool LP tokens
        uint256 valueInLpTokens = (_oTokens).divPrecisely(
            curvePool.get_virtual_price()
        );
        // Apply slippage to LP tokens
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Add the minted OTokens to the Curve pool
        uint256 lpDeposited = curvePool.add_liquidity(amounts, minMintAmount);

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
     * This is used when the Curve pool has too many OTokens and not enough frxETH.
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
        uint256 oethToBurn = _withdrawAndRemoveFromPool(
            _lpTokens,
            oTokenCoinIndex
        );

        // The vault burns the OTokens from this strategy
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        emit Withdrawal(address(oToken), address(lpToken), oethToBurn);
    }

    /**
     * @notice One-sided remove of frxETH from the Curve pool, and transfer to the vault.
     * This is used when the Curve pool does not have enough OTokens and too many frxETH.
     * The OToken/Asset, eg frxETH/OETH, price with decrease.
     * The amount of assets in the vault increases.
     * The total supply of OTokens does not change.
     * The asset value of the strategy reduces.
     * The asset value of the vault should be close to the same.
     * @param _lpTokens The amount of Curve pool LP tokens to be burned for frxETH.
     * @dev Curve pool LP tokens is used rather than frxETH assets as Curve does not
     * have a way to accurately calculate the amount of LP tokens for a required
     * amount of frxETH. Curve's `calc_token_amount` functioun does not include fees.
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
        // Withdraw Curve pool LP tokens from Convex and remove frxETH from the Curve pool
        uint256 ethAmount = _withdrawAndRemoveFromPool(
            _lpTokens,
            assetCoinIndex
        );

        require(
            asset.transfer(vaultAddress, ethAmount),
            "Transfer of asset not successful"
        );

        emit Withdrawal(address(asset), address(lpToken), ethAmount);
    }

    /**
     * @dev Remove Curve pool LP tokens from the Convex pool and
     * do a one-sided remove of frxETH or OETH from the Curve pool.
     * @param _lpTokens The amount of Curve pool LP tokens to be removed from the Convex pool.
     * @param coinIndex The index of the coin to be removed from the Curve pool. 0 = frxETH, 1 = OETH.
     * @return coinsRemoved The amount of frxETH or OETH removed from the Curve pool.
     */
    function _withdrawAndRemoveFromPool(uint256 _lpTokens, uint128 coinIndex)
        internal
        returns (uint256 coinsRemoved)
    {
        // Withdraw Curve pool LP tokens from Convex pool
        _lpWithdraw(_lpTokens);

        // Convert Curve pool LP tokens to ETH value
        uint256 valueInEth = _lpTokens.mulTruncate(
            curvePool.get_virtual_price()
        );
        // Apply slippage to ETH value
        uint256 minAmount = valueInEth.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Remove just the frxETH from the Curve pool
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

    function _lpWithdraw(uint256 _wethAmount) internal {
        // withdraw and unwrap with claim takes back the lpTokens
        // and also collects the rewards for deposit
        cvxRewardStaker.withdrawAndUnwrap(_wethAmount, true);
    }

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        require(_asset == address(asset), "Unsupported asset");

        // Eth balance needed here for the balance check that happens from vault during depositing.
        balance = address(this).balance;
        uint256 lpTokens = cvxRewardStaker.balanceOf(address(this));
        if (lpTokens > 0) {
            balance += (lpTokens * curvePool.get_virtual_price()) / 1e18;
        }
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
        override
        onlyGovernor
        nonReentrant
    {
        _approveBase();
    }

    /**
     * @param _asset Address of the asset
     * @param _pToken Address of the Curve LP token
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function _approveBase() internal {
        // Approve Curve pool for frxETH and OETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        oToken.approve(platformAddress, type(uint256).max);
        // slither-disable-next-line unused-return
        asset.approve(platformAddress, type(uint256).max);

        // Approve Convex deposit contract to transfer Curve pool LP tokens
        // This is needed for deposits if Curve pool LP tokens into the Convex rewards pool
        // slither-disable-next-line unused-return
        lpToken.approve(cvxDepositorAddress, type(uint256).max);
    }

    /**
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }
}
