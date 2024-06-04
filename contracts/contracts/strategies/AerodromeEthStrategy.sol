// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Aerodrome Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Aero OETH/ETH pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { IRouter } from "./../interfaces/aerodrome/IRouter.sol";
import { IGauge } from "./../interfaces/aerodrome/IGauge.sol";
import { IPool } from "./../interfaces/aerodrome/IPool.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { FixedPointMathLib } from "solady/src/utils/FixedPointMathLib.sol";

contract AerodromeEthStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX_SLIPPAGE = 1e16; // 1%
    address public constant ETH_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    IGauge public immutable aeroGaugeAddress;
    IRouter public immutable aeroRouterAddress;
    address public immutable aeroFactoryAddress;

    IPool public immutable lpTokenAddress;
    IERC20 public immutable oeth;
    IWETH9 public immutable weth;

    // Ordered list of pool assets
    uint128 public immutable wethCoinIndex;
    uint128 public immutable oethCoinIndex;

    // Used to circumvent the stack too deep issue
    struct AerodromeEthConfig {
        address aeroRouterAddress; //Address of the Aerodrome router
        address aeroGaugeAddress; //Address of the Aerodrome gauge
        address aeroFactoryAddress; // Address of the Aerodrome PoolFactory
        address lpTokenAddress; //Address of the OETH/ETH Aero LPToken
        address oethAddress; //Address of OETH token
        address wethAddress; //Address of WETH
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
     * @dev Checks the Aero sAMM pool's balances have improved and the balances
     * have not gone beyond the threshold.
     * The standard deposit function adds to both sides of the pool in a way that
     * the pool's balance is not worsened.
     * Withdrawals are proportional so doesn't change the pools asset balance.
     */
    modifier improvePoolBalance() {
        uint256 midpoint = 0.5e18; // 0.5e18 represents a 50:50 pool balance

        // Get the initial ratio of oeth to weth.
        uint256 initialRatio = aeroRouterAddress.quoteStableLiquidityRatio(
            address(weth),
            address(oeth),
            address(aeroFactoryAddress)
        );

        _;

        // Get the ratio of oeth to weth after rebalance.
        uint256 finalRatio = aeroRouterAddress.quoteStableLiquidityRatio(
            address(weth),
            address(oeth),
            address(aeroFactoryAddress)
        );

        // Ensure that after the rebalance, the WETH reserves do not exceed OETH reserves.
        // We always aim for OETH reserves > WETH reserves.
        require(finalRatio > midpoint, "WETH reserves exceeds OETH");

        // Ensure that the pool balance has improved after the rebalance,
        // meaning the final ratio is closer to 50:50 compared to the initial ratio.
        // For example, if the initial ratio was 0.6 (60% OETH, 40% WETH) and the final ratio is 0.55,
        // it means the pool balance has improved towards the 50:50 target.
        require(initialRatio > finalRatio, "Pool imbalance worsened");
    }

    constructor(
        BaseStrategyConfig memory _baseConfig,
        AerodromeEthConfig memory _aeroConfig
    ) InitializableAbstractStrategy(_baseConfig) {
        lpTokenAddress = IPool(_baseConfig.platformAddress);
        aeroRouterAddress = IRouter(_aeroConfig.aeroRouterAddress);
        aeroFactoryAddress = _aeroConfig.aeroFactoryAddress;
        aeroGaugeAddress = IGauge(_aeroConfig.aeroGaugeAddress);
        oeth = IERC20(_aeroConfig.oethAddress);
        weth = IWETH9(_aeroConfig.wethAddress);

        // Determine token indexes
        wethCoinIndex = IPool(_baseConfig.platformAddress).token0() ==
            address(_aeroConfig.wethAddress)
            ? 0
            : 1;
        oethCoinIndex = IPool(_baseConfig.platformAddress).token0() ==
            address(_aeroConfig.oethAddress)
            ? 0
            : 1;
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Aero strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of AERO
     * @param _assets Addresses of supported assets. eg WETH
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // AERO
        address[] calldata _assets // WETH
    ) external onlyGovernor initializer {
        require(_assets.length == 1, "Must have exactly one asset");
        require(_assets[0] == address(weth), "Asset not WETH");

        address[] memory pTokens = new address[](1);
        pTokens[0] = address(lpTokenAddress);

        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            pTokens
        );

        _approveBase();
    }

    /**
     * @notice Deposit WETH into the Aero pool
     * @param _weth Address of Wrapped ETH (WETH) contract.
     * @param _amount Amount of WETH to deposit.
     */
    function deposit(address _weth, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_weth, _amount);
    }

    function _deposit(address _weth, uint256 _wethAmount) internal {
        require(_wethAmount > 0, "Must deposit something");
        require(_weth == address(weth), "Can only deposit WETH");

        // Get the asset and OToken balances in the Aero's LP
        (
            uint256 reserveWethAmount,
            uint256 reserveOEthAmount
        ) = aeroRouterAddress.getReserves(
                address(weth),
                address(oeth),
                true,
                aeroFactoryAddress
            );

        // Calculate the oeth amount required for given wethAmount based on pool's reserve ratio.
        uint256 oethDesired = (reserveOEthAmount * _wethAmount) /
            reserveWethAmount;

        // Query the amount to be added to the pool
        (uint256 wethToAdd, uint256 oethToAdd, ) = aeroRouterAddress
            .quoteAddLiquidity(
                address(weth),
                address(oeth),
                true,
                address(aeroFactoryAddress),
                _wethAmount,
                oethDesired
            );

        // Mint the required OETH amount
        IVault(vaultAddress).mintForStrategy(oethToAdd);

        // adjust for slippage
        uint256 minOethToAdd = oethToAdd.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );
        uint256 minWethToAdd = wethToAdd.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );
        // Do the deposit to the Aerodrome pool
        // slither-disable-next-line arbitrary-send
        (, , uint256 lpReceived) = aeroRouterAddress.addLiquidity(
            address(weth),
            address(oeth),
            true,
            wethToAdd,
            oethToAdd,
            minWethToAdd,
            minOethToAdd,
            address(this),
            block.timestamp
        );

        emit Deposit(address(oeth), address(lpTokenAddress), oethToAdd);
        emit Deposit(_weth, address(lpTokenAddress), wethToAdd);

        // Deposit the Aero pool's LP tokens into the Gauge
        aeroGaugeAddress.deposit(lpReceived);
    }

    /**
     * @notice Deposit the strategy's entire balance of WETH into the Aero pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = weth.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(weth), balance);
        }
    }

    /**
     * @notice Withdraw ETH and OETH from the Aero pool, burn the OETH,
     * convert the ETH to WETH and transfer to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _weth Address of the Wrapped ETH (WETH) contract.
     * @param _amount Amount of WETH to withdraw.
     */
    function withdraw(
        address _recipient,
        address _weth,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Invalid amount");
        require(_weth == address(weth), "Can only withdraw WETH");

        emit Withdrawal(_weth, address(lpTokenAddress), _amount);

        uint256 requiredLpTokens = _calcTokenToBurn(_amount);

        _lpWithdraw(requiredLpTokens);

        uint256 oethReserves = oethCoinIndex == 0
            ? lpTokenAddress.reserve0()
            : lpTokenAddress.reserve1();

        uint256 oethDesired = requiredLpTokens
            .mulTruncate(oethReserves)
            .divPrecisely(lpTokenAddress.totalSupply());

        oethDesired = oethDesired.mulTruncate(uint256(1e18) - MAX_SLIPPAGE);
        /* math in requiredLpTokens should correctly calculate the amount of LP to remove
         * in that the strategy receives enough WETH on balanced removal
         */
        // slither-disable-next-line unused-return
        aeroRouterAddress.removeLiquidity(
            address(weth),
            address(oeth),
            true,
            requiredLpTokens,
            _amount, // weth amount
            oethDesired,
            address(this),
            block.timestamp
        );

        // Burn all the removed OETH and any that was left in the strategy
        uint256 oethToBurn = oeth.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        emit Withdrawal(address(oeth), address(lpTokenAddress), oethToBurn);

        require(
            weth.transfer(_recipient, _amount),
            "Transfer of WETH not successful"
        );
    }

    function _calcTokenToBurn(uint256 _wethAmount)
        internal
        view
        returns (uint256 lpToBurn)
    {
        /* The rate between coins in the pool determines the rate at which pool returns
         * tokens when doing balanced removal (removeLiquidity call). And by knowing how much WETH
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

        uint256 poolWETHBalance = wethCoinIndex == 0
            ? lpTokenAddress.reserve0()
            : lpTokenAddress.reserve1();

        lpToBurn =
            ((_wethAmount + 1) *
                IERC20(address(lpTokenAddress)).totalSupply()) /
            poolWETHBalance;
    }

    /**
     * @notice Remove all ETH and OETH from the Aero pool, burn the OETH,
     * convert the ETH to WETH and transfer to the Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 gaugeTokens = aeroGaugeAddress.balanceOf(address(this));
        _lpWithdraw(gaugeTokens);

        (uint256 wethReserves, uint256 oethReserves) = aeroRouterAddress
            .getReserves(
                address(weth),
                address(oeth),
                true,
                aeroFactoryAddress
            );

        uint256 oethDesired = gaugeTokens
            .mulTruncate(oethReserves)
            .divPrecisely(lpTokenAddress.totalSupply());

        oethDesired = oethDesired.mulTruncate(uint256(1e18) - MAX_SLIPPAGE);

        uint256 wethDesired = gaugeTokens
            .mulTruncate(wethReserves)
            .divPrecisely(lpTokenAddress.totalSupply());

        wethDesired = wethDesired.mulTruncate(uint256(1e18) - MAX_SLIPPAGE);

        // Remove liquidity
        // slither-disable-next-line unused-return
        aeroRouterAddress.removeLiquidity(
            address(weth),
            address(oeth),
            true,
            gaugeTokens,
            wethDesired,
            oethDesired,
            address(this),
            block.timestamp
        );

        // Burn all OETH
        uint256 oethToBurn = oeth.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        // Get the strategy contract's wrapped ether balance and transfer to the vault.
        // This includes all that was removed from the AERO pool and
        // any ether that was sitting in the strategy contract before the removal.
        uint256 wethBalance = weth.balanceOf(address(this));
        // Convert all the strategy contract's ether to WETH
        require(
            weth.transfer(vaultAddress, wethBalance),
            "Transfer of WETH not successful"
        );

        emit Withdrawal(address(weth), address(lpTokenAddress), wethBalance);
        emit Withdrawal(address(oeth), address(lpTokenAddress), oethToBurn);
    }

    // Pool Peg keeping

    /**
     * @notice Mints and swaps the given oeth token amount for weth to maintain pool balance.
     * @param _amountIn Amount of tokens to swap for.
     * @param _minAmountOut Minimum amount of expected output amount (slippage adjusted)
     * @param _tokenIn Address of the input token.
     * @param _recipient Address of the recipient of weth tokens if we swap oeth for weth.
     */
    function swapAndRebalancePool(
        uint256 _amountIn,
        uint256 _minAmountOut,
        address _tokenIn,
        address _recipient
    ) external onlyStrategist improvePoolBalance nonReentrant {
        // tokenIn should be either oeth or weth.
        require(
            _tokenIn == address(weth) || _tokenIn == address(oeth),
            "Invalid tokenIn"
        );

        IRouter.Route[] memory routes = new IRouter.Route[](1);

        // slither-disable-next-line uninitialized-local
        uint256 oethBalanceBefore;

        if (_tokenIn == address(oeth)) {
            IVault(vaultAddress).mintForStrategy(_amountIn);

            IRouter.Route memory oethToWethRoute = IRouter.Route({
                from: address(oeth),
                to: address(weth),
                stable: true,
                factory: address(aeroFactoryAddress)
            });

            routes[0] = oethToWethRoute;
        } else {
            // Override recipient address so that the oeth can be burnt.
            _recipient = address(this);
            oethBalanceBefore = oeth.balanceOf(address(this));
            IRouter.Route memory wethToOethRoute = IRouter.Route({
                from: address(weth),
                to: address(oeth),
                stable: true,
                factory: address(aeroFactoryAddress)
            });

            routes[0] = wethToOethRoute;
        }

        // Perform a swap to rebalance the pool
        aeroRouterAddress.swapExactTokensForTokens(
            _amountIn,
            _minAmountOut,
            routes,
            _recipient,
            block.timestamp
        );

        // If weth was swapped for oeth, burn the receieved oeth tokens.
        if (_tokenIn == address(weth)) {
            uint256 oethReceived = oeth.balanceOf(address(this)) -
                oethBalanceBefore;
            IVault(vaultAddress).burnForStrategy(oethReceived);
        }
    }

    /**
     * @notice Collect accumulated AERO rewards and send to the Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect AERO
        aeroGaugeAddress.getReward(address(this));
        _collectRewardTokens();
    }

    function _lpWithdraw(uint256 _lpTokensAmount) internal {
        // Withdraw LP tokens from the gauge
        aeroGaugeAddress.withdraw(_lpTokensAmount);
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
        require(_asset == address(weth), "Unsupported asset");

        // WEth balance needed here for the balance check that happens from vault during depositing.
        balance = weth.balanceOf(address(this));
        uint256 lpTokens = aeroGaugeAddress.balanceOf(address(this));
        if (lpTokens > 0) {
            balance += (lpTokens * getLPTokenPrice()) / 1e18;
        }
    }

    /**
     * @notice Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == address(weth);
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
     * @notice Accept unwrapped WETH
     */
    receive() external payable {}

    /**
     * @dev Since we are unwrapping WETH before depositing it to Aero
     *      there is no need to to set an approval for WETH on the Aero
     *      pool
     * @param _asset Address of the asset
     * @param _pToken Address of the Aero LP token
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function _approveBase() internal {
        // Approve Aero router for OETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        oeth.approve(address(aeroRouterAddress), type(uint256).max);

        // Approve Aero router for WETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        weth.approve(address(aeroRouterAddress), type(uint256).max);

        // Approve Aero router for LPTokens (required for removing liquidity)
        // slither-disable-next-line unused-return
        lpTokenAddress.approve(address(aeroRouterAddress), type(uint256).max);

        // Approve Aerodrome Gauge contract to transfer Aero LP tokens
        // slither-disable-next-line unused-return
        lpTokenAddress.approve(address(aeroGaugeAddress), type(uint256).max);
    }

    /**
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }

    /**
     * @dev Returns the price of a LP token of the sAMM pool.
     */
    function getLPTokenPrice() public view returns (uint256) {
        uint256 r0 = lpTokenAddress.reserve0();
        uint256 r1 = lpTokenAddress.reserve1();

        // Calculate K
        uint256 K = _getK(r0, r1);

        // Calculate fourth root of K/2 then multiply it by 2.
        uint256 lpPrice = 2 *
            (
                FixedPointMathLib.sqrt(
                    FixedPointMathLib.sqrt(K.divPrecisely(2)) * 1e18
                )
            );

        return lpPrice;
    }

    /**
     * @dev Calculates the constant K for the sAMM pool based on the reserves r1 and r2.
     * The formula for K is: K = (r1^3 * r2) + (r2^3 * r1)
     * @param r1 The reserve of wETH.
     * @param r2 The reserve of OETH.
     * @return The calculated constant K.
     */
    function _getK(uint256 r1, uint256 r2) internal pure returns (uint256) {
        uint256 r1Cube = FixedPointMathLib.rpow(r1, 3, 1e18);
        uint256 r2Cube = FixedPointMathLib.rpow(r2, 3, 1e18);

        return
            FixedPointMathLib.mulWad(r1Cube, r2) +
            FixedPointMathLib.mulWad(r2Cube, r1);
    }
}
