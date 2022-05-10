// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title Curve Convex Strategy
 * @notice Investment strategy for investing stablecoins via Curve 3Pool
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IRewardStaking } from "./IRewardStaking.sol";
import { IConvexDeposits } from "./IConvexDeposits.sol";
import { ICurvePool } from "./ICurvePool.sol";
import { ICurveMetaPool } from "./ICurveMetaPool.sol";
import { IERC20, BaseCurveStrategy } from "./BaseCurveStrategy.sol";
import { StableMath } from "../utils/StableMath.sol";
import { InitializableSecondary } from "../utils/InitializableSecondary.sol";
import { Helpers } from "../utils/Helpers.sol";
import { IVault } from "../interfaces/IVault.sol";

contract ConvexMetaStrategy is BaseCurveStrategy, InitializableSecondary {
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    address internal cvxDepositorAddress;
    address internal cvxRewardStakerAddress;
    uint256 internal cvxDepositorPTokenId;
    ICurveMetaPool internal metapool;
    IERC20 internal ousd;
    IVault internal vault;

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
        uint256 ousdBalance = ousd.balanceOf(address(this));
        uint256[2] memory _amounts = [ousdBalance, threePoolLpBalance];

        // TODO: figure out what the best slippage guard is. Also minReceived is in 
        // OUSD3Pool LP tokens so need to account for that 
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

    function _lpWithdraw(uint256 numPTokens) internal override {
        IERC20 metapoolErc20 = IERC20(address(metapool));

        // withdraw and unwrap with claim takes back the lpTokens and also collects the rewards to this
        IRewardStaking(cvxRewardStakerAddress).withdrawAndUnwrap(
            // removing twice the required amount of pTokens since we are going to burn the OUSD
            numPTokens * 2,
            true
        );
        uint256[2] memory _minAmounts = [uint256(0), uint256(0)];
        // always withdraw all of the available metapool LP tokens (similar to how we always deposit all)
        metapool.remove_liquidity(metapoolErc20.balanceOf(address(this)), _minAmounts);
        vault.redeemForStrategy(ousd.balanceOf(address(this)));
    }

    /**
     * @dev Calculate the total platform token balance (i.e. 3CRV) that exist in
     * this contract or is staked in the Gauge (or in other words, the total
     * amount platform tokens we own).
     * @return contractPTokens Amount of platform tokens in this contract
     * @return gaugePTokens Amount of platform tokens staked in gauge
     * @return totalPTokens Total amount of platform tokens in native decimals
     */
    function _getTotalPTokens()
        internal
        view
        override
        returns (
            uint256 contractPTokens,
            uint256 gaugePTokens, // gauge is a misnomer here, need a better name
            uint256 totalPTokens
        )
    {
        contractPTokens = IERC20(pTokenAddress).balanceOf(address(this));
        uint256 metapoolLP = IERC20(address(metapool)).balanceOf(address(this));
        /* TODO: confirm the logic is sound. We are reporting half of the actual balance
         * of gaugeTokens since half of them are represented as OUSD that get burned
         * after the withdrawal.
         */
        gaugePTokens = IRewardStaking(cvxRewardStakerAddress).balanceOf(
            address(this)
        );
        //booster.poolInfo[pid].token.balanceOf(address(this)) Not needed if we always stake..
        totalPTokens = contractPTokens + metapoolLP + gaugePTokens;
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
     * @dev Collect accumulated CRV and CVX and send to Vault.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        // Collect CRV and CVX
        IRewardStaking(cvxRewardStakerAddress).getReward();
        _collectRewardTokens();
    }
}
