// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve 3Pool Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import { ICurveETHPool } from "./ICurveETHPool.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { Helpers } from "../utils/Helpers.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { IRewardStaking } from "./IRewardStaking.sol";

contract ConvexEthMetaStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 internal constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI
    uint256 internal constant ASSET_COUNT = 3;
    address internal cvxDepositorAddress;
    // TODO change this to internal once this address is immutable
    address public cvxRewardStakerAddress;
    uint256 internal cvxDepositorPTokenId;
    ICurveETHPool internal curvePool;
    IERC20 internal lpToken;
    IERC20 internal poolOETHToken;
    IERC20 internal poolWETHToken;
    // Ordered list of pool assets
    address[] internal poolAssets;
    // Max withdrawal slippage denominated in 1e18 (1e18 == 100%)
    uint256 public maxWithdrawalSlippage;
    uint128 internal oethCoinIndex;
    uint128 internal wethCoinIndex;

    int256[50] private __reserved;

    // used to circumvent the stack too deep issue
    struct InitialiseConfig {
        address curvePoolAddress; //Address of the Curve pool
        address vaultAddress; //Address of the vault
        address cvxDepositorAddress; //Address of the Convex depositor(AKA booster) for this pool
        address oethAddress; //Address of OETH token
        address wethAddress; //Address of OETH token
        address cvxRewardStakerAddress; //Address of the CVX rewards staker
        address curvePoolLpToken; //Address of metapool LP token
        uint256 cvxDepositorPTokenId; //Pid of the pool referred to by Depositor and staker
    }

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
        InitialiseConfig calldata initConfig
    ) external onlyGovernor initializer {
        require(_assets.length == 1, "Must have exactly one asset");
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        cvxDepositorAddress = initConfig.cvxDepositorAddress;
        cvxRewardStakerAddress = initConfig.cvxRewardStakerAddress;
        cvxDepositorPTokenId = initConfig.cvxDepositorPTokenId;
        lpToken = IERC20(initConfig.curvePoolLpToken);
        curvePool = ICurveETHPool(initConfig.curvePoolAddress);
        poolOETHToken = IERC20(initConfig.oethAddress);
        poolWETHToken = IERC20(initConfig.wethAddress);
        maxWithdrawalSlippage = 1e16;

        poolAssets = [curvePool.coins(0), curvePool.coins(1)];
        wethCoinIndex = uint128(_getCoinIndex(initConfig.wethAddress));
        oethCoinIndex = uint128(_getCoinIndex(initConfig.oethAddress));

        super._initialize(
            initConfig.curvePoolAddress,
            initConfig.vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );

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
        require(_weth == address(poolWETHToken), "Can only deposit WETH");

        emit Deposit(_weth, address(lpToken), _wethAmount);

        // safe to cast since min value is at least 0
        uint256 oethToAdd = uint256(
            _max(
                0,
                int256(curvePool.balances(wethCoinIndex)) +
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
        if (oethToAdd > 0) {
            IVault(vaultAddress).mintForStrategy(oethToAdd);
        }

        uint256[2] memory _amounts;
        _amounts[wethCoinIndex] = _wethAmount;
        _amounts[oethCoinIndex] = oethToAdd;

        uint256 valueInLpTokens = (_wethAmount + oethToAdd).divPrecisely(
            curvePool.get_virtual_price() * 2
        );
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );

        uint256 balance = poolOETHToken.balanceOf(address(this));
        // Do the deposit to Curve ETH pool
        uint256 lpDeposited = curvePool.add_liquidity(_amounts, minMintAmount);
        //uint256 lpDeposited = curvePool.add_liquidity(_amounts, uint256(0));
        _lpDeposit(lpDeposited);
    }

    /**
     * @dev Deposit the entire balance of any supported asset into the Curve 3pool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = poolWETHToken.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(poolWETHToken), balance);
        }
    }

    function _lpDeposit(uint256 lpToDeposit) internal {
        require(
            IConvexDeposits(cvxDepositorAddress).deposit(
                cvxDepositorPTokenId,
                lpToDeposit,
                true // Deposit with staking
            ),
            "Depositing LP to Convex not successful"
        );
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
        require(_weth == address(poolWETHToken), "Can only withdraw WETH");

        emit Withdrawal(_weth, address(lpToken), _amount);

        uint256 requiredLpTokens = calcTokenToBurn(_amount);
        // TODO: is the -1 required because of the rounding error. And where to
        // actually apply it? maybe +1 to the requiredLpTokens?
        uint256 _roundDownAmount = _amount - 1;

        _lpWithdraw(requiredLpTokens);

        /* math in requiredLpTokens should correctly calculate the amount of LP to remove
         * in that the strategy receives enough WETH on balanced removal
         */
        uint256[2] memory _minWithdrawalAmounts = [uint256(0), uint256(0)];
        _minWithdrawalAmounts[wethCoinIndex] = _roundDownAmount;

        curvePool.remove_liquidity(requiredLpTokens, _minWithdrawalAmounts);

        // Burn OETH
        IVault(vaultAddress).burnForStrategy(
            poolOETHToken.balanceOf(address(this))
        );

        IERC20(_weth).safeTransfer(_recipient, _roundDownAmount);
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

        uint256 poolWETHBalance = curvePool.balances(wethCoinIndex);
        /* K is multiplied by 1e36 which is used for higher precision calculation of required
         * pool LP tokens. Without it the end value can have rounding errors up to precision of
         * 10 digits. This way we move the decimal point by 36 places when doing the calculation
         * and again by 36 places when we are done with it.
         */
        uint256 k = (1e36 * lpToken.totalSupply()) / poolWETHBalance;
        // simplifying below to: `uint256 diff = (_wethAmount - 1) * k` causes loss of precision
        // prettier-ignore
        // slither-disable-next-line divide-before-multiply
        uint256 diff = poolWETHBalance * k -
            (poolWETHBalance - _wethAmount - 1) * k;
        lpToBurn = diff / 1e36;
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        _lpWithdrawAll();

        // Withdraws are proportional to assets held by 3Pool
        uint256[2] memory minWithdrawAmounts = [uint256(0), uint256(0)];

        // Remove liquidity
        curvePool.remove_liquidity(
            lpToken.balanceOf(address(this)),
            minWithdrawAmounts
        );

        // Burn OETH
        IVault(vaultAddress).burnForStrategy(
            poolOETHToken.balanceOf(address(this))
        );
        // Transfer assets to the Vault
        poolWETHToken.safeTransfer(
            vaultAddress,
            poolWETHToken.balanceOf(address(this))
        );
    }

    function _lpWithdraw(uint256 _wethAmount) internal {
        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards for deposit
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            _wethAmount,
            true
        );
    }

    function _lpWithdrawAll() internal {
        uint256 gaugeTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );
        _lpWithdraw(gaugeTokens);
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        public
        view
        virtual
        override
        returns (uint256 balance)
    {
        require(_asset == address(poolWETHToken), "Unsupported asset");
        balance = 0;

        /* We intentionally omit the poolLp tokens held by the metastrategyContract
         * since the contract should never (except in the middle of deposit/withdrawal
         * transaction) hold any amount of those tokens in normal operation. There
         * could be tokens sent to it by a 3rd party and we decide to actively ignore
         * those.
         */
        uint256 poolGaugePTokens = IRewardStaking(cvxRewardStakerAddress)
            .balanceOf(address(this));

        if (poolGaugePTokens > 0) {
            uint256 value = poolGaugePTokens.mulTruncate(
                curvePool.get_virtual_price() * 2
            );
            balance = value;
        }

        // scale is already at 18 decimals. Just divide by 2 since half of the pool
        // holdings are represented by WETH asset
        balance = balance / ASSET_COUNT;
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
        return _asset == address(poolWETHToken);
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
        _approveAsset(address(poolWETHToken));
        _approveAsset(address(poolOETHToken));
    }

    /**
     * @dev Call the necessary approvals for the Curve pool and gauge
     * @param _asset Address of the asset
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        _approveAsset(_asset);
    }

    function _approveAsset(address _asset) internal {
        IERC20 asset = IERC20(_asset);
        // curve pool for asset (required for adding liquidity)
        asset.safeApprove(platformAddress, 0);
        asset.safeApprove(platformAddress, type(uint256).max);
    }

    function _approveBase() internal {
        _approveAsset(address(poolOETHToken));

        lpToken.safeApprove(cvxDepositorAddress, 0);
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
