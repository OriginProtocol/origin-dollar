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

abstract contract BaseCurveEthMetaStrategy is InitializableAbstractStrategy {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    uint256 internal constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI
    uint256 internal constant ASSET_COUNT = 3;
    address internal cvxDepositorAddress;
    address internal cvxRewardStakerAddress;
    uint256 internal cvxDepositorPTokenId;
    ICurveETHPool internal curvePool;
    IERC20 internal lpToken;
    IERC20 internal poolMainToken;
    IERC20 internal poolWETHToken;
    // Ordered list of pool assets
    address[] internal poolAssets;
    // Max withdrawal slippage denominated in 1e18 (1e18 == 100%)
    uint256 public maxWithdrawalSlippage;
    uint128 internal mainCoinIndex;
    uint128 internal wethCoinIndex;

    int256[50] private __reserved;

    // used to circumvent the stack too deep issue
    struct InitConfig {
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
        InitConfig calldata initConfig
    ) external onlyGovernor initializer {
        require(_assets.length == 2, "Must have exactly two assets");
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        cvxDepositorAddress = initConfig.cvxDepositorAddress;
        cvxRewardStakerAddress = initConfig.cvxRewardStakerAddress;
        cvxDepositorPTokenId = initConfig.cvxDepositorPTokenId;
        lpToken = IERC20(initConfig.curvePoolLpToken);
        curvePool = ICurveETHPool(initConfig.curvePoolAddress);
        poolMainToken = IERC20(initConfig.oethAddress);
        poolWETHToken = IERC20(initConfig.wethAddress);
        maxWithdrawalSlippage = 1e16;

        poolAssets = [curvePool.coins(0), curvePool.coins(1)];
        wethCoinIndex = uint128(_getCoinIndex(initConfig.wethAddress));
        mainCoinIndex = uint128(_getCoinIndex(initConfig.oethAddress));

        super._initialize(
            initConfig.curvePoolAddress,
            initConfig.vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
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

    function _deposit(address _weth, uint256 _amount)
        internal
    {
        require(_amount > 0, "Must deposit something");
        require(_weth == address(poolWETHToken), "Can only deposit WETH");

        emit Deposit(_weth, address(lpToken), _amount);

        uint256[2] memory _amounts;
        uint256 poolCoinIndex = _getCoinIndex(_weth);
        // Set the amount on the asset we want to deposit
        _amounts[poolCoinIndex] = _amount;

        // safe to cast since min value is at least 0
        uint256 oethToAdd = uint256(
            _max(
                0,
                int256(curvePool.balances(wethCoinIndex)) +
                int256(_amount) -
                int256(curvePool.balances(mainCoinIndex)) 
            )
        );

        /* Add so much OETH so that the pool ends up being balanced. And at minimum
         * add as much OETH as WETH and at maximum twice as much OETH.
         */
        oethToAdd = Math.max(oethToAdd, _amount);
        oethToAdd = Math.min(oethToAdd, _amount * 2);

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

        _amounts[mainCoinIndex] = oethToAdd;

        uint256 valueInLpTokens = (_amount + oethToAdd).divPrecisely(
            curvePool.get_virtual_price()
        );
        uint256 minMintAmount = valueInLpTokens.mulTruncate(
            uint256(1e18) - MAX_SLIPPAGE
        );
        // Do the deposit to Curve ETH pool
        uint256 lpDeposited = curvePool.add_liquidity(_amounts, minMintAmount);
        //_lpDepositAll(lpDeposited);
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

        uint256 requiredLpTokens = _calcCurveTokenAmount(wethCoinIndex, _amount);

        // We have enough LP tokens, make sure they are all on this contract
        //_lpWithdraw(requiredLpTokens);

        uint256[2] memory _amounts = [uint256(0), uint256(0)];
        _amounts[wethCoinIndex] = _amount;

        //curvePool.remove_liquidity_imbalance(_amounts, requiredLpTokens);
        IERC20(_weth).safeTransfer(_recipient, _amount);
    }

    function calcTokenToBurn(uint256 _wethAmount) view internal returns (uint256 lpToBurn) {
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
     * @dev Calculate amount of LP required when withdrawing specific amount of one
     * of the underlying assets accounting for fees and slippage.
     *
     * Curve pools unfortunately do not contain a calculation function for
     * amount of LP required when withdrawing a specific amount of one of the
     * underlying tokens and also accounting for fees (Curve's calc_token_amount
     * does account for slippage but not fees).
     *
     * Steps taken to calculate the metric:
     *  - get amount of LP required if fees wouldn't apply
     *  - increase the LP amount as if fees would apply to the entirety of the underlying
     *    asset withdrawal. (when withdrawing only one coin fees apply only to amounts
     *    of other assets pool would return in case of balanced removal - since those need
     *    to be swapped for the single underlying asset being withdrawn)
     *  - get amount of underlying asset withdrawn (this Curve function does consider slippage
     *    and fees) when using the increased LP amount. As LP amount is slightly over-increased
     *    so is amount of underlying assets returned.
     *  - since we know exactly how much asset we require take the rate of LP required for asset
     *    withdrawn to get the exact amount of LP.
     */
    function _calcCurveTokenAmount(uint256 _coinIndex, uint256 _amount)
        internal
        returns (uint256 required3Crv)
    {
        uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
        _amounts[_coinIndex] = _amount;

        // LP required when removing required asset ignoring fees
        uint256 lpRequiredNoFees = curvePool.calc_token_amount(_amounts, false);
        /* LP required if fees would apply to entirety of removed amount
         *
         * fee is 1e10 denominated number: https://curve.readthedocs.io/exchange-pools.html#StableSwap.fee
         */
        uint256 lpRequiredFullFees = lpRequiredNoFees.mulTruncateScale(
            1e10 + curvePool.fee(),
            1e10
        );

        /* asset received when withdrawing full fee applicable LP accounting for
         * slippage and fees
         */
        uint256 assetReceivedForFullLPFees = curvePool.calc_withdraw_one_coin(
            lpRequiredFullFees,
            int128(uint128(_coinIndex))
        );

        // exact amount of LP required
        required3Crv =
            (lpRequiredFullFees * _amount) /
            assetReceivedForFullLPFees;
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        //_lpWithdrawAll();
        // Withdraws are proportional to assets held by 3Pool
        uint256[3] memory minWithdrawAmounts = [
            uint256(0),
            uint256(0),
            uint256(0)
        ];

        // Remove liquidity
        ICurveETHPool threePool = ICurveETHPool(platformAddress);
        threePool.remove_liquidity(
            lpToken.balanceOf(address(this)),
            minWithdrawAmounts
        );
        // Transfer assets out of Vault
        // Note that Curve will provide all 3 of the assets in 3pool even if
        // we have not set PToken addresses for all of them in this strategy
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            IERC20 asset = IERC20(threePool.coins(i));
            asset.safeTransfer(vaultAddress, asset.balanceOf(address(this)));
        }
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
        require(assetToPToken[_asset] != address(0), "Unsupported asset");
        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 totalPTokens = lpToken.balanceOf(address(this));
        if (totalPTokens > 0) {
            uint256 virtual_price = curvePool.get_virtual_price();
            uint256 value = (totalPTokens * virtual_price) / 1e18;
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            balance = value.scaleBy(assetDecimals, 18) / ASSET_COUNT;
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
        return assetToPToken[_asset] != address(0);
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
        _approveBase();
        // This strategy is a special case since it only supports one asset
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            _approveAsset(assetsMapped[i]);
        }
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
        // 3Pool for asset (required for adding liquidity)
        asset.safeApprove(platformAddress, 0);
        asset.safeApprove(platformAddress, type(uint256).max);
    }

    function _approveBase() internal virtual;

    /**
     * @dev Get the index of the coin
     */
    function _getCoinIndex(address _asset) internal view returns (uint256) {
        for (uint256 i = 0; i < 2; i++) {
            if (assetsMapped[i] == _asset) return i;
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
