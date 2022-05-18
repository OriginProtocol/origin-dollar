// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import { IRewardStaking } from "./IRewardStaking.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { ICurvePool } from "./ICurvePool.sol";
import { ICurveMetaPool } from "./ICurveMetaPool.sol";
import { IERC20, BaseCurveStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { InitializableSecondary } from "../utils/InitializableSecondary.sol";
import { Helpers } from "../utils/Helpers.sol";
import { IVault } from "../interfaces/IVault.sol";
import "hardhat/console.sol";

contract ConvexMetaStrategy is BaseCurveStrategy, InitializableSecondary {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    address internal cvxDepositorAddress;
    address internal cvxRewardStakerAddress;
    uint256 internal cvxDepositorPTokenId;
    ICurveMetaPool internal metapool;
    IERC20 internal ousd;
    IVault internal vault;
    // the amount of non collateralized OUSD in metapool 
    uint256 internal ousdMinted;

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Curve strategies don't fit
     * well within that abstraction.
     * @param _platformAddress Address of the Curve 3pool
     * @param _vaultAddress Address of the vault
     * @param _rewardTokenAddresses Address of CRV & CVX
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                DAI, USDC, USDT
     * @param _pTokens Platform Token corresponding addresses
     * @param _cvxDepositorAddress Address of the Convex depositor(AKA booster) for this pool
     * @param _metapoolAddress Address of the OUSD-3Pool Curve MetaPool
     * @param _ousd Address of OUSD token
     */
    function initialize(
        address _platformAddress, // 3Pool address
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses, // CRV + CVX
        address[] calldata _assets,
        address[] calldata _pTokens,
        address _cvxDepositorAddress,
        address _metapoolAddress,
        address _ousd
    ) external onlyGovernor initializer {
        require(_assets.length == 3, "Must have exactly three assets");
        // Should be set prior to abstract initialize call otherwise
        // abstractSetPToken calls will fail
        cvxDepositorAddress = _cvxDepositorAddress;
        pTokenAddress = _pTokens[0];
        metapool = ICurveMetaPool(_metapoolAddress);
        ousd = IERC20(_ousd);
        vault = IVault(_vaultAddress);

        super._initialize(
            _platformAddress,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    /**
     * Secondary Initializer for setting up strategy internal state. Can not fit everything into the first 
     * initialize function. Solidity's stack has 16 variable limit
     * @param _cvxRewardStakerAddress Address of the CVX rewards staker
     * @param _cvxDepositorPTokenId Pid of the pool referred to by Depositor and staker
     */
    function initialize2(
        address _cvxRewardStakerAddress,
        uint256 _cvxDepositorPTokenId
    ) external onlyGovernor secondaryInitializer {
        cvxRewardStakerAddress = _cvxRewardStakerAddress;
        cvxDepositorPTokenId = _cvxDepositorPTokenId;
    }

    /* Take 3pool LP and mint the corresponding amount of ousd. Deposit and stake that to
     * ousd Curve Metapool. Take the LP from metapool and deposit them to Convex.
     */
    function _lpDepositAll() internal override {
        IERC20 threePoolLp = IERC20(pTokenAddress);
        IERC20 metapoolErc20 = IERC20(address(metapool));
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 threePoolLpBalance = threePoolLp.balanceOf(address(this));
        uint256 threePoolLpDollarValue = threePoolLpBalance * curvePool.get_virtual_price() / 10**18;

        /* Mint 1:1 the amount of OUSD to the amount of stablecoins deposited to 3Pool.
         *
         * TODO: research if there is a better ratio to pick according to how tilted 
         * (more OUSD vs more 3PoolLP) the Metapool is at a specific block number. 
         */
        vault.mintForStrategy(threePoolLpDollarValue);
        ousdMinted += threePoolLpDollarValue;

        uint256 ousdBalance = ousd.balanceOf(address(this));
        uint256[2] memory _amounts = [ousdBalance, threePoolLpBalance];

        console.log("DEPOSITING");
        console.log("3pool dollar value ", threePoolLpDollarValue / 10**18);
        console.log("ousdBalance", ousdBalance / 10**18);

        // TODO: figure out what the best slippage guard is. Also minReceived is in 
        // OUSD3Pool LP tokens so need to account for that 
        // 
        // Important(!) we need to be sure there are no flash loan attack possibilities here
        uint256 minReceived = (ousdBalance + threePoolLpBalance) * 985 / 1000;
        metapool.add_liquidity(_amounts, minReceived);

        uint256 metapoolLp = metapoolErc20.balanceOf(address(this));

        bool success = IConvexDeposits(cvxDepositorAddress).deposit(
            cvxDepositorPTokenId,
            metapoolLp,
            true // Deposit with staking
        );
        
        require(success, "Failed to deposit to Convex");
    }

    /**
     * NOtes: do a version of _lpWitdraw where you specify required amount of 3crvTokens you want to get
     * 
     * Using virtual price calculation figure out how much gauged tokens we need to withdraw
     * and then use the normal remove_liquidity to get those tokens.
     * 
     * If we don't get the sufficient amount of 3CRV just swap it using the Metapool. Burn the excess 
     * OUSD as you would normally
     */

    /**
     * Withdraw the specified amount of tokens from the gauge. And use all the resulting tokens
     * to remove liquidity from metapooll
     * @param numPTokens Number of Convex LP tokens to remove from gauge
     */
    function _lpWithdraw(uint256 numPTokens) internal override {
        //_lpWithdraw_one(numPTokens);
        _lpWithdraw_two(numPTokens);
    }

    function _lpWithdraw_two(uint256 num3CrvTokens) internal {
        console.log("WITHDRAWAL");
        IERC20 metapoolErc20 = IERC20(address(metapool));
        IERC20 threePoolLp = IERC20(pTokenAddress);
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 gaugeTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(address(this));
        console.log("GAuge tokens before: ", gaugeTokens / 10**18);
        console.log("NUM num3CrvTokens to withdraw", num3CrvTokens / 10**18);

        /**
         * Convert 3crv tokens to metapoolLP tokens and double it. Doubling is required because aside
         * from receiving 3crv we are also withdrawing OUSD. Instead of removing liquidity in an imbalanced
         * manner the preference is to remove it in a balanced manner and perform a swap on the metapool to 
         * make up for the token imbalance. The reason for this unpredictability is that the pool can be 
         * balanced either in OUSD direction or 3Crv.
         * 
         * Further analysis to confirm the following assumption is required: It should be more cost effective
         * to remove the largest sum of liquidity using a balanced function and then make up for the much smaller
         * discrepancy in removed tokens using a metapool swap.
         */
        uint256 requiredMetapoolLpTokens = num3CrvTokens *
            curvePool.get_virtual_price() / 1e18 /
            metapool.get_virtual_price() * 1e18 * 2;

        console.log("requiredMetapoolLpTokens:", requiredMetapoolLpTokens / 1e18);

        require(
            requiredMetapoolLpTokens <= gaugeTokens,
            string(
                bytes.concat(
                    bytes("Attempting to withdraw "),
                    bytes(Strings.toString(requiredMetapoolLpTokens)),
                    bytes(", metapoolLP but only "),
                    bytes(Strings.toString(gaugeTokens)),
                    bytes(" available.")
                )
            )
        );

        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards for deposit
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            requiredMetapoolLpTokens,
            true
        );
        console.log("2");
        uint256 metapoolLPWithdrawn = metapoolErc20.balanceOf(address(this));
        uint256 metapoolLpDollarValue = metapoolLPWithdrawn * metapool.get_virtual_price() / 10**18;

        console.log("MID WITHDRAWAL!");
        console.log("Metapool LP withdrawn: ", metapoolLPWithdrawn / 10**18);
        console.log("Metapool price: ", metapool.get_virtual_price());
        console.log("Curve price: ", curvePool.get_virtual_price());
        console.log("Metapool LP dollar value: ", metapoolLpDollarValue / 10**18);
        console.log("Stablecoin metapool dollar value: ", metapoolLpDollarValue / 10**18 * curvePool.get_virtual_price() / 10**18);

        uint256[2] memory _minAmounts = [uint256(0), uint256(0)];
        // always withdraw all of the available metapool LP tokens (similar to how we always deposit all)
        uint256[2] memory removedCoins = metapool.remove_liquidity(metapoolErc20.balanceOf(address(this)), _minAmounts);
        console.log("REMOVED OUSD: ", removedCoins[0] / 10**18);
        console.log("REMOVED 3Crv: ", removedCoins[1] / 10**18);

        // Receive too much 3crv 
        if (removedCoins[1] > num3CrvTokens) {
            // TODO: should there be a gas saving threshold, to not perform a swap if value diff is 
            // relatively small
            metapool.exchange(1, 0, removedCoins[1] - num3CrvTokens, 0);
        }
        // We don't have enough 3CRV we need to swap for more
        else  {
            uint256 ousdToSwap = metapool.get_dy(0, 1, num3CrvTokens - removedCoins[1]);
            // TODO these coin indexes should probably be dynamic
            metapool.exchange(0, 1, ousdToSwap, 0);
        }

        console.log("OUSD balance after swap: ", ousd.balanceOf(address(this)) / 10**18);
        console.log("3CRV LP balance after swap: ", threePoolLp.balanceOf(address(this)) / 10**18);
        vault.redeemForStrategy(ousd.balanceOf(address(this)));

        console.log("AFTER WITHDRAWAL!");
        console.log("OUSD balance: ", ousd.balanceOf(address(this)) / 10**18);
        console.log("GAuge tokens: ", IRewardStaking(cvxRewardStakerAddress).balanceOf(address(this)) / 10**18);
        console.log("GAuge tokens diff: ", (gaugeTokens - IRewardStaking(cvxRewardStakerAddress).balanceOf(address(this))) / 10**18);
        console.log("Metapool LP: ", metapoolErc20.balanceOf(address(this)) / 10**18);
    }

    // be cognisent of OUSD balance 
    function _lpWithdraw_one(uint256 numPTokens) internal {
        console.log("WITHDRAWAL");
        // NOTES: you are responsible now for figuring out if strategy has enough tokens
        // 
        //
        IERC20 metapoolErc20 = IERC20(address(metapool));
        IERC20 threePoolLp = IERC20(pTokenAddress);
        ICurvePool curvePool = ICurvePool(platformAddress);

        uint256 gaugeTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(address(this));
        console.log("GAuge tokens before: ", gaugeTokens / 10**18);
        console.log("NUM pTokens to withdraw", numPTokens / 10**18);

        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards for deposit
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            numPTokens,
            true
        );
        uint256 metapoolLPWithdrawn = metapoolErc20.balanceOf(address(this));
        uint256 metapoolLpDollarValue = metapoolLPWithdrawn * metapool.get_virtual_price() / 10**18;

        console.log("MID WITHDRAWAL!");
        console.log("Metapool LP withdrawn: ", metapoolLPWithdrawn / 10**18);
        console.log("Metapool price: ", metapool.get_virtual_price());
        console.log("Curve price: ", curvePool.get_virtual_price());
        console.log("Metapool LP dollar value: ", metapoolLpDollarValue / 10**18);
        console.log("Stablecoin metapool dollar value: ", metapoolLpDollarValue / 10**18 * curvePool.get_virtual_price() / 10**18);
        console.log("MIN AMOUNT: ", metapoolLpDollarValue / 2);
        console.log("MIN AMOUNT(formatted): ", metapoolLpDollarValue / 4 / 10**18);

        /* When depositing to Metapool we mint the amount of OUSD that corresponds to dollar value
         * of the deposited LP tokens. And when withdrawing from the Metapool we expect to receive
         * half of it as OUSD in the corresponding dollar value of the LP withdrawn.
         *
         * TODO: should we fixate to get half in stablecoins rather in OUSD?
         * 
         * note: 
         * - OUSD token position 0
         * - 3CrvLP token position 1
         */
        //uint256[2] memory _minAmounts = [metapoolLpDollarValue / 4, uint256(0)];
        uint256[2] memory _minAmounts = [uint256(0), uint256(0)];
        // always withdraw all of the available metapool LP tokens (similar to how we always deposit all)
        uint256[2] memory removedCoins = metapool.remove_liquidity(metapoolErc20.balanceOf(address(this)), _minAmounts);
        console.log("REMOVED OUSD: ", removedCoins[0] / 10**18);
        console.log("REMOVED 3Crv: ", removedCoins[1] / 10**18);

        console.log("OUSD balance: ", ousd.balanceOf(address(this)) / 10**18);
        uint256 ousdBalance = ousd.balanceOf(address(this));
        vault.redeemForStrategy(ousdBalance);
        // TODO: could this underflow?
        ousdMinted -= ousdBalance;

        console.log("AFTER WITHDRAWAL!");
        console.log("OUSD balance: ", ousd.balanceOf(address(this)) / 10**18);
        console.log("3Pool balance: ", threePoolLp.balanceOf(address(this)) / 10**18);
        console.log("GAuge tokens: ", IRewardStaking(cvxRewardStakerAddress).balanceOf(address(this)) / 10**18);
        console.log("GAuge tokens diff: ", (gaugeTokens - IRewardStaking(cvxRewardStakerAddress).balanceOf(address(this))) / 10**18);
        console.log("Metapool LP: ", metapoolErc20.balanceOf(address(this)) / 10**18);
    }

    function _lpWithdrawAll() internal override {
        IERC20 metapoolErc20 = IERC20(address(metapool));
        uint256 gaugeTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(address(this));
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            gaugeTokens,
            true
        );

        uint256[2] memory _minAmounts = [uint256(0), uint256(0)];
        metapool.remove_liquidity(metapoolErc20.balanceOf(address(this)), _minAmounts);

        vault.redeemForStrategy(ousd.balanceOf(address(this)));
        console.log("OUSD balance: ", ousd.balanceOf(address(this)) / 10**18);
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
        balance = 0;
        // LP tokens in this contract. This should generally be nothing as we
        // should always stake the full balance in the Gauge, but include for
        // safety
        uint256 contractPTokens = IERC20(pTokenAddress).balanceOf(address(this));
        ICurvePool curvePool = ICurvePool(platformAddress);
        if (contractPTokens > 0) {
            uint256 virtual_price = curvePool.get_virtual_price();
            uint256 value = (contractPTokens * virtual_price) / 1e18;
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            balance += value.scaleBy(assetDecimals, 18) / 3;
        }

        uint256 metapoolPTokens = IERC20(address(metapool)).balanceOf(address(this));
        uint256 metapoolGaugePTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );
        uint256 metapoolTotalPTokens = metapoolPTokens + metapoolGaugePTokens;

        if (metapoolTotalPTokens > 0) {
            uint256 metapool_virtual_price = metapool.get_virtual_price();
            uint256 value = (metapoolTotalPTokens * metapool_virtual_price) / 1e18;
            uint256 assetDecimals = Helpers.getDecimals(_asset);
            balance += value.scaleBy(assetDecimals, 18) / 3;   
        }
    }

    function _approveBase() internal override {
        IERC20 pToken = IERC20(pTokenAddress);
        IERC20 ousdPoolLp = IERC20(address(metapool));

        // 3Pool for LP token (required for removing liquidity)
        pToken.safeApprove(platformAddress, 0);
        pToken.safeApprove(platformAddress, type(uint256).max);
        // Gauge for LP token
        ousdPoolLp.safeApprove(cvxDepositorAddress, 0);
        ousdPoolLp.safeApprove(cvxDepositorAddress, type(uint256).max);
        // Metapool for LP token
        pToken.safeApprove(address(metapool), 0);
        pToken.safeApprove(address(metapool), type(uint256).max);
        // Metapool for OUSD token
        ousd.safeApprove(address(metapool), 0);
        ousd.safeApprove(address(metapool), type(uint256).max);
    }

    /**
     * @dev Withdraw asset from Curve 3Pool
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    // function withdraw(
    //     address _recipient,
    //     address _asset,
    //     uint256 _amount
    // ) external override onlyVault nonReentrant {
    //     withdrawStrat1(_recipient, _asset, _amount);
    // }

    /* Withdraw from strategy in a way where we are cognisant to burn the amount of OUSD proportional
     * to the amount of gauge tokens present.
     * 
     * TODO: do we need a withdrawAll counterpart that also pays attention to amount of OUSD withdrawn?
     */
    function withdrawStrat1(
        address _recipient,
        address _asset,
        uint256 _amount
    ) internal {
        require(_amount > 0, "Invalid amount");

        emit Withdrawal(_asset, address(assetToPToken[_asset]), _amount);

        uint256 crv3Tokens = IERC20(pTokenAddress).balanceOf(address(this));
        uint256 gaugeMetaTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );

        uint256 maxOUSDWithdrawable = metapool.calc_withdraw_one_coin(
            gaugeMetaTokens,
            int128(0) // OUSD coin index
        );

        // This much gauge tokens we can spend on 3CrvLP token and still be on track to burn all
        // OUSD that we have minted
        uint256 total3PoolGaugeMetaTokens = gaugeMetaTokens - ousdMinted * gaugeMetaTokens / maxOUSDWithdrawable;
        // what is the rate between metapoolLP tokens representing withdrawable OUSD vs representing withdrawable 3pool
        // in basis points
        uint256 ousdTo3PoolMetapoolGaugeRateBP = (gaugeMetaTokens - total3PoolGaugeMetaTokens) * 10000 / gaugeMetaTokens;
        // 🔴 why was initial ousdMInted 350 units above expected value?
        console.log("ousdMinted: ", ousdMinted / 1e18);
        console.log("maxOUSDWithdrawable: ", maxOUSDWithdrawable / 1e18);
        console.log("gaugeMetaTokens: ", gaugeMetaTokens / 1e18);
        console.log("total3PoolGaugeMetaTokens: ", total3PoolGaugeMetaTokens / 1e18);
        console.log("ousdTo3PoolMetapoolGaugeRateBP: ", ousdTo3PoolMetapoolGaugeRateBP);

        /* Calculate what is the maximum amount of 3crv that is withdrawable if we were
         * to unstake all the gauge tokens.
         */
        uint256 max3CrvTokensWithdrawable = metapool.calc_withdraw_one_coin(
            total3PoolGaugeMetaTokens,
            int128(1) // 3CRv coin index
        );
        console.log("max3CrvTokensWithdrawable: ", max3CrvTokensWithdrawable / 1e18);

        uint256 totalAvailable3CrvTokens = crv3Tokens + max3CrvTokensWithdrawable;
        console.log("totalAvailable3CrvTokens: ", totalAvailable3CrvTokens / 1e18);

        uint256 coinIndex = _getCoinIndex(_asset);
        uint256 maxAmount = ICurvePool(platformAddress).calc_withdraw_one_coin(
            totalAvailable3CrvTokens,
            int128(uint128(coinIndex)) // Curve coin index
        );
        uint256 maxBurned3PoolTokens = (totalAvailable3CrvTokens * _amount) / maxAmount;

        console.log("_amount: ", _amount / 1e6);
        console.log("maxAmount: ", maxAmount / 1e6);
        console.log("maxBurned3PoolTokens: ", maxBurned3PoolTokens / 1e18);

        // Not enough in this contract or in the Gauge, can't proceed
        require(totalAvailable3CrvTokens > maxBurned3PoolTokens, "Insufficient 3CRV balance");
        // We have enough LP tokens, make sure they are all on this contract
        if (crv3Tokens < maxBurned3PoolTokens) {
            // removing twice the required amount of pTokens since we are going to burn the OUSD
            uint256 withdrawAmount = maxBurned3PoolTokens - crv3Tokens;
            // Add enough tokens so that when removing liquidity sufficient amount of 3CRV along with
            // OUSD gets withdrawn.
            console.log("Wanting to get additional 3CRV from metapool:", withdrawAmount / 1e18);
            console.log("crv3Tokens:", crv3Tokens / 1e18);
            console.log("maxBurned3PoolTokens:", maxBurned3PoolTokens / 1e18);
            console.log("LP TO WITHDRAW:", (withdrawAmount + withdrawAmount * ousdTo3PoolMetapoolGaugeRateBP * 2 / 10000) / 1e18);
            console.log("----");
            console.log("----");
            console.log("3pool before:", IERC20(pTokenAddress).balanceOf(address(this)) / 1e17);
            _lpWithdraw(withdrawAmount + withdrawAmount * ousdTo3PoolMetapoolGaugeRateBP * 2 / 10000);
        }

        uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
        _amounts[coinIndex] = _amount;
        console.log("3pool mid:", IERC20(pTokenAddress).balanceOf(address(this)) / 1e18);
        ICurvePool(platformAddress).remove_liquidity_imbalance(_amounts, maxBurned3PoolTokens);
        /* This method of calculation leaves us with ~1% of surplus 3 pool tokens. Probably because of
         * using calc_withdraw_one_coin to calculate the basis of how much tokens to withdraw, when
         * _lpWithdraw uses just a normal remove_liquidity. 
         * 
         * Would be convenient if there was a function on curve pool that would let us exactly calculate
         * how much LP we need to burn using remove_liquidity to receive X amount of either of the tokens.
         *
         * this one works with combination of _lpWithdraw_one of withdrawal function
         */
        console.log("3pool after:", IERC20(pTokenAddress).balanceOf(address(this)) / 1e18);
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /* Withdraw from strategy in a way where we are cognisant to burn the amount of OUSD proportional
     * to the amount of gauge tokens present
     */
    // function unchangedMess(
    //     address _recipient,
    //     address _asset,
    //     uint256 _amount
    // ) internal {
    //     require(_amount > 0, "Invalid amount");

    //     emit Withdrawal(_asset, address(assetToPToken[_asset]), _amount);

    //     (uint256 contractPTokens, uint256 gaugePTokens, uint256 totalPTokens) = _getTotalPTokens();

    //     /* Calculate what is the maximum amount of asset that is withdrawable if we were
    //      * to unstake all the gauge tokens.
    //      */
    //     uint256 max3CrvTokensWithdrawn = metapool.calc_withdraw_one_coin(
    //         gaugePTokens,
    //         int128(1) // 3CRv coin index
    //     );

    //     uint256 adjustedTotalPTokens = contractPTokens + gaugePTokens / 2;
    //     uint256 coinIndex = _getCoinIndex(_asset);
    //     uint256 maxAmount = ICurvePool(platformAddress).calc_withdraw_one_coin(
    //         adjustedTotalPTokens,
    //         int128(uint128(coinIndex)) // Curve coin index
    //     );
    //     uint256 maxBurnedPTokens = (adjustedTotalPTokens * _amount) / maxAmount;

    //     // Not enough in this contract or in the Gauge, can't proceed
    //     require(adjustedTotalPTokens > maxBurnedPTokens, "Insufficient 3CRV balance");
    //     // We have enough LP tokens, make sure they are all on this contract
    //     if (contractPTokens < maxBurnedPTokens) {
    //         // removing twice the required amount of pTokens since we are going to burn the OUSD
    //         _lpWithdraw((maxBurnedPTokens - contractPTokens) * 2);
    //     }

    //     uint256[3] memory _amounts = [uint256(0), uint256(0), uint256(0)];
    //     _amounts[coinIndex] = _amount;
    //     ICurvePool(platformAddress).remove_liquidity_imbalance(_amounts, maxBurnedPTokens);
    //     IERC20(_asset).safeTransfer(_recipient, _amount);
    // }
    
    /**
     * @dev Collect accumulated CRV and CVX and send to Vault.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        console.log("COLLECT REWARDS!");
        // Collect CRV and CVX
        IRewardStaking(cvxRewardStakerAddress).getReward();
        _collectRewardTokens();
    }
}
