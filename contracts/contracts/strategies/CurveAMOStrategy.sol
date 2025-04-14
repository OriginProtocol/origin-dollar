// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title Curve Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for a Curve pool using an OToken.
 * @author Origin Protocol Inc
 */
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { ICurveStableSwapNG } from "../interfaces/ICurveStableSwapNG.sol";
import { ICurveLiquidityGaugeV6 } from "../interfaces/ICurveLiquidityGaugeV6.sol";
import { IBasicToken } from "../interfaces/IBasicToken.sol";
import { ICurveMinter } from "../interfaces/ICurveMinter.sol";

contract CurveAMOStrategy is InitializableAbstractStrategy {
    using SafeCast for uint256;
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    /**
     * @dev a threshold under which the contract no longer allows for the protocol to manually rebalance.
     *      Guarding against a strategist / guardian being taken over and with multiple transactions
     *      draining the protocol funds.
     */
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;

    // New immutable variables that must be set in the constructor
    /**
     * @notice Address of the hard asset (weth, usdt, usdc).
     */
    IERC20 public immutable hardAsset;

    /**
     * @notice Address of the OTOKEN token contract.
     */
    IERC20 public immutable oToken;

    /**
     * @notice Address of the LP (Liquidity Provider) token contract.
     */
    IERC20 public immutable lpToken;

    /**
     * @notice Address of the Curve StableSwap NG pool contract.
     */
    ICurveStableSwapNG public immutable curvePool;

    /**
     * @notice Address of the Curve X-Chain Liquidity Gauge contract.
     */
    ICurveLiquidityGaugeV6 public immutable gauge;

    /**
     * @notice Address of the Curve Minter contract.
     */
    ICurveMinter public immutable minter;

    /**
     * @notice Index of the OTOKEN and hardAsset in the Curve pool.
     */
    uint128 public immutable otokenCoinIndex;
    uint128 public immutable hardAssetCoinIndex;

    /**
     * @notice Decimals of the OTOKEN and hardAsset.
     */
    uint8 public immutable decimalsOToken;
    uint8 public immutable decimalsHardAsset;

    /**
     * @notice Maximum slippage allowed for adding/removing liquidity from the Curve pool.
     */
    uint256 public maxSlippage;

    event MaxSlippageUpdated(uint256 newMaxSlippage);

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
     * This modifier is only applied to functions that do a single sided add or remove.
     * The standard deposit function adds to both sides of the pool in a way that
     * the pool's balance is not worsened.
     * Withdrawals are proportional so doesn't change the pools asset balance.
     */
    modifier improvePoolBalance() {
        // Get the hard asset and OToken balances in the Curve pool
        uint256[] memory balancesBefore = curvePool.get_balances();
        // diff = hardAsset balance - OTOKEN balance
        int256 diffBefore = (
            balancesBefore[hardAssetCoinIndex].scaleBy(
                decimalsOToken,
                decimalsHardAsset
            )
        ).toInt256() - balancesBefore[otokenCoinIndex].toInt256();

        _;

        // Get the hard asset and OToken balances in the Curve pool
        uint256[] memory balancesAfter = curvePool.get_balances();
        // diff = hardAsset balance - OTOKEN balance
        int256 diffAfter = (
            balancesAfter[hardAssetCoinIndex].scaleBy(
                decimalsOToken,
                decimalsHardAsset
            )
        ).toInt256() - balancesAfter[otokenCoinIndex].toInt256();

        if (diffBefore == 0) {
            require(diffAfter == 0, "Position balance is worsened");
        } else if (diffBefore < 0) {
            // If the pool was originally imbalanced in favor of OTOKEN, then
            // we want to check that the pool is now more balanced
            require(diffAfter <= 0, "OTokens overshot peg");
            require(diffBefore < diffAfter, "OTokens balance worse");
        } else if (diffBefore > 0) {
            // If the pool was originally imbalanced in favor of hardAsset, then
            // we want to check that the pool is now more balanced
            require(diffAfter >= 0, "Assets overshot peg");
            require(diffAfter < diffBefore, "Assets balance worse");
        }
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _otoken,
        address _hardAsset,
        address _gauge,
        address _minter
    ) InitializableAbstractStrategy(_baseConfig) {
        lpToken = IERC20(_baseConfig.platformAddress);
        curvePool = ICurveStableSwapNG(_baseConfig.platformAddress);
        minter = ICurveMinter(_minter);

        oToken = IERC20(_otoken);
        hardAsset = IERC20(_hardAsset);
        gauge = ICurveLiquidityGaugeV6(_gauge);
        decimalsHardAsset = IBasicToken(_hardAsset).decimals();
        decimalsOToken = IBasicToken(_otoken).decimals();

        (hardAssetCoinIndex, otokenCoinIndex) = curvePool.coins(0) == _hardAsset
            ? (0, 1)
            : (1, 0);
        require(
            curvePool.coins(otokenCoinIndex) == _otoken &&
                curvePool.coins(hardAssetCoinIndex) == _hardAsset,
            "Invalid coin indexes"
        );
        require(gauge.lp_token() == address(curvePool), "Invalid pool");
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV
     * @param _maxSlippage Maximum slippage allowed for adding/removing liquidity from the Curve pool.
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV
        uint256 _maxSlippage
    ) external onlyGovernor initializer {
        address[] memory pTokens = new address[](1);
        pTokens[0] = address(curvePool);

        address[] memory _assets = new address[](1);
        _assets[0] = address(hardAsset);

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            pTokens
        );

        _approveBase();
        _setMaxSlippage(_maxSlippage);
    }

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit hard asset into the Curve pool
     * @param _hardAsset Address of hard asset contract.
     * @param _amount Amount of hard asset to deposit.
     */
    function deposit(address _hardAsset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_hardAsset, _amount);
    }

    function _deposit(address _hardAsset, uint256 _hardAssetAmount) internal {
        require(_hardAssetAmount > 0, "Must deposit something");
        require(_hardAsset == address(hardAsset), "Unsupported asset");

        emit Deposit(_hardAsset, address(lpToken), _hardAssetAmount);
        uint256 scaledHardAssetAmount = _hardAssetAmount.scaleBy(
            decimalsOToken,
            decimalsHardAsset
        );

        // Get the asset and OToken balances in the Curve pool
        uint256[] memory balances = curvePool.get_balances();
        // safe to cast since min value is at least 0
        uint256 otokenToAdd = uint256(
            _max(
                0,
                (
                    balances[hardAssetCoinIndex].scaleBy(
                        decimalsOToken,
                        decimalsHardAsset
                    )
                ).toInt256() +
                    scaledHardAssetAmount.toInt256() -
                    balances[otokenCoinIndex].toInt256()
            )
        );

        /* Add so much OTOKEN so that the pool ends up being balanced. And at minimum
         * add as much OTOKEN as hard asset and at maximum twice as much OTOKEN.
         */
        otokenToAdd = Math.max(otokenToAdd, scaledHardAssetAmount);
        otokenToAdd = Math.min(otokenToAdd, scaledHardAssetAmount * 2);

        /* Mint OTOKEN with a strategy that attempts to contribute to stability of OTOKEN/hardAsset pool. Try
         * to mint so much OTOKEN that after deployment of liquidity pool ends up being balanced.
         *
         * To manage unpredictability minimal OTOKEN minted will always be at least equal or greater
         * to hardAsset amount deployed. And never larger than twice the hardAsset amount deployed even if
         * it would have a further beneficial effect on pool stability.
         */
        IVault(vaultAddress).mintForStrategy(otokenToAdd);

        emit Deposit(address(oToken), address(lpToken), otokenToAdd);

        uint256[] memory _amounts = new uint256[](2);
        _amounts[hardAssetCoinIndex] = _hardAssetAmount;
        _amounts[otokenCoinIndex] = otokenToAdd;

        uint256 valueInLpTokens = (scaledHardAssetAmount + otokenToAdd)
            .divPrecisely(curvePool.get_virtual_price());
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - maxSlippage
        );

        // Do the deposit to the Curve pool
        uint256 lpDeposited = curvePool.add_liquidity(_amounts, minMintAmount);
        require(lpDeposited >= minMintAmount, "Min LP amount error");

        // Deposit the Curve pool's LP tokens into the Curve gauge
        gauge.deposit(lpDeposited);

        // Ensure solvency of the vault
        _solvencyAssert();
    }

    /**
     * @notice Deposit the strategy's entire balance of hardAsset into the Curve pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = hardAsset.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(hardAsset), balance);
        }
    }

    /***************************************
                    Withdraw
    ****************************************/

    /**
     * @notice Withdraw hardAsset and OTOKEN from the Curve pool, burn the OTOKEN,
     * transfer hardAsset to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _hardAsset Address of the hardAsset contract.
     * @param _amount Amount of hardAsset to withdraw.
     */
    function withdraw(
        address _recipient,
        address _hardAsset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(
            _hardAsset == address(hardAsset),
            "Can only withdraw hard asset"
        );

        emit Withdrawal(_hardAsset, address(lpToken), _amount);

        uint256 requiredLpTokens = calcTokenToBurn(
            _amount.scaleBy(decimalsOToken, decimalsHardAsset)
        );

        _lpWithdraw(requiredLpTokens);

        /* math in requiredLpTokens should correctly calculate the amount of LP to remove
         * in that the strategy receives enough hardAsset on balanced removal
         */
        uint256[] memory _minWithdrawalAmounts = new uint256[](2);
        _minWithdrawalAmounts[hardAssetCoinIndex] = _amount;
        // slither-disable-next-line unused-return
        curvePool.remove_liquidity(requiredLpTokens, _minWithdrawalAmounts);

        // Burn all the removed OTOKEN and any that was left in the strategy
        uint256 otokenToBurn = oToken.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(otokenToBurn);

        emit Withdrawal(address(oToken), address(lpToken), otokenToBurn);

        // Transfer hardAsset to the recipient
        hardAsset.safeTransfer(_recipient, _amount);

        // Ensure solvency of the vault
        _solvencyAssert();
    }

    function calcTokenToBurn(uint256 _hardAssetAmount)
        internal
        view
        returns (uint256 lpToBurn)
    {
        /* The rate between coins in the pool determines the rate at which pool returns
         * tokens when doing balanced removal (remove_liquidity call). And by knowing how much hardAsset
         * we want we can determine how much of OTOKEN we receive by removing liquidity.
         *
         * Because we are doing balanced removal we should be making profit when removing liquidity in a
         * pool tilted to either side.
         *
         * Important: A downside is that the Strategist / Governor needs to be
         * cognisant of not removing too much liquidity. And while the proposal to remove liquidity
         * is being voted on the pool tilt might change so much that the proposal that has been valid while
         * created is no longer valid.
         */

        uint256 poolHardAssetBalance = curvePool
            .balances(hardAssetCoinIndex)
            .scaleBy(decimalsOToken, decimalsHardAsset);
        /* K is multiplied by 1e36 which is used for higher precision calculation of required
         * pool LP tokens. Without it the end value can have rounding errors up to precision of
         * 10 digits. This way we move the decimal point by 36 places when doing the calculation
         * and again by 36 places when we are done with it.
         */
        uint256 k = (1e36 * lpToken.totalSupply()) / poolHardAssetBalance;
        // prettier-ignore
        // slither-disable-next-line divide-before-multiply
        uint256 diff = (_hardAssetAmount + 1) * k;
        lpToBurn = diff / 1e36;
    }

    /**
     * @notice Remove all hardAsset and OTOKEN from the Curve pool, burn the OTOKEN,
     * transfer hardAsset to the Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 gaugeTokens = gauge.balanceOf(address(this));
        _lpWithdraw(gaugeTokens);

        // Withdraws are proportional to assets held by 3Pool
        uint256[] memory minWithdrawAmounts = new uint256[](2);

        // Check balance of LP tokens in the strategy, if 0 return
        uint256 lpBalance = lpToken.balanceOf(address(this));

        // Remove liquidity
        // slither-disable-next-line unused-return
        if (lpBalance > 0) {
            curvePool.remove_liquidity(lpBalance, minWithdrawAmounts);
        }

        // Burn all OTOKEN
        uint256 otokenToBurn = oToken.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(otokenToBurn);

        // Get the strategy contract's hardAsset balance.
        // This includes all that was removed from the Curve pool and
        // any hardAsset that was sitting in the strategy contract before the removal.
        uint256 hardAssetBalance = hardAsset.balanceOf(address(this));
        hardAsset.safeTransfer(vaultAddress, hardAssetBalance);

        if (hardAssetBalance > 0)
            emit Withdrawal(
                address(hardAsset),
                address(lpToken),
                hardAssetBalance
            );
        if (otokenToBurn > 0)
            emit Withdrawal(address(oToken), address(lpToken), otokenToBurn);
    }

    /***************************************
            Curve pool Rebalancing
    ****************************************/

    /**
     * @notice Mint OTokens and one-sided add to the Curve pool.
     * This is used when the Curve pool does not have enough OTokens and too many hardAsset.
     * The OToken/Asset, eg OTOKEN/hardAsset, price with increase.
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

        uint256[] memory amounts = new uint256[](2);
        amounts[otokenCoinIndex] = _oTokens;

        // Convert OTOKEN to Curve pool LP tokens
        uint256 valueInLpTokens = (_oTokens).divPrecisely(
            curvePool.get_virtual_price()
        );
        // Apply slippage to LP tokens
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - maxSlippage
        );

        // Add the minted OTokens to the Curve pool
        uint256 lpDeposited = curvePool.add_liquidity(amounts, minMintAmount);
        require(lpDeposited >= minMintAmount, "Min LP amount error");

        // Deposit the Curve pool LP tokens to the Curve gauge
        gauge.deposit(lpDeposited);

        // Ensure solvency of the vault
        _solvencyAssert();

        emit Deposit(address(oToken), address(lpToken), _oTokens);
    }

    /**
     * @notice One-sided remove of OTokens from the Curve pool which are then burned.
     * This is used when the Curve pool has too many OTokens and not enough hardAsset.
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
        // Withdraw Curve pool LP tokens from gauge and remove OTokens from the Curve pool
        uint256 otokenToBurn = _withdrawAndRemoveFromPool(
            _lpTokens,
            otokenCoinIndex
        );

        // The vault burns the OTokens from this strategy
        IVault(vaultAddress).burnForStrategy(otokenToBurn);

        // Ensure solvency of the vault
        _solvencyAssert();

        emit Withdrawal(address(oToken), address(lpToken), otokenToBurn);
    }

    /**
     * @notice One-sided remove of hardAsset from the Curve pool and transfer to the vault.
     * This is used when the Curve pool does not have enough OTokens and too many hardAsset.
     * The OToken/Asset, eg OTOKEN/hardAsset, price with decrease.
     * The amount of assets in the vault increases.
     * The total supply of OTokens does not change.
     * The asset value of the strategy reduces.
     * The asset value of the vault should be close to the same.
     * @param _lpTokens The amount of Curve pool LP tokens to be burned for hardAsset.
     * @dev Curve pool LP tokens is used rather than hardAsset assets as Curve does not
     * have a way to accurately calculate the amount of LP tokens for a required
     * amount of hardAsset. Curve's `calc_token_amount` function does not include fees.
     * A 3rd party library can be used that takes into account the fees, but this
     * is a gas intensive process. It's easier for the trusted strategist to
     * calculate the amount of Curve pool LP tokens required off-chain.
     */
    function removeOnlyAssets(uint256 _lpTokens)
        external
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        // Withdraw Curve pool LP tokens from Curve gauge and remove hardAsset from the Curve pool
        uint256 hardAssetAmount = _withdrawAndRemoveFromPool(
            _lpTokens,
            hardAssetCoinIndex
        );

        // Transfer hardAsset to the vault
        hardAsset.safeTransfer(vaultAddress, hardAssetAmount);

        // Ensure solvency of the vault
        _solvencyAssert();

        emit Withdrawal(address(hardAsset), address(lpToken), hardAssetAmount);
    }

    /**
     * @dev Remove Curve pool LP tokens from the gauge and
     * do a one-sided remove of hardAsset or OTOKEN from the Curve pool.
     * @param _lpTokens The amount of Curve pool LP tokens to be removed from the gauge
     * @param coinIndex The index of the coin to be removed from the Curve pool. 0 = hardAsset, 1 = OTOKEN.
     * @return coinsRemoved The amount of hardAsset or OTOKEN removed from the Curve pool.
     */
    function _withdrawAndRemoveFromPool(uint256 _lpTokens, uint128 coinIndex)
        internal
        returns (uint256 coinsRemoved)
    {
        // Withdraw Curve pool LP tokens from Curve gauge
        _lpWithdraw(_lpTokens);

        // Convert Curve pool LP tokens to hardAsset value
        uint256 valueInEth = _lpTokens.mulTruncate(
            curvePool.get_virtual_price()
        );

        if (coinIndex == hardAssetCoinIndex) {
            valueInEth = valueInEth.scaleBy(decimalsHardAsset, decimalsOToken);
        }

        // Apply slippage to hardAsset value
        uint256 minAmount = valueInEth.mulTruncate(uint256(1e18) - maxSlippage);

        // Remove just the hardAsset from the Curve pool
        coinsRemoved = curvePool.remove_liquidity_one_coin(
            _lpTokens,
            int128(coinIndex),
            minAmount,
            address(this)
        );
    }

    /**
     * Checks that the protocol is solvent, protecting from a rogue Strategist / Guardian that can
     * keep rebalancing the pool in both directions making the protocol lose a tiny amount of
     * funds each time.
     *
     * Protocol must be at least SOLVENCY_THRESHOLD (99,8 %) backed in order for the rebalances to
     * function.
     */
    function _solvencyAssert() internal view {
        uint256 _totalVaultValue = IVault(vaultAddress).totalValue();
        uint256 _totalOtokenSupply = oToken.totalSupply();

        if (
            _totalVaultValue.divPrecisely(_totalOtokenSupply) <
            SOLVENCY_THRESHOLD
        ) {
            revert("Protocol insolvent");
        }
    }

    /***************************************
                Assets and Rewards
    ****************************************/

    /**
     * @notice Collect accumulated CRV (and other) rewards and send to the Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect CRV rewards from inflation
        minter.mint(address(gauge));

        // Collect extra gauge rewards (outside of CRV)
        gauge.claim_rewards();

        _collectRewardTokens();
    }

    function _lpWithdraw(uint256 _lpAmount) internal {
        require(
            gauge.balanceOf(address(this)) >= _lpAmount,
            "Insufficient LP tokens"
        );
        // withdraw lp tokens from the gauge without claiming rewards
        gauge.withdraw(_lpAmount);
    }

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == address(hardAsset), "Unsupported asset");

        // hardAsset balance needed here for the balance check that happens from vault during depositing.
        balance = hardAsset.balanceOf(address(this));
        uint256 lpTokens = gauge.balanceOf(address(this));
        if (lpTokens > 0) {
            balance += ((lpTokens * curvePool.get_virtual_price()) / 1e18)
                .scaleBy(decimalsHardAsset, decimalsOToken);
        }
    }

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == address(hardAsset);
    }

    /***************************************
                    Approvals
    ****************************************/

    /**
     * @notice Sets the maximum slippage allowed for any swap/liquidity operation
     * @param _maxSlippage Maximum slippage allowed, 1e18 = 100%.
     */
    function setMaxSlippage(uint256 _maxSlippage) external onlyGovernor {
        _setMaxSlippage(_maxSlippage);
    }

    function _setMaxSlippage(uint256 _maxSlippage) internal {
        require(_maxSlippage <= 5e16, "Slippage must be less than 100%");
        maxSlippage = _maxSlippage;
        emit MaxSlippageUpdated(_maxSlippage);
    }

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
     * @dev Since we are unwrapping WETH before depositing it to Curve
     *      there is no need to set an approval for WETH on the Curve
     *      pool
     * @param _asset Address of the asset
     * @param _pToken Address of the Curve LP token
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function _approveBase() internal {
        // Approve Curve pool for OTOKEN (required for adding liquidity)
        // slither-disable-next-line unused-return
        oToken.approve(platformAddress, type(uint256).max);

        // Approve Curve pool for hardAsset (required for adding liquidity)
        // slither-disable-next-line unused-return
        hardAsset.safeApprove(platformAddress, type(uint256).max);

        // Approve Curve gauge contract to transfer Curve pool LP tokens
        // This is needed for deposits if Curve pool LP tokens into the Curve gauge.
        // slither-disable-next-line unused-return
        lpToken.approve(address(gauge), type(uint256).max);
    }

    /**
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }
}
