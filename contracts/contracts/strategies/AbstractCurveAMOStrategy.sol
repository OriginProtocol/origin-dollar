// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Convex Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve OETH/ETH pool
 * @author Origin Protocol Inc
 */
import "@openzeppelin/contracts/utils/math/Math.sol";

import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";

interface IGeneralCurvePool {
    function get_virtual_price() external view returns (uint256);

    function balances(uint256 arg0) external view returns (uint256);
}

abstract contract AbstractCurveAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;

    // New immutable variables that must be set in the constructor
    IGeneralCurvePool public immutable curvePool;
    IERC20 public immutable lpToken;
    IERC20 public immutable oeth;
    IWETH9 public immutable weth;

    // Ordered list of pool assets
    uint128 public constant oethCoinIndex = 1;
    uint128 public constant ethCoinIndex = 0;

    //@dev when true the strategy operates with native ETH when adding to or
    //     removing liquidity from the underlying pool. 
    bool public immutable operatesWithNativeETH;

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
        uint256[] memory balancesBefore = _getBalances();
        // diff = ETH balance - OETH balance
        int256 diffBefore = int256(balancesBefore[ethCoinIndex]) -
            int256(balancesBefore[oethCoinIndex]);

        _;

        // Get the asset and OToken balances in the Curve pool
        uint256[] memory balancesAfter = _getBalances();
        // diff = ETH balance - OETH balance
        int256 diffAfter = int256(balancesAfter[ethCoinIndex]) -
            int256(balancesAfter[oethCoinIndex]);

        if (diffBefore <= 0) {
            // If the pool was originally imbalanced in favor of OETH, then
            // we want to check that the pool is now more balanced
            require(diffAfter <= 0, "OTokens overshot peg");
            require(diffBefore < diffAfter, "OTokens balance worse");
        }
        if (diffBefore >= 0) {
            // If the pool was originally imbalanced in favor of ETH, then
            // we want to check that the pool is now more balanced
            require(diffAfter >= 0, "Assets overshot peg");
            require(diffAfter < diffBefore, "Assets balance worse");
        }
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _oeth,
        address _weth,
        bool _operatesWithNativeETH
    ) InitializableAbstractStrategy(_baseConfig) {
        lpToken = IERC20(_baseConfig.platformAddress);
        curvePool = IGeneralCurvePool(_baseConfig.platformAddress);

        oeth = IERC20(_oeth);
        weth = IWETH9(_weth);
        operatesWithNativeETH = _operatesWithNativeETH;
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. eg WETH
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + ...
        address[] calldata _assets // WETH
    ) external virtual onlyGovernor initializer {
        require(_assets.length == 1, "Must have exactly one asset");
        require(_assets[0] == address(weth), "Asset not WETH");

        address[] memory pTokens = new address[](1);
        pTokens[0] = address(curvePool);

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            pTokens
        );

        _approveBase();
    }

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit WETH into the Curve pool
     * @param _weth Address of Wrapped ETH (WETH) contract.
     * @param _amount Amount of WETH to deposit.
     */
    function deposit(address _weth, uint256 _amount)
        public
        virtual
        override
        onlyVault
        nonReentrant
    {
        _deposit(_weth, _amount);
    }

    function _deposit(address _weth, uint256 _wethAmount) internal {
        require(_wethAmount > 0, "Must deposit something");
        require(_weth == address(weth), "Can only deposit WETH");

        if (operatesWithNativeETH){
            weth.withdraw(_wethAmount);
        }

        emit Deposit(_weth, address(lpToken), _wethAmount);

        // Get the asset and OToken balances in the Curve pool
        uint256[] memory balances = _getBalances();
        // safe to cast since min value is at least 0
        uint256 oethToAdd = uint256(
            _max(
                0,
                int256(balances[ethCoinIndex]) +
                    int256(_wethAmount) -
                    int256(balances[oethCoinIndex])
            )
        );

        /* Add so much OETH so that the pool ends up being balanced. And at minimum
         * add as much OETH as WETH and at maximum twice as much OETH.
         */
        oethToAdd = Math.max(oethToAdd, _wethAmount);
        oethToAdd = Math.min(oethToAdd, _wethAmount * 2);

        /* Mint OETH with a strategy that attempts to contribute to stability of OETH/WETH pool. Try
         * to mint so much OETH that after deployment of liquidity pool ends up being balanced.
         *
         * To manage unpredictability minimal OETH minted will always be at least equal or greater
         * to WETH amount deployed. And never larger than twice the WETH amount deployed even if
         * it would have a further beneficial effect on pool stability.
         */
        IVault(vaultAddress).mintForStrategy(oethToAdd);

        emit Deposit(address(oeth), address(lpToken), oethToAdd);

        uint256[] memory _amounts = new uint256[](2);
        _amounts[ethCoinIndex] = _wethAmount;
        _amounts[oethCoinIndex] = oethToAdd;

        uint256 valueInLpTokens = (_wethAmount + oethToAdd).divPrecisely(
            curvePool.get_virtual_price()
        );
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - maxSlippage()
        );

        uint256 lpDeposited = _addLiquidity(
            _amounts,
            minMintAmount
        );

        _stakeLP(lpDeposited);

        _solvencyAssert();
    }

    /**
     * @notice Deposit the strategy's entire balance of WETH into the Curve pool
     */
    function depositAll() public virtual override onlyVault nonReentrant {
        uint256 balance = weth.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(weth), balance);
        }
    }

    /***************************************
                    Withdraw
    ****************************************/

    /**
     * @notice Withdraw ETH and OETH from the Curve pool, burn the OETH,
     * convert the ETH to WETH and transfer to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _weth Address of the Wrapped ETH (WETH) contract.
     * @param _amount Amount of WETH to withdraw.
     */
    function withdraw(
        address _recipient,
        address _weth,
        uint256 _amount
    ) public virtual override onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_weth == address(weth), "Can only withdraw WETH");

        emit Withdrawal(_weth, address(lpToken), _amount);

        uint256 requiredLpTokens = calcTokenToBurn(_amount);

        _unstakeLP(requiredLpTokens);

        /* math in requiredLpTokens should correctly calculate the amount of LP to remove
         * in that the strategy receives enough WETH on balanced removal
         */
        uint256[] memory _minWithdrawalAmounts = new uint256[](2);
        _minWithdrawalAmounts[ethCoinIndex] = _amount;

        _removeLiquidity(requiredLpTokens, _minWithdrawalAmounts);

        // Burn all the removed OETH and any that was left in the strategy
        uint256 oethToBurn = oeth.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        emit Withdrawal(address(oeth), address(lpToken), oethToBurn);

        // Wrap ETH in wETH if needed
        if (operatesWithNativeETH) {
            weth.deposit{ value: _amount }();
        }

        // Transfer WETH to the recipient
        require(
            weth.transfer(_recipient, _amount),
            "Transfer of WETH not successful"
        );

        _solvencyAssert();
    }

    function calcTokenToBurn(uint256 _wethAmount)
        internal
        view
        returns (uint256 lpToBurn)
    {
        /* The rate between coins in the pool determines the rate at which pool returns
         * tokens when doing balanced removal (remove_liquidity call). And by knowing how much WETH
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

        uint256 poolWETHBalance = curvePool.balances(ethCoinIndex);
        /* K is multiplied by 1e36 which is used for higher precision calculation of required
         * pool LP tokens. Without it the end value can have rounding errors up to precision of
         * 10 digits. This way we move the decimal point by 36 places when doing the calculation
         * and again by 36 places when we are done with it.
         */
        uint256 k = (1e36 * lpToken.totalSupply()) / poolWETHBalance;
        // prettier-ignore
        // slither-disable-next-line divide-before-multiply
        uint256 diff = (_wethAmount + 1) * k;
        lpToBurn = diff / 1e36;
    }

    /**
     * @notice Remove all ETH and OETH from the Curve pool, burn the OETH,
     * convert the ETH to WETH and transfer to the Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        _unstakeLP(type(uint256).max);

        // Withdraws are proportional to assets held by 3Pool
        uint256[] memory minWithdrawAmounts = new uint256[](2);

        _removeLiquidity(type(uint256).max, minWithdrawAmounts);

        // Burn all OETH
        uint256 oethToBurn = oeth.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        // Get the strategy contract's ether/WETH balance.
        // This includes all that was removed from the Curve pool and
        // any ether that was sitting in the strategy contract before the removal.
        uint256 wethBalance;
        if (operatesWithNativeETH) {
            // intentional misnomer as this ETH becomes WETH in the next step
            wethBalance = address(this).balance;
            weth.deposit{ value: wethBalance }();
        } else {
            wethBalance = weth.balanceOf(address(this));
        }

        require(
            weth.transfer(vaultAddress, wethBalance),
            "Transfer of WETH not successful"
        );

        emit Withdrawal(address(weth), address(lpToken), wethBalance);
        emit Withdrawal(address(oeth), address(lpToken), oethToBurn);
    }

    /***************************************
            Curve pool Rebalancing
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
        public
        virtual
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        IVault(vaultAddress).mintForStrategy(_oTokens);

        uint256[] memory amounts = new uint256[](2);
        amounts[oethCoinIndex] = _oTokens;

        // Convert OETH to Curve pool LP tokens
        uint256 valueInLpTokens = (_oTokens).divPrecisely(
            curvePool.get_virtual_price()
        );
        // Apply slippage to LP tokens
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - maxSlippage()
        );

        // Add the minted OTokens to the Curve pool
        uint256 lpDeposited = _addLiquidity(amounts, minMintAmount);

        // Deposit the Curve pool LP tokens to the Convex rewards pool
        _stakeLP(lpDeposited);

        _solvencyAssert();

        emit Deposit(address(oeth), address(lpToken), _oTokens);
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
        public
        virtual
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        // Withdraw Curve pool LP tokens from Convex and remove OTokens from the Curve pool
        uint256 oethToBurn = _withdrawAndRemoveFromPool(
            _lpTokens,
            oethCoinIndex
        );

        // The vault burns the OTokens from this strategy
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        _solvencyAssert();

        emit Withdrawal(address(oeth), address(lpToken), oethToBurn);
    }

    /**
     * @notice One-sided remove of ETH from the Curve pool, convert to WETH
     * and transfer to the vault.
     * This is used when the Curve pool does not have enough OTokens and too many ETH.
     * The OToken/Asset, eg OETH/ETH, price with decrease.
     * The amount of assets in the vault increases.
     * The total supply of OTokens does not change.
     * The asset value of the strategy reduces.
     * The asset value of the vault should be close to the same.
     * @param _lpTokens The amount of Curve pool LP tokens to be burned for ETH.
     * @dev Curve pool LP tokens is used rather than WETH assets as Curve does not
     * have a way to accurately calculate the amount of LP tokens for a required
     * amount of ETH. Curve's `calc_token_amount` functioun does not include fees.
     * A 3rd party libary can be used that takes into account the fees, but this
     * is a gas intensive process. It's easier for the trusted strategist to
     * caclulate the amount of Curve pool LP tokens required off-chain.
     */
    function removeOnlyAssets(uint256 _lpTokens)
        public
        virtual
        onlyStrategist
        nonReentrant
        improvePoolBalance
    {
        // Withdraw Curve pool LP tokens from Convex and remove ETH from the Curve pool
        // misnomer as this is sometimes WETH sometimes ETH
        uint256 ethAmount = _withdrawAndRemoveFromPool(_lpTokens, ethCoinIndex);

        // Wrap ETH in wETH if needed
        if (operatesWithNativeETH) {
            weth.deposit{ value: ethAmount }();
        }

        // Transfer WETH to the vault
        require(
            weth.transfer(vaultAddress, ethAmount),
            "Transfer of WETH not successful"
        );

        _solvencyAssert();

        emit Withdrawal(address(weth), address(lpToken), ethAmount);
    }

    /**
     * @dev Remove Curve pool LP tokens from the Convex pool and
     * do a one-sided remove of ETH or OETH from the Curve pool.
     * @param _lpTokens The amount of Curve pool LP tokens to be removed from the Convex pool.
     * @param coinIndex The index of the coin to be removed from the Curve pool. 0 = ETH, 1 = OETH.
     * @return coinsRemoved The amount of ETH or OETH removed from the Curve pool.
     */
    function _withdrawAndRemoveFromPool(uint256 _lpTokens, uint128 coinIndex)
        internal
        returns (uint256 coinsRemoved)
    {
        // Withdraw Curve pool LP tokens from Convex pool
        _unstakeLP(_lpTokens);

        // Convert Curve pool LP tokens to ETH value
        uint256 valueInEth = _lpTokens.mulTruncate(
            curvePool.get_virtual_price()
        );
        // Apply slippage to ETH value
        uint256 minAmount = valueInEth.mulTruncate(
            uint256(1e18) - maxSlippage()
        );

        // Remove just the ETH from the Curve pool
        coinsRemoved = _removeLiquidityOneCoin(_lpTokens, coinIndex, minAmount);
    }

    /***************************************
                Internal functions
    ****************************************/

    function _addLiquidity(
        uint256[] memory _amounts,
        uint256 _minMintAmount
    ) internal virtual returns (uint256);

    function _removeLiquidity(
        uint256 _requiredLpTokens,
        uint256[] memory _minAmounts
    ) internal virtual;

    function _removeLiquidityOneCoin(
        uint256 _lpTokens,
        uint128 _coinIndex,
        uint256 _minAmount
    ) internal virtual returns (uint256);

    function _stakeLP(uint256 _lpTokens) internal virtual;

    function _unstakeLP(uint256 _lpToken) internal virtual;

    function _claimReward() internal virtual;

    function _approveBase() internal virtual;

    function _getBalances() internal view virtual returns (uint256[] memory);

    function _solvencyAssert() internal view virtual;

    function maxSlippage() internal view virtual returns (uint256);

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
        _claimReward();
        _collectRewardTokens();
    }

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == address(weth);
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
     * @notice Accept unwrapped WETH
     */
    receive() external payable {}

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

    /**
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }
}
