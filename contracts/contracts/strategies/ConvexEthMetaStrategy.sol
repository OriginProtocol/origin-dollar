// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { ICurveETHPoolV1 } from "./ICurveETHPoolV1.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IRewardStaking } from "./IRewardStaking.sol";

contract ConvexEthMetaStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 internal constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI
    address internal constant ETH_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address internal cvxDepositorAddress;
    IRewardStaking public cvxRewardStaker;
    uint256 internal cvxDepositorPTokenId;
    ICurveETHPoolV1 internal curvePool;
    IERC20 internal lpToken;
    IERC20 internal oeth;
    IWETH9 internal weth;
    // Ordered list of pool assets
    uint128 internal oethCoinIndex;
    uint128 internal ethCoinIndex;

    // used to circumvent the stack too deep issue
    struct InitializeConfig {
        address curvePoolAddress; //Address of the Curve pool
        address cvxDepositorAddress; //Address of the Convex depositor(AKA booster) for this pool
        address oethAddress; //Address of OETH token
        address cvxRewardStakerAddress; //Address of the CVX rewards staker
        address curvePoolLpToken; //Address of metapool LP token
        uint256 cvxDepositorPTokenId; //Pid of the pool referred to by Depositor and staker
    }

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                WETH
     * @param initConfig Various addresses and info for initialization state
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + CVX
        address[] calldata _assets,
        address[] calldata _pTokens,
        InitializeConfig calldata initConfig
    ) external onlyGovernor initializer {
        require(_assets.length == 1, "Must have exactly one asset");
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        cvxDepositorAddress = initConfig.cvxDepositorAddress;
        cvxRewardStaker = IRewardStaking(initConfig.cvxRewardStakerAddress);
        cvxDepositorPTokenId = initConfig.cvxDepositorPTokenId;
        lpToken = IERC20(initConfig.curvePoolLpToken);
        curvePool = ICurveETHPoolV1(initConfig.curvePoolAddress);
        oeth = IERC20(initConfig.oethAddress);
        weth = IWETH9(_assets[0]); // WETH address
        ethCoinIndex = uint128(_getCoinIndex(ETH_ADDRESS));
        oethCoinIndex = uint128(_getCoinIndex(initConfig.oethAddress));

        super._initialize(_rewardTokenAddresses, _assets, _pTokens);

        /* needs to be called after super._initialize so that the platformAddress
         * is correctly set
         */
        _approveBase();
    }

    /**
     * @dev Deposit asset into the Curve ETH pool
     * @param _weth Address of WETH
     * @param _amount Amount of asset to deposit
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
        weth.withdraw(_wethAmount);

        emit Deposit(_weth, address(lpToken), _wethAmount);

        // safe to cast since min value is at least 0
        uint256 oethToAdd = uint256(
            _max(
                0,
                int256(curvePool.balances(ethCoinIndex)) +
                    int256(_wethAmount) -
                    int256(curvePool.balances(oethCoinIndex))
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

        uint256[2] memory _amounts;
        _amounts[ethCoinIndex] = _wethAmount;
        _amounts[oethCoinIndex] = oethToAdd;

        uint256 valueInLpTokens = (_wethAmount + oethToAdd).divPrecisely(
            curvePool.get_virtual_price()
        );
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        // Do the deposit to Curve ETH pool
        // slither-disable-next-line arbitrary-send
        uint256 lpDeposited = curvePool.add_liquidity{ value: _wethAmount }(
            _amounts,
            minMintAmount
        );

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
     * @dev Deposit the entire balance of any supported asset into the Curve 3pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = weth.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(weth), balance);
        }
    }

    /**
     * @dev Withdraw asset from Curve ETH pool
     * @param _recipient Address to receive withdrawn asset
     * @param _weth Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _weth,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Invalid amount");
        require(_weth == address(weth), "Can only withdraw WETH");

        emit Withdrawal(_weth, address(lpToken), _amount);

        uint256 requiredLpTokens = calcTokenToBurn(_amount);

        _lpWithdraw(requiredLpTokens);

        /* math in requiredLpTokens should correctly calculate the amount of LP to remove
         * in that the strategy receives enough WETH on balanced removal
         */
        uint256[2] memory _minWithdrawalAmounts = [uint256(0), uint256(0)];
        _minWithdrawalAmounts[ethCoinIndex] = _amount;
        // slither-disable-next-line unused-return
        curvePool.remove_liquidity(requiredLpTokens, _minWithdrawalAmounts);

        // Burn OETH
        IVault(vaultAddress).burnForStrategy(oeth.balanceOf(address(this)));
        // Transfer WETH
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
     * @dev Remove all assets from platform and send them to Vault contract.
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
        uint256 oethBalance = oeth.balanceOf(address(this));
        IVault(vaultAddress).burnForStrategy(oethBalance);

        // Send all ETH and WETH on the contract, including extra
        weth.deposit{ value: address(this).balance }();
        require(
            weth.transfer(vaultAddress, weth.balanceOf(address(this))),
            "Transfer of WETH not successful"
        );
    }

    /**
     * @dev Collect accumulated CRV and CVX and send to Harvester.
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
     * @dev Get the total asset value held in the platform
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
        balance += address(this).balance;
        uint256 lpTokens = cvxRewardStaker.balanceOf(address(this));
        if (lpTokens > 0) {
            balance += (lpTokens * curvePool.get_virtual_price()) / 1e18;
        }
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return _asset == address(weth);
    }

    /**
     * @dev Approve the spending of all assets by their corresponding pool tokens,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        _approveAsset(address(weth));
        _approveAsset(address(oeth));
    }

    /**
     * @dev Accept unwrapped WETH
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

    function _approveAsset(address _asset) internal {
        // approve curve pool for asset (required for adding liquidity)
        IERC20(_asset).safeApprove(platformAddress, type(uint256).max);
    }

    function _approveBase() internal {
        // WETH was approved as a supported asset,
        // so we need separate OETH approve
        _approveAsset(address(oeth));
        lpToken.safeApprove(cvxDepositorAddress, type(uint256).max);
    }

    /**
     * @dev Get the index of the coin
     */
    function _getCoinIndex(address _asset) internal view returns (uint256) {
        for (uint256 i = 0; i < 2; i++) {
            if (curvePool.coins(i) == _asset) return i;
        }
        revert("Invalid curve pool asset");
    }

    /**
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }
}
