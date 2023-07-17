// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Curve Metapool Strategy
 * @notice Investment strategy for investing ether in a Curve Metapool
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

    uint256 public constant MAX_SLIPPAGE = 1e16; // 1%, same as the Curve UI
    address public constant ETH_ADDRESS =
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    address public immutable cvxDepositorAddress;
    IRewardStaking public immutable cvxRewardStaker;
    uint256 public immutable cvxDepositorPTokenId;
    ICurveETHPoolV1 public immutable curvePool;
    IERC20 public immutable lpToken;
    IERC20 public immutable oeth;
    IWETH9 public immutable weth;
    // Ordered list of pool assets
    uint128 public constant oethCoinIndex = 1;
    uint128 public constant ethCoinIndex = 0;
    uint256 public constant N_COINS = 2;
    uint256 public constant A_PRECISION = 100;
    /// @notice Scale of the Curve.fi metapool fee. 100% = 1e10, 0.04% = 4e6.
    uint256 public constant CURVE_FEE_SCALE = 1e10;

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

    // used to circumvent the stack too deep issue
    struct InitializeConfig {
        address curvePoolAddress; //Address of the Curve pool
        address vaultAddress; //Address of the vault
        address cvxDepositorAddress; //Address of the Convex depositor(AKA booster) for this pool
        address oethAddress; //Address of OETH token
        address cvxRewardStakerAddress; //Address of the CVX rewards staker
        address curvePoolLpToken; //Address of metapool LP token
        uint256 cvxDepositorPTokenId; //Pid of the pool referred to by Depositor and staker
        address wethAddress; //Address of WETH
    }

    constructor(InitializeConfig memory initConfig) {
        cvxDepositorAddress = initConfig.cvxDepositorAddress;
        cvxRewardStaker = IRewardStaking(initConfig.cvxRewardStakerAddress);
        cvxDepositorPTokenId = initConfig.cvxDepositorPTokenId;
        lpToken = IERC20(initConfig.curvePoolLpToken);
        curvePool = ICurveETHPoolV1(initConfig.curvePoolAddress);
        oeth = IERC20(initConfig.oethAddress);
        weth = IWETH9(initConfig.wethAddress);
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                WETH
     * @param _vaultAddress address of the vault proxy contract.
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // CRV + CVX
        address[] calldata _assets,
        address _vaultAddress
    ) external onlyGovernor initializer {
        require(_assets.length == 1, "Must have exactly one asset");

        address[] memory pTokens = new address[](1);
        pTokens[0] = address(curvePool);

        super._initialize(
            address(curvePool),
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            pTokens
        );

        /* needs to be called after super._initialize so that the platformAddress
         * is correctly set
         */
        _approveBase();
    }

    /***************************************
                    Deposit
    ****************************************/

    /**
     * @notice Deposit WETH and/or OETH into the Curve Metapool.
     * If depositing WETH, convert WETH to ETH, add ETH and OETH to the Curve Metapool
     * and deposit the Metapool LP tokens to Convex. The OETH amount is between
     * 1 and 2x the ETH amount.
     * If depositing OETH, mint OETH from the vault, one-sided add to the Metapool
     * and deposit the Metapool LP tokens to Convex. This is used when the Metapool
     * has not enough OETH and too much ETH.
     * @param _asset Address of Wrapped ETH (WETH) or Origin ETH (OETH) contracts.
     * @param _amount Amount of WETH or OETH to deposit.
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

        if (_asset == address(weth)) {
            // If depositing WETH

            // Convert the WETH to ETH
            weth.withdraw(_amount);

            // safe to cast since min value is at least 0
            uint256 oethToAdd = uint256(
                _max(
                    0,
                    int256(curvePool.balances(ethCoinIndex)) +
                        int256(_amount) -
                        int256(curvePool.balances(oethCoinIndex))
                )
            );

            emit Deposit(address(weth), address(lpToken), _amount);

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
            IVault(vaultAddress).mintForStrategy(oethToAdd);

            uint256[2] memory _amounts = [_amount, oethToAdd];

            uint256 valueInLpTokens = (_amount + oethToAdd).divPrecisely(
                curvePool.get_virtual_price()
            );
            uint256 minMintAmount = valueInLpTokens.mulTruncate(
                uint256(1e18) - MAX_SLIPPAGE
            );

            // Do the deposit to Curve ETH pool of both ETH and OETH
            // slither-disable-next-line arbitrary-send
            uint256 lpDeposited = curvePool.add_liquidity{ value: _amount }(
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
        } else if (_asset == address(oeth)) {
            // If depositing OETH

            // Mint OETH from the Vault
            IVault(vaultAddress).mintForStrategy(_amount);

            uint256 valueInLpTokens = _amount.divPrecisely(
                curvePool.get_virtual_price()
            );
            uint256 minMintAmount = valueInLpTokens.mulTruncate(
                uint256(1e18) - MAX_SLIPPAGE
            );

            emit Deposit(address(oeth), address(lpToken), _amount);

            // Deposit just OETH to Curve ETH pool
            uint256 lpDeposited = curvePool.add_liquidity(
                [0, _amount],
                minMintAmount
            );

            require(
                IConvexDeposits(cvxDepositorAddress).deposit(
                    cvxDepositorPTokenId,
                    lpDeposited,
                    true // Deposit with staking
                ),
                "Failed to Deposit LP to Convex"
            );
        }

        revert("Can only deposit WETH or OETH");
    }

    /**
     * @notice Deposit the strategy's entire balance of any ETH or WETH into the Curve Metapool
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = weth.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(weth), balance);
        }
    }

    /***************************************
                    Withdraw
    ****************************************/

    /**
     * @notice Withdraw ETH and/or OETH from the Curve Metapool.
     * If withdrawing WETH, remove ETH and OETH from the Curve Metapool, burn the OETH,
     * convert the ETH to WETH and transfer to the recipient.
     * If withdrawing OETH, one-sided remove of OETH from the Metapool which are then burned. This is
     * used when the Metapool has not enough ETH and too much OETH.
     * @param _recipient Address to receive withdrawn asset which is normally the Vault.
     * @param _asset Address of the Wrapped ETH (WETH) or Origin ETH (OETH) contracts.
     * @param _amount Amount of WETH to withdraw.
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Invalid amount");

        if (_asset == address(weth)) {
            // If withdrawing WETH
            emit Withdrawal(_asset, address(lpToken), _amount);

            uint256 requiredLpTokens = calcTokenToBurn(_amount);

            _lpWithdraw(requiredLpTokens);

            /* math in requiredLpTokens should correctly calculate the amount of LP to remove
             * in that the strategy receives enough WETH on balanced removal
             */
            uint256[2] memory _minWithdrawalAmounts = [uint256(0), uint256(0)];
            _minWithdrawalAmounts[ethCoinIndex] = _amount;
            // slither-disable-next-line unused-return
            curvePool.remove_liquidity(requiredLpTokens, _minWithdrawalAmounts);

            // Burn all the removed OETH and any that was left in the strategy
            IVault(vaultAddress).burnForStrategy(oeth.balanceOf(address(this)));

            // Transfer WETH to the recipient
            weth.deposit{ value: _amount }();
            require(
                weth.transfer(_recipient, _amount),
                "Transfer of WETH not successful"
            );
        } else if (_asset == address(oeth)) {
            // If withdrawing OETH

            // Calculate the amount of pool LP tokens to withdraw to get the required amount of OETH tokens.
            uint256 lpTokens = _calcWithdraw(_amount, oethCoinIndex);

            // Withdraw Metapool LP tokens from Convex pool
            _lpWithdraw(lpTokens);

            // Remove just the OETH from the Metapool
            uint256 oTokens = curvePool.remove_liquidity_one_coin(
                lpTokens,
                int128(oethCoinIndex),
                _amount,
                vaultAddress
            );

            // The vault burns all the OETH withdrawn from the pool
            IVault(vaultAddress).burnForStrategy(oTokens);

            emit Withdrawal(address(oeth), address(lpToken), oTokens);
        }

        revert("Can only withdraw WETH or OETH");
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
     * @notice Remove all ETH and OETH from the Metapool, burn the OETH,
     * convert the ETH to WETH and transfer to the Vault contract.
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

        // Get the strategy contract's ether balance.
        // This includes all that was removed from the Metapool and
        // any ether that was sitting in the strategy contract before the removal.
        uint256 ethBalance = address(this).balance;
        // Convert all the strategy contract's ether to WETH and transfer to the vault.
        weth.deposit{ value: ethBalance }();
        require(
            weth.transfer(vaultAddress, ethBalance),
            "Transfer of WETH not successful"
        );

        emit Withdrawal(address(weth), address(lpToken), ethBalance);
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
        require(_asset == address(weth), "Unsupported asset");

        // Eth balance needed here for the balance check that happens from vault during depositing.
        balance += address(this).balance;
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
        _approveAsset(address(weth));
        _approveAsset(address(oeth));
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
     * @dev Returns the largest of two numbers int256 version
     */
    function _max(int256 a, int256 b) internal pure returns (int256) {
        return a >= b ? a : b;
    }

    /***************************************
            Curve Metapool Calculations
    ****************************************/

    /**
     * @dev Calculates the amount of liquidity provider tokens (OETHCRV-f) to burn for receiving a fixed amount of pool tokens.
     * @param _tokenAmount The amount of coins, eg ETH or OETH, required to receive.
     * @param _coinIndex The index of the coin in the pool to withdraw. 0 = ETH, 1 = OETH.
     * @return burnAmount_ The amount of liquidity provider tokens (OETHCRV-f) to burn.
     */
    function _calcWithdraw(uint256 _tokenAmount, uint256 _coinIndex)
        internal
        view
        returns (uint256 burnAmount_)
    {
        uint256 totalLpSupply = lpToken.totalSupply();
        require(totalLpSupply > 0, "empty FraxBP");

        // Get balance of each stablecoin in the FraxBP
        uint256[N_COINS] memory oldBalances = [
            curvePool.balances(0),
            curvePool.balances(1)
        ];

        // Get pool amplitude coefficient (A)
        uint256 Ann = curvePool.A() * A_PRECISION * N_COINS;

        // ETH value before withdraw
        uint256 invariant = _getD(oldBalances, Ann);

        // Remove withdraw from corresponding balance
        uint256[N_COINS] memory newBalances = [
            _coinIndex == 0 ? oldBalances[0] - _tokenAmount : oldBalances[0],
            _coinIndex == 1 ? oldBalances[1] - _tokenAmount : oldBalances[1]
        ];
        // Scale USDC from 6 decimals up to 18 decimals
        uint256[N_COINS] memory newBalancesScaled = [
            newBalances[0],
            newBalances[1] * 1e12
        ];

        // Invariant after withdraw
        uint256 invariantAfterWithdraw = _getD(newBalancesScaled, Ann);

        // We need to recalculate the invariant accounting for fees
        // to calculate fair user's share
        // _fee: uint256 = self.fee * N_COINS / (4 * (N_COINS - 1))
        uint256 fee = curvePool.fee() / 2;

        // ETH at index 0
        uint256 idealBalanceScaled = (invariantAfterWithdraw * oldBalances[0]) /
            invariant;
        uint256 differenceScaled = idealBalanceScaled > newBalances[0]
            ? idealBalanceScaled - newBalances[0]
            : newBalances[0] - idealBalanceScaled;
        newBalancesScaled[0] =
            newBalances[0] -
            ((fee * differenceScaled) / CURVE_FEE_SCALE);

        // OETH at index 1
        idealBalanceScaled =
            (invariantAfterWithdraw * oldBalances[1]) /
            invariant;
        differenceScaled = idealBalanceScaled > newBalances[1]
            ? idealBalanceScaled - newBalances[1]
            : newBalances[1] - idealBalanceScaled;
        newBalancesScaled[1] = (newBalances[1] -
            (fee * differenceScaled) /
            CURVE_FEE_SCALE);

        // Calculate how much pool tokens to burn
        // LP tokens to burn = total LP tokens * (ETH value before - ETH value after) / ETH value before
        burnAmount_ =
            ((totalLpSupply * (invariant - _getD(newBalancesScaled, Ann))) /
                invariant) +
            1;
    }

    /**
     * @notice Uses Newton’s Method to iteratively solve the StableSwap invariant (D).
     * @param xp  The scaled balances of the coins in the FraxBP.
     * @param Ann The amplitude coefficient multiplied by the number of coins in the pool (A * N_COINS).
     * @return D  The StableSwap invariant
     */
    function _getD(uint256[N_COINS] memory xp, uint256 Ann)
        internal
        pure
        returns (uint256 D)
    {
        // Sum the balances
        uint256 S = xp[0] + xp[1];

        // Do these multiplications here rather than in each loop
        uint256 xp0 = xp[0] * N_COINS;
        uint256 xp1 = xp[1] * N_COINS;

        uint256 Dprev = 0;
        D = S;
        uint256 D_P;
        for (uint256 i; i < 255; ) {
            // D_P: uint256 = D
            // for _x in xp:
            //     D_P = D_P * D / (_x * N_COINS)  # If division by 0, this will be borked: only withdrawal will work. And that is good
            D_P = (((D * D) / xp0) * D) / xp1;

            Dprev = D;
            D =
                (((Ann * S) / A_PRECISION + D_P * N_COINS) * D) /
                (((Ann - A_PRECISION) * D) / A_PRECISION + (N_COINS + 1) * D_P);
            // Equality with the precision of 1
            if (D > Dprev) {
                if (D - Dprev <= 1) break;
            } else {
                if (Dprev - D <= 1) break;
            }
            unchecked {
                ++i;
            }
        }
    }
}
