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
    uint128 public constant ethCoinIndex = 1;
    uint128 public constant oethCoinIndex = 0;

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
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
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
     * @notice Deposit WETH into the Curve pool
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

        emit Deposit(_weth, address(lpTokenAddress), _wethAmount);

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

        // safe to cast since min value is at least 0
        uint256 oethToAdd = uint256(
            _max(
                0,
                int256(reserveWethAmount) +
                    int256(_wethAmount) -
                    int256(reserveOEthAmount)
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

        emit Deposit(address(oeth), address(lpTokenAddress), oethToAdd);

        uint256 minOethToAdd = oethToAdd.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        ); // adjust for slippage
        uint256 minWethToAdd = _wethAmount.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        ); // adjust for slippage

        // Do the deposit to the Aerodrome pool
        // slither-disable-next-line arbitrary-send
        (, , uint256 lpReceived) = aeroRouterAddress.addLiquidity(
            address(weth),
            address(oeth),
            true,
            _wethAmount,
            oethToAdd,
            minWethToAdd,
            minOethToAdd,
            address(this),
            block.timestamp
        );

        // Deposit the Aero pool's LP tokens into the Gauge
        aeroGaugeAddress.deposit(lpReceived);
    }

    /**
     * @notice Deposit the strategy's entire balance of WETH into the Curve pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = weth.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(weth), balance);
        }
    }

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
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Invalid amount");
        require(_weth == address(weth), "Can only withdraw WETH");

        emit Withdrawal(_weth, address(lpTokenAddress), _amount);

        uint256 requiredLpTokens = calcTokenToBurn(_amount);

        _lpWithdraw(requiredLpTokens);

        /* math in requiredLpTokens should correctly calculate the amount of LP to remove
         * in that the strategy receives enough WETH on balanced removal
         */
        // slither-disable-next-line unused-return
        aeroRouterAddress.removeLiquidity(
            address(weth),
            address(oeth),
            true,
            requiredLpTokens,
            0,
            0,
            address(this),
            block.timestamp
        );

        // Burn all the removed OETH and any that was left in the strategy
        uint256 oethToBurn = oeth.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        emit Withdrawal(address(oeth), address(lpTokenAddress), oethToBurn);

        // Transfer WETH to the recipient
        weth.deposit{ value: _amount }();
        require(
            weth.transfer(_recipient, _amount),
            "Transfer of WETH not successful"
        );
    }

    function calcTokenToBurn(uint256 _wethAmount)
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

        uint256 poolWETHBalance = lpTokenAddress.reserve0(); // reserve0 should be WETH
        /* K is multiplied by 1e36 which is used for higher precision calculation of required
         * pool LP tokens. Without it the end value can have rounding errors up to precision of
         * 10 digits. This way we move the decimal point by 36 places when doing the calculation
         * and again by 36 places when we are done with it.
         */
        uint256 k = (1e36 * IERC20(address(lpTokenAddress)).totalSupply()) /
            poolWETHBalance;
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
        uint256 gaugeTokens = aeroGaugeAddress.balanceOf(address(this));
        _lpWithdraw(gaugeTokens);

        // Remove liquidity
        // slither-disable-next-line unused-return
        aeroRouterAddress.removeLiquidity(
            address(weth),
            address(oeth),
            true,
            gaugeTokens,
            0,
            0,
            address(this),
            block.timestamp
        );
        // Burn all OETH
        uint256 oethToBurn = oeth.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethToBurn);

        // Get the strategy contract's ether balance.
        // This includes all that was removed from the Curve pool and
        // any ether that was sitting in the strategy contract before the removal.
        uint256 ethBalance = address(this).balance;
        // Convert all the strategy contract's ether to WETH and transfer to the vault.
        weth.deposit{ value: ethBalance }();
        require(
            weth.transfer(vaultAddress, ethBalance),
            "Transfer of WETH not successful"
        );

        emit Withdrawal(address(weth), address(lpTokenAddress), ethBalance);
        emit Withdrawal(address(oeth), address(lpTokenAddress), oethToBurn);
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
        // Claim remaining rwards before withdrawing LP Tokens
        aeroGaugeAddress.getReward(address(this));

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

        // Eth balance needed here for the balance check that happens from vault during depositing.
        balance = address(this).balance;
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
     * @dev Since we are unwrapping WETH before depositing it to Curve
     *      there is no need to to set an approval for WETH on the Curve
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
        // Approve Aero router for OETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        oeth.approve(address(aeroRouterAddress), type(uint256).max);

        // Approve Aero router for WETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        weth.approve(address(aeroRouterAddress), type(uint256).max);

        // Approve Aerodrome Gauge contract to transfer Aero LP tokens
        // slither-disable-next-line unused-return
        IERC20(address(lpTokenAddress)).approve(
            address(aeroGaugeAddress),
            type(uint256).max
        );
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
    function getLPTokenPrice() internal view returns (uint256) {
        uint256 r0 = lpTokenAddress.reserve0();
        uint256 r1 = lpTokenAddress.reserve1();

        // Calculate K
        uint256 K = getK(r0, r1);

        // Calculate fourth root of K/2 then multiply it by 2.
        uint256 lpPrice = 2 *
            (FixedPointMathLib.sqrt(
                FixedPointMathLib.sqrt(
                    K.divPrecisely(2) * FixedPointMathLib.WAD
                ) * FixedPointMathLib.WAD
            ) / FixedPointMathLib.WAD);

        return lpPrice;
    }

    /**
     * @dev Calculates the constant K for the sAMM pool based on the reserves r1 and r2.
     * The formula for K is: K = (r1^3 * r2) + (r2^3 * r1)
     * @param r1 The reserve of wETH.
     * @param r2 The reserve of OETH.
     * @return The calculated constant K.
     */
    function getK(uint256 r1, uint256 r2) internal pure returns (uint256) {
        uint256 r1Cube = FixedPointMathLib.rpow(r1, 3, 1e18);
        uint256 r2Cube = FixedPointMathLib.rpow(r2, 3, 1e18);

        return
            FixedPointMathLib.mulWad(r1Cube, r2) +
            FixedPointMathLib.mulWad(r2Cube, r1);
    }
}
