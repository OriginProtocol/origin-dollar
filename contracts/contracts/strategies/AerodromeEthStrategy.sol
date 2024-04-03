// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Convex Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Curve OETH/ETH pool
 * @author Origin Protocol Inc
 */
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import {IRouter} from "./../interfaces/aerodrome/IRouter.sol";
import {IGauge} from "./../interfaces/aerodrome/IGauge.sol";
import {IERC20, InitializableAbstractStrategy} from "../utils/InitializableAbstractStrategy.sol";
import {StableMath} from "../utils/StableMath.sol";
import {IVault} from "../interfaces/IVault.sol";
import {IWETH9} from "../interfaces/IWETH9.sol";

contract AerodromeEthStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 public constant MAX_SLIPPAGE = 1e16; // 1%
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    IGauge public immutable aeroGaugeAddress;
    IRouter public immutable aeroRouterAddress;
    address public immutable aeroFactoryAddress;

    IERC20 public immutable lpTokenAddress;
    IERC20 public immutable oeth;
    IWETH9 public immutable weth;

    // Ordered list of pool assets
    uint128 public constant oethCoinIndex = 1;
    uint128 public constant ethCoinIndex = 0;

    // Used to circumvent the stack too deep issue
    struct AerodromeEthConfig {
        address aeroRouterAddress; //Address of the Aerodrome router
        address aeroGaugeAddress; //Address of the Aerodrome gauge
        address lpTokenAddress; //Address of the OETH/ETH Aero LPToken
        address oethAddress; //Address of OETH token
        address wethAddress; //Address of WETH
    }

    /**
     * @dev Verifies that the caller is the Strategist.
     */
    modifier onlyStrategist() {
        require(msg.sender == IVault(vaultAddress).strategistAddr(), "Caller is not the Strategist");
        _;
    }

    modifier improvePoolBalance() {
        _; // TODO
    }

    constructor(BaseStrategyConfig memory _baseConfig, AerodromeEthConfig memory _aeroConfig)
        InitializableAbstractStrategy(_baseConfig)
    {
        lpTokenAddress = IERC20(_baseConfig.platformAddress);
        aeroRouterAddress = IRouter(_baseConfig.platformAddress);
        aeroFactoryAddress = IRouter(_baseConfig.platformAddress).defaultFactory();
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

        InitializableAbstractStrategy._initialize(_rewardTokenAddresses, _assets, pTokens);

        _approveBase();
    }

    /**
     * @notice Deposit WETH into the Curve pool
     * @param _weth Address of Wrapped ETH (WETH) contract.
     * @param _amount Amount of WETH to deposit.
     */
    function deposit(address _weth, uint256 _amount) external override onlyVault nonReentrant {
        _deposit(_weth, _amount);
    }

    function _deposit(address _weth, uint256 _wethAmount) internal {
        require(_wethAmount > 0, "Must deposit something");
        require(_weth == address(weth), "Can only deposit WETH");

        emit Deposit(_weth, address(lpTokenAddress), _wethAmount);

        // Get the asset and OToken balances in the Aero's LP
        (uint256 reserveWethAmount, uint256 reserveOEthAmount) =
            aeroRouterAddress.getReserves(address(weth), address(oeth), true, aeroFactoryAddress);

        // safe to cast since min value is at least 0
        uint256 oethToAdd =
            uint256(_max(0, int256(reserveWethAmount) + int256(_wethAmount) - int256(reserveOEthAmount)));

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

        uint256 minOethToAdd = oethToAdd.mulTruncate(uint256(1e18) - MAX_SLIPPAGE); // adjust for slippage
        uint256 minWethToAdd = _wethAmount.mulTruncate(uint256(1e18) - MAX_SLIPPAGE); // adjust for slippage

        // Do the deposit to the Aerodrome pool
        // slither-disable-next-line arbitrary-send
        (,, uint256 lpReceived) = aeroRouterAddress.addLiquidity(
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
     * @notice Withdraw ETH and OETH from the Aerodrome pool, burn the OETH,
     * convert the ETH to WETH and transfer to the recipient.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _weth Address of the Wrapped ETH (WETH) contract.
     * @param _amount Amount of WETH to withdraw.
     */
    function withdraw(address _recipient, address _weth, uint256 _amount) external override onlyVault nonReentrant {
        // TODO
    }

    function calcTokenToBurn(uint256 _wethAmount) internal view returns (uint256 lpToBurn) {
        // TODO
    }

    /**
     * @notice Remove all ETH and OETH from the Aero pool, burn the OETH,
     * convert the ETH to WETH and transfer to the Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        // TODO
    }

    function mintAndAddOTokens(uint256 _oTokens) external onlyStrategist nonReentrant improvePoolBalance {
        // TODO
    }

    function removeAndBurnOTokens(uint256 _lpTokens) external onlyStrategist nonReentrant improvePoolBalance {
        // TODO
    }

    function removeOnlyAssets(uint256 _lpTokens) external onlyStrategist nonReentrant improvePoolBalance {
        // TODO
    }

    /**
     * @notice Collect accumulated AERO rewards and send to the Harvester.
     */
    function collectRewardTokens() external override onlyHarvester nonReentrant {
        // Collect AERO
        aeroGaugeAddress.getReward(address(this));
        _collectRewardTokens();
    }

    function _lpWithdraw(uint256 _wethAmount) internal {
        // TODO
    }

    /**
     * @notice Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset) public view override returns (uint256 balance) {
        // TODO
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
    function safeApproveAllTokens() external override onlyGovernor nonReentrant {
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
    function _abstractSetPToken(address _asset, address _pToken) internal override {}

    function _approveBase() internal {
        // Approve Aero router for OETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        oeth.approve(platformAddress, type(uint256).max);

        // Approve Aero router for WETH (required for adding liquidity)
        // slither-disable-next-line unused-return
        weth.approve(platformAddress, type(uint256).max);

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
}
