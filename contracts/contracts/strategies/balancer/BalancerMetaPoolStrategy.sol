// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Balancer MetaStablePool Strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BaseAuraStrategy, BaseBalancerStrategy } from "./BaseAuraStrategy.sol";
import { IBalancerVault } from "../../interfaces/balancer/IBalancerVault.sol";
import { IRateProvider } from "../../interfaces/balancer/IRateProvider.sol";
import { IMetaStablePool } from "../../interfaces/balancer/IMetaStablePool.sol";
import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";

contract BalancerMetaPoolStrategy is BaseAuraStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    constructor(
        BaseStrategyConfig memory _stratConfig,
        BaseBalancerConfig memory _balancerConfig,
        address _auraRewardPoolAddress
    )
        InitializableAbstractStrategy(_stratConfig)
        BaseBalancerStrategy(_balancerConfig)
        BaseAuraStrategy(_auraRewardPoolAddress)
    {}

    /**
     * @notice Deposits an `_amount` of vault collateral assets
     * from the this strategy contract to the Balancer pool.
     * @param _asset Address of the Vault collateral asset
     * @param _amount The amount of Vault collateral assets to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        whenNotInVaultContext
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @notice Deposits specified vault collateral assets
     * from the this strategy contract to the Balancer pool.
     * @param _assets Address of the Vault collateral assets
     * @param _amounts The amount of each asset to deposit
     */
    function deposit(address[] memory _assets, uint256[] memory _amounts)
        external
        whenNotInVaultContext
        onlyVault
        nonReentrant
    {
        _deposit(_assets, _amounts);
    }

    /**
     * @notice Deposits all supported assets in the strategy contract
     * to the Balancer pool.
     */
    function depositAll()
        external
        override
        whenNotInVaultContext
        onlyVault
        nonReentrant
    {
        uint256 assetsLength = assetsMapped.length;
        for (uint256 i = 0; i < assetsLength; ++i) {
            address asset = assetsMapped[i];
            uint256 balance = IERC20(asset).balanceOf(address(this));
            if (balance > 0) {
                _deposit(asset, balance);
            }
        }
    }

    /**
     * @param _asset Address of the vault collateral asset that is being deposited. This is converted to the pool asset.
     * @param _amount the max amount of vault assets that can be deposited.
     */
    function _deposit(address _asset, uint256 _amount) internal {
        /* dust rounding issues with stETH. When allocate is called it tries
         * to deposit 1-2 wei of stETH and the deposit fails with BPT amount check.
         *
         * TODO: solve this (only a problem when it is a default strategy for stETH)
         */
        if (_asset == stETH && _amount < 20) {
            return;
        }

        emit Deposit(_asset, platformAddress, _amount);

        (address poolAsset, uint256 poolAmount) = wrapPoolAsset(
            _asset,
            _amount
        );

        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );

        uint256[] memory maxAmountsIn = new uint256[](tokens.length);
        address[] memory poolAssets = new address[](tokens.length);
        uint256 assetIndex = 0;
        for (uint256 i = 0; i < tokens.length; ++i) {
            poolAssets[i] = address(tokens[i]);
            if (address(tokens[i]) == poolAsset) {
                maxAmountsIn[i] = poolAmount;
                assetIndex = i;
            } else {
                maxAmountsIn[i] = 0;
            }
        }

        // Although we receive the exact BPT amount from the join,
        // we have need to reduce this by the max slippage so we don't exceed the
        // computed amount of pool assets that are deposited to the balancer pool.
        uint256 minBPT = getBPTExpected(_asset, _amount);
        uint256 minBPTwSlippage = minBPT.mulTruncate(1e18 - maxDepositSlippage);

        /* TOKEN_IN_FOR_EXACT_BPT_OUT:
         * User sends an estimated but unknown (computed at run time) quantity of a single token,
         * and receives a precise quantity of BPT.
         *
         * ['uint256', 'uint256', 'uint256']
         * [TOKEN_IN_FOR_EXACT_BPT_OUT, bptAmountOut, enterTokenIndex]
         */
        bytes memory userData = abi.encode(
            IBalancerVault.WeightedPoolJoinKind.TOKEN_IN_FOR_EXACT_BPT_OUT,
            minBPTwSlippage,
            assetIndex
        );

        IBalancerVault.JoinPoolRequest memory request = IBalancerVault
            .JoinPoolRequest(poolAssets, maxAmountsIn, userData, false);

        balancerVault.joinPool(
            balancerPoolId,
            address(this),
            address(this),
            request
        );

        // Deposit the BPT tokens into Aura
        _lpDepositAll();
    }

    function _deposit(address[] memory _assets, uint256[] memory _amounts)
        internal
    {
        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );

        uint256[] memory mappedAmounts = new uint256[](tokens.length);
        address[] memory mappedAssets = new address[](tokens.length);
        for (uint256 i = 0; i < _assets.length; ++i) {
            address asset = _assets[i];
            uint256 amount = _amounts[i];
            /* dust rounding issues with stETH. When allocate is called it tries
             * to deposit 1-2 wei of stETH and the deposit fails with BPT amount check.
             *
             * TODO: solve this (only a problem when it is a default strategy for stETH)
             */
            if (_assets[i] == stETH && _amounts[i] < 20) {
                continue;
            }

            emit Deposit(asset, platformAddress, amount);

            // wrap rebasing assets like stETH and frxETH to wstETH and sfrxETH
            (mappedAssets[i], mappedAmounts[i]) = wrapPoolAsset(asset, amount);
        }

        uint256[] memory amountsIn = new uint256[](tokens.length);
        address[] memory poolAssets = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; ++i) {
            // Convert IERC20 type to address
            poolAssets[i] = address(tokens[i]);

            // For each of the mapped assets
            for (uint256 j = 0; j < mappedAssets.length; ++j) {
                // If the pool asset is the same as the mapped asset
                if (poolAssets[i] == mappedAssets[j]) {
                    amountsIn[i] = mappedAmounts[j];
                }
            }
        }

        uint256 minBPT = getBPTExpected(_assets, _amounts);
        uint256 minBPTwSlippage = minBPT.mulTruncate(1e18 - maxDepositSlippage);

        /* EXACT_TOKENS_IN_FOR_BPT_OUT:
         * User sends precise quantities of tokens, and receives an
         * estimated but unknown (computed at run time) quantity of BPT.
         *
         * ['uint256', 'uint256[]', 'uint256']
         * [EXACT_TOKENS_IN_FOR_BPT_OUT, amountsIn, minimumBPT]
         */
        bytes memory userData = abi.encode(
            IBalancerVault.WeightedPoolJoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT,
            amountsIn,
            minBPTwSlippage
        );

        IBalancerVault.JoinPoolRequest memory request = IBalancerVault
            .JoinPoolRequest(poolAssets, amountsIn, userData, false);

        // Add the pool assets in this strategy to the balancer pool
        balancerVault.joinPool(
            balancerPoolId,
            address(this),
            address(this),
            request
        );

        // Deposit the BPT tokens into Aura
        _lpDepositAll();
    }

    /**
     * @notice Withdraws Vault collateral assets from the Balancer pool.
     * @param _recipient Address to receive the Vault collateral assets. Typically is the Vault.
     * @param _asset Address of the Vault collateral asset
     * @param _amount The amount of Vault collateral assets to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override whenNotInVaultContext onlyVault nonReentrant {
        (address poolAsset, uint256 poolAmount) = toPoolAsset(_asset, _amount);

        uint256 BPTtoWithdraw = getBPTExpected(_asset, _amount);
        // adjust for slippage
        BPTtoWithdraw = BPTtoWithdraw.mulTruncate(1e18 + maxWithdrawalSlippage);

        _lpWithdraw(BPTtoWithdraw);

        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );
        uint256[] memory minAmountsOut = new uint256[](tokens.length);
        address[] memory poolAssets = new address[](tokens.length);
        uint256 assetIndex = 0;
        for (uint256 i = 0; i < tokens.length; ++i) {
            poolAssets[i] = address(tokens[i]);
            if (address(tokens[i]) == poolAsset) {
                minAmountsOut[i] = poolAmount;
                assetIndex = i;
            } else {
                minAmountsOut[i] = 0;
            }
        }

        /* Single asset exit: EXACT_BPT_IN_FOR_ONE_TOKEN_OUT:
         * User sends a precise quantity of BPT, and receives an estimated but unknown
         * (computed at run time) quantity of a single token
         *
         * ['uint256', 'uint256', 'uint256']
         * [EXACT_BPT_IN_FOR_ONE_TOKEN_OUT, bptAmountIn, exitTokenIndex]
         */
        bytes memory userData = abi.encode(
            IBalancerVault.WeightedPoolExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT,
            BPTtoWithdraw,
            assetIndex
        );

        IBalancerVault.ExitPoolRequest memory request = IBalancerVault
            .ExitPoolRequest(poolAssets, minAmountsOut, userData, false);

        balancerVault.exitPool(
            balancerPoolId,
            address(this),
            // TODO: this is incorrect and should be altered when/if we intend to support
            // pools that deal with native ETH
            payable(address(this)),
            request
        );

        unwrapPoolAsset(_asset, poolAmount);
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @notice Withdraws all supported Vault collateral assets from the Balancer pool
     * and send to the OToken's Vault.
     *
     * Is only executable by the OToken's Vault or the Governor.
     */
    function withdrawAll()
        external
        override
        whenNotInVaultContext
        onlyVaultOrGovernor
        nonReentrant
    {
        _lpWithdrawAll();

        uint256 BPTtoWithdraw = IERC20(platformAddress).balanceOf(
            address(this)
        );

        (IERC20[] memory tokens, uint256[] memory balances, ) = balancerVault
            .getPoolTokens(balancerPoolId);

        // the strategy's share of the pool assets
        uint256 strategyShare = BPTtoWithdraw.divPrecisely(
            IERC20(platformAddress).totalSupply()
        );

        uint256[] memory minAmountsOut = new uint256[](tokens.length);
        address[] memory poolAssets = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; ++i) {
            poolAssets[i] = address(tokens[i]);
            minAmountsOut[i] = balances[i]
                .mulTruncate(strategyShare)
                .mulTruncate(1e18 - maxWithdrawalSlippage);
        }

        /* Proportional exit: EXACT_BPT_IN_FOR_TOKENS_OUT:
         * User sends a precise quantity of BPT, and receives an estimated but unknown
         * (computed at run time) quantity of a single token
         *
         * ['uint256', 'uint256']
         * [EXACT_BPT_IN_FOR_TOKENS_OUT, bptAmountIn]
         */
        bytes memory userData = abi.encode(
            IBalancerVault.WeightedPoolExitKind.EXACT_BPT_IN_FOR_TOKENS_OUT,
            BPTtoWithdraw
        );

        IBalancerVault.ExitPoolRequest memory request = IBalancerVault
            .ExitPoolRequest(poolAssets, minAmountsOut, userData, false);

        balancerVault.exitPool(
            balancerPoolId,
            address(this),
            // TODO: this is incorrect and should be altered when/if we intend to support
            // pools that deal with native ETH
            payable(address(this)),
            request
        );

        for (uint256 i = 0; i < tokens.length; ++i) {
            address asset = assetsMapped[i];
            // slither-disable-next-line uninitialized-local
            address poolAsset = toPoolAsset(asset);
            uint256 poolBalance = IERC20(poolAsset).balanceOf(address(this));
            if (poolBalance > 0) {
                unwrapPoolAsset(asset, poolBalance);
            }

            uint256 transferAmount = IERC20(asset).balanceOf(address(this));
            if (transferAmount > 0) {
                IERC20(asset).safeTransfer(vaultAddress, transferAmount);
                emit Withdrawal(asset, platformAddress, transferAmount);
            }
        }
    }

    /**
     * @notice Approves the Balancer pool to transfer all supported
     * assets from this strategy.
     * Also approve any suppered assets that are wrapped in the Balancer pool
     * like stETH and frxETH, to be transferred from this strategy to their
     * respective wrapper contracts. eg wstETH and sfrxETH.
     *
     * Is only executable by the Governor.
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            _approveAsset(assetsMapped[i]);
        }
        _approveBase();
    }

    // solhin t-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address) internal override {
        address poolAsset = toPoolAsset(_asset);
        if (_asset == stETH) {
            IERC20(stETH).safeApprove(wstETH, 1e50);
        } else if (_asset == frxETH) {
            IERC20(frxETH).safeApprove(sfrxETH, 1e50);
        }
        _approveAsset(poolAsset);
    }

    /**
     * @dev Approves the Balancer Vault to transfer an asset from
     * this strategy. The assets could be a Vault collateral asset
     * like WETH or rETH; or a Balancer pool asset that wraps the vault asset
     * like wstETH or sfrxETH.
     */
    function _approveAsset(address _asset) internal {
        IERC20 asset = IERC20(_asset);
        asset.safeApprove(address(balancerVault), 0);
        asset.safeApprove(address(balancerVault), type(uint256).max);
    }
}
