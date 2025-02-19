// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title SwapX Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the SwapX OS/wS pool
 * @author Origin Protocol Inc
 */
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";
import { IVault } from "../../interfaces/IVault.sol";
import { IWrappedSonic } from "../../interfaces/sonic/IWrappedSonic.sol";
import { IPair } from "../../interfaces/sonic/ISwapXPair.sol";
import { IGauge } from "../../interfaces/sonic/ISwapXGauge.sol";

contract SonicSwapXAMOStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeCast for uint256;

    /**
     * @dev a threshold under which the contract no longer allows for the protocol to manually rebalance.
     *      Guarding against a strategist / guardian being taken over and with multiple transactions
     *      draining the protocol funds.
     */
    uint256 public constant SOLVENCY_THRESHOLD = 0.998 ether;

    // New immutable variables that must be set in the constructor
    /**
     * @notice Address of the Wrapped S (wS) token.
     */
    IWrappedSonic public immutable ws;

    /**
     * @notice Address of the OS token contract.
     */
    IERC20 public immutable os;

    /**
     * @notice Address of the SwapX Stable pool contract.
     */
    address public immutable pool;

    /**
     * @notice Address of the SwapX Gauge contract.
     */
    address public immutable gauge;

    /**
     * @notice Maximum slippage allowed for adding/removing liquidity from the pool.
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

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _os,
        address _ws,
        address _gauge
    ) InitializableAbstractStrategy(_baseConfig) {
        os = IERC20(_os);
        ws = IWrappedSonic(_ws);

        pool = _baseConfig.platformAddress;
        gauge = _gauge;

        _setGovernor(address(0));
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as SwapX strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV
     * @param _maxSlippage Maximum slippage allowed for adding/removing liquidity from the pool.
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV
        uint256 _maxSlippage
    ) external onlyGovernor initializer {
        address[] memory pTokens = new address[](1);
        pTokens[0] = pool;

        address[] memory _assets = new address[](1);
        _assets[0] = address(ws);

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
     * @notice Deposit Wrapped S (wS) into the SwapX pool
     * @param _wS Address of Wrapped S (wS) contract.
     * @param _amount Amount of Wrapped S (wS) to deposit.
     */
    function deposit(address _wS, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_wS, _amount);
    }

    function _deposit(address _wS, uint256 _wsAmount) internal {
        require(_wsAmount > 0, "Must deposit something");
        require(_wS == address(ws), "Can only deposit wS");

        emit Deposit(_wS, pool, _wsAmount);

        // Calculate the required amount of OS to mint based on the wS amount
        // This ensure the proportion of OS tokens being added to the pool matches the proportion of wS tokens.
        // For example, if the added wS tokens is 10% of existing wS tokens in the pool,
        // then the OS tokens being added should also be 10% of the OS tokens in the pool.
        (uint256 wsReserves, uint256 osReserves, ) = IPair(pool).getReserves();
        uint256 osAmount = (_wsAmount * osReserves) / wsReserves;

        // Mint the required OS tokens to the strategy
        IVault(vaultAddress).mintForStrategy(osAmount);

        // Transfer wS to the pool
        ws.transfer(pool, _wsAmount);
        // Transfer OS to the pool
        os.transfer(pool, osAmount);
        // Mint LP tokens from the pool
        uint256 lpTokens = IPair(pool).mint(address(this));

        // deposit the pool's LP tokens into the gauge
        IGauge(gauge).deposit(lpTokens);

        emit Deposit(address(os), pool, osAmount);

        // Ensure solvency of the vault
        _solvencyAssert();
    }

    /**
     * @notice Deposit the strategy's entire balance of Wrapped S (wS) into the pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = ws.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(ws), balance);
        }
    }

    /***************************************
                    Withdraw
    ****************************************/

    /**
     * @notice Withdraw wS and OS from the SwapX pool, burn the OS,
     * and transfer the wS to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _ws Address of the Wrapped S (wS) contract.
     * @param _wsAmount Amount of Wrapped S (wS) to withdraw.
     */
    function withdraw(
        address _recipient,
        address _ws,
        uint256 _wsAmount
    ) external override onlyVault nonReentrant {
        require(_wsAmount > 0, "Must withdraw something");
        require(_ws == address(ws), "Can only withdraw wS");

        emit Withdrawal(_ws, pool, _wsAmount);

        // Calculate how much pool LP tokens to burn to get the required amount of wS tokens back
        uint256 lpTokens = calcTokensToBurn(_wsAmount);

        // Withdraw pool LP tokens from the gauge and remove assets from from the pool
        _withdrawFromGaugeAndPool(lpTokens);

        // Burn all the removed OS and any that was left in the strategy
        uint256 osToBurn = os.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(osToBurn);

        emit Withdrawal(address(os), pool, osToBurn);

        // Transfer wS to the recipient
        require(
            ws.transfer(_recipient, _wsAmount),
            "Transfer of wS not successful"
        );

        // Ensure solvency of the vault
        _solvencyAssert();
    }

    /**
     * @notice Remove all wS and OS from the SwapX pool, burn all the OS,
     * and transfer all the wS to the Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 lpTokens = IGauge(gauge).balanceOf(address(this));
        // Can not withdraw zero LP tokens from the gauge
        if (lpTokens == 0) return;

        // Withdraw pool LP tokens from the gauge and remove assets from from the pool
        _withdrawFromGaugeAndPool(lpTokens);

        // Burn all OS
        uint256 osToBurn = os.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(osToBurn);

        // Get the strategy contract's wS balance.
        // This includes all that was removed from the SwapX pool and
        // any that was sitting in the strategy contract before the removal.
        uint256 wsBalance = ws.balanceOf(address(this));
        require(
            ws.transfer(vaultAddress, wsBalance),
            "Transfer of wS not successful"
        );

        emit Withdrawal(address(ws), pool, wsBalance);
        emit Withdrawal(address(os), pool, osToBurn);
    }

    function calcTokensToBurn(uint256 _wsAmount)
        internal
        returns (uint256 lpTokens)
    {
        // Skim the pool in case extra wS tokens were added
        IPair(pool).skim(address(this));

        /* The rate between coins in the pool determines the rate at which pool returns
         * tokens when doing balanced removal (remove_liquidity call). And by knowing how much wS
         * we want we can determine how much of OS we receive by removing liquidity.
         *
         * Because we are doing balanced removal we should be making profit when removing liquidity in a
         * pool tilted to either side.
         *
         * Important: A downside is that the Strategist / Governor needs to be
         * cognizant of not removing too much liquidity. And while the proposal to remove liquidity
         * is being voted on the pool tilt might change so much that the proposal that has been valid while
         * created is no longer valid.
         */

        lpTokens =
            ((_wsAmount + 1) * IPair(pool).totalSupply()) /
            ws.balanceOf(pool);
    }

    function _withdrawFromGaugeAndPool(uint256 lpTokens) internal {
        // Withdraw pool LP tokens from the gauge
        IGauge(gauge).withdraw(lpTokens);

        // Transfer the pool LP tokens to the pool
        IPair(pool).transfer(pool, lpTokens);
        // Burn the LP tokens and transfer the wS and OS back to the strategy
        IPair(pool).burn(address(this));
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
        uint256 _totalOSSupply = os.totalSupply();

        if (
            _totalVaultValue.divPrecisely(_totalOSSupply) < SOLVENCY_THRESHOLD
        ) {
            revert("Protocol insolvent");
        }
    }

    /***************************************
                Assets and Rewards
    ****************************************/

    /**
     * @notice Collect accumulated SWPx (and other) rewards and send to the Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect SWPx rewards from the gauge
        IGauge(gauge).getReward();

        _collectRewardTokens();
    }

    /**
     * @notice Get the total asset value held in the SwapX pool
     * @param _asset      Address of the Wrapped S (wS) token
     * @return balance    Total value of the wS and OS tokens held in the pool
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == address(ws), "Unsupported asset");

        // wS balance needed here for the balance check that happens from vault during depositing.
        balance = ws.balanceOf(address(this));

        uint256 lpTokens = IGauge(gauge).balanceOf(address(this));
        if (lpTokens == 0) return balance;

        // Add the strategy’s share of the wS and OS tokens in the SwapX pool.
        // (pool’s wS reserves + pool’s OS reserves) * strategy’s LP tokens / total supply of pool LP tokens
        (uint256 wsReserves, uint256 osReserves, ) = IPair(pool).getReserves();
        balance +=
            ((wsReserves + osReserves) * lpTokens) /
            IPair(pool).totalSupply();
    }

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == address(ws);
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

    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function _approveBase() internal {
        // Approve pool for OS (required for adding liquidity)
        // slither-disable-next-line unused-return
        os.approve(platformAddress, type(uint256).max);

        // Approve SwapX pool for wS (required for adding liquidity)
        // slither-disable-next-line unused-return
        ws.approve(platformAddress, type(uint256).max);

        // Approve SwapX gauge contract to transfer SwapX pool LP tokens
        // This is needed for deposits of SwapX pool LP tokens into the gauge.
        // slither-disable-next-line unused-return
        IPair(pool).approve(address(gauge), type(uint256).max);
    }

    /**
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }
}
