// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OETH Balancer MetaStablePool Strategy
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AbstractAuraStrategy, AbstractBalancerStrategy } from "./AbstractAuraStrategy.sol";
import { IBalancerVault } from "../../interfaces/balancer/IBalancerVault.sol";
import { IRateProvider } from "../../interfaces/balancer/IRateProvider.sol";
import { IMetaStablePool } from "../../interfaces/balancer/IMetaStablePool.sol";
import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { StableMath } from "../../utils/StableMath.sol";

contract BalancerMetaPoolStrategy is AbstractAuraStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    constructor(
        BaseStrategyConfig memory _stratConfig,
        BaseBalancerConfig memory _balancerConfig,
        address _auraRewardPoolAddress
    )
        InitializableAbstractStrategy(_stratConfig)
        AbstractBalancerStrategy(_balancerConfig)
        AbstractAuraStrategy(_auraRewardPoolAddress)
    {}

    /**
     * @notice There are no plans to configure BalancerMetaPool as a default
     * asset strategy. For that reason there is no need to support this
     * functionality.
     */
    function deposit(address, uint256)
        external
        override
        onlyVault
        nonReentrant
    {
        revert("Not supported");
    }

    /**
     * @notice There are no plans to configure BalancerMetaPool as a default
     * asset strategy. For that reason there is no need to support this
     * functionality.
     */
    function deposit(address[] calldata, uint256[] calldata)
        external
        onlyVault
        nonReentrant
    {
        revert("Not supported");
    }

    /**
     * @notice Deposits all supported assets in this strategy contract to the Balancer pool.
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 assetsLength = assetsMapped.length;
        address[] memory strategyAssets = new address[](assetsLength);
        uint256[] memory strategyAmounts = new uint256[](assetsLength);

        // For each vault collateral asset
        for (uint256 i = 0; i < assetsLength; ++i) {
            strategyAssets[i] = assetsMapped[i];
            // Get the asset balance in this strategy contract
            strategyAmounts[i] = IERC20(strategyAssets[i]).balanceOf(
                address(this)
            );
        }
        _deposit(strategyAssets, strategyAmounts);
    }

    /*
     * _deposit doesn't require a read-only re-entrancy protection since during the deposit
     * the function enters the Balancer Vault Context. If this function were called as part of
     * the attacking contract (while intercepting execution flow upon receiving ETH) the read-only
     * protection of the Balancer Vault would be triggered. Since the attacking contract would
     * already be in the Balancer Vault context and wouldn't be able to enter it again.
     */
    function _deposit(
        address[] memory _strategyAssets,
        uint256[] memory _strategyAmounts
    ) internal {
        require(
            _strategyAssets.length == _strategyAmounts.length,
            "Array length missmatch"
        );

        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );

        uint256[] memory strategyAssetAmountsToPoolAssetAmounts = new uint256[](
            _strategyAssets.length
        );
        address[] memory strategyAssetsToPoolAssets = new address[](
            _strategyAssets.length
        );

        for (uint256 i = 0; i < _strategyAssets.length; ++i) {
            address strategyAsset = _strategyAssets[i];
            uint256 strategyAmount = _strategyAmounts[i];

            require(
                assetToPToken[strategyAsset] != address(0),
                "Unsupported asset"
            );
            strategyAssetsToPoolAssets[i] = _toPoolAsset(strategyAsset);

            if (strategyAmount > 0) {
                emit Deposit(strategyAsset, platformAddress, strategyAmount);

                // wrap rebasing assets like stETH and frxETH to wstETH and sfrxETH
                (, strategyAssetAmountsToPoolAssetAmounts[i]) = _wrapPoolAsset(
                    strategyAsset,
                    strategyAmount
                );
            }
        }

        uint256[] memory amountsIn = new uint256[](tokens.length);
        address[] memory poolAssets = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; ++i) {
            // Convert IERC20 type to address
            poolAssets[i] = address(tokens[i]);

            // For each of the mapped assets
            for (uint256 j = 0; j < strategyAssetsToPoolAssets.length; ++j) {
                // If the pool asset is the same as the mapped asset
                if (poolAssets[i] == strategyAssetsToPoolAssets[j]) {
                    amountsIn[i] = strategyAssetAmountsToPoolAssetAmounts[j];
                }
            }
        }

        uint256 minBPT = _getBPTExpected(
            strategyAssetsToPoolAssets,
            strategyAssetAmountsToPoolAssetAmounts
        );
        uint256 minBPTwDeviation = minBPT.mulTruncate(
            1e18 - maxDepositDeviation
        );

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
            minBPTwDeviation
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

        // Deposit the Balancer Pool Tokens (BPT) into Aura
        _lpDepositAll();
    }

    /**
     * @notice Withdraw a Vault collateral asset from the Balancer pool.
     * @param _recipient Address to receive the Vault collateral assets. Typically is the Vault.
     * @param _strategyAsset Address of the Vault collateral asset
     * @param _strategyAmount The amount of Vault collateral assets to withdraw
     */
    function withdraw(
        address _recipient,
        address _strategyAsset,
        uint256 _strategyAmount
    ) external override onlyVault nonReentrant {
        address[] memory strategyAssets = new address[](1);
        uint256[] memory strategyAmounts = new uint256[](1);
        strategyAssets[0] = _strategyAsset;
        strategyAmounts[0] = _strategyAmount;

        _withdraw(_recipient, strategyAssets, strategyAmounts);
    }

    /**
     * @notice Withdraw multiple Vault collateral asset from the Balancer pool.
     * @param _recipient Address to receive the Vault collateral assets. Typically is the Vault.
     * @param _strategyAssets Addresses of the Vault collateral assets
     * @param _strategyAmounts The amounts of Vault collateral assets to withdraw
     */
    function withdraw(
        address _recipient,
        address[] calldata _strategyAssets,
        uint256[] calldata _strategyAmounts
    ) external onlyVault nonReentrant {
        _withdraw(_recipient, _strategyAssets, _strategyAmounts);
    }

    /**
     * @dev Withdraw multiple Vault collateral asset from the Balancer pool.
     * @param _recipient Address to receive the Vault collateral assets. Typically is the Vault.
     * @param _strategyAssets Addresses of the Vault collateral assets
     * @param _strategyAmounts The amounts of Vault collateral assets to withdraw
     *
     * _withdrawal doesn't require a read-only re-entrancy protection since during the withdrawal
     * the function enters the Balancer Vault Context. If this function were called as part of
     * the attacking contract (while intercepting execution flow upon receiving ETH) the read-only
     * protection of the Balancer Vault would be triggered. Since the attacking contract would
     * already be in the Balancer Vault context and wouldn't be able to enter it again.
     */
    function _withdraw(
        address _recipient,
        address[] memory _strategyAssets,
        uint256[] memory _strategyAmounts
    ) internal {
        require(
            _strategyAssets.length == _strategyAmounts.length,
            "Invalid input arrays"
        );

        for (uint256 i = 0; i < _strategyAssets.length; ++i) {
            require(
                assetToPToken[_strategyAssets[i]] != address(0),
                "Unsupported asset"
            );
        }

        // STEP 1 - Calculate the Balancer pool assets and amounts from the vault collateral assets

        // Get all the supported balancer pool assets
        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );
        // Calculate the balancer pool assets and amounts to withdraw
        uint256[] memory poolAssetsAmountsOut = new uint256[](tokens.length);
        address[] memory poolAssets = new address[](tokens.length);
        // Is the wrapped asset amount indexed by the assets array, not the order of the Balancer pool tokens
        // eg wstETH and sfrxETH amounts, not the stETH and frxETH amounts
        uint256[] memory strategyAssetsToPoolAssetsAmounts = new uint256[](
            _strategyAssets.length
        );

        // For each of the Balancer pool assets
        for (uint256 i = 0; i < tokens.length; ++i) {
            poolAssets[i] = address(tokens[i]);

            // Convert the Balancer pool asset back to a vault collateral asset
            address strategyAsset = _fromPoolAsset(poolAssets[i]);

            // for each of the vault assets
            for (uint256 j = 0; j < _strategyAssets.length; ++j) {
                // If the vault asset equals the vault asset mapped from the Balancer pool asset
                if (_strategyAssets[j] == strategyAsset) {
                    (, poolAssetsAmountsOut[i]) = _toPoolAsset(
                        strategyAsset,
                        _strategyAmounts[j]
                    );
                    strategyAssetsToPoolAssetsAmounts[j] = poolAssetsAmountsOut[
                        i
                    ];

                    /* Because of the potential Balancer rounding error mentioned below
                     * the contract might receive 1-2 WEI smaller amount than required
                     * in the withdraw user data encoding. If slightly lesser token amount
                     * is received the strategy can not unwrap the pool asset as it is
                     * smaller than expected.
                     *
                     * For that reason we `overshoot` the required tokens expected to
                     * circumvent the error
                     */
                    if (poolAssetsAmountsOut[i] > 0) {
                        poolAssetsAmountsOut[i] += 2;
                    }
                }
            }
        }

        // STEP 2 - Calculate the max about of Balancer Pool Tokens (BPT) to withdraw

        // Estimate the required amount of Balancer Pool Tokens (BPT) for the assets
        uint256 maxBPTtoWithdraw = _getBPTExpected(
            poolAssets,
            /* all non 0 values are overshot by 2 WEI and with the expected mainnet
             * ~1% withdrawal deviation, the 2 WEI aren't important
             */
            poolAssetsAmountsOut
        );
        // Increase BPTs by the max allowed deviation
        // Any excess BPTs will be left in this strategy contract
        maxBPTtoWithdraw = maxBPTtoWithdraw.mulTruncate(
            1e18 + maxWithdrawalDeviation
        );

        // STEP 3  - Withdraw the Balancer Pool Tokens (BPT) from Aura to this strategy contract

        // Withdraw BPT from Aura allowing for BPTs left in this strategy contract from previous withdrawals
        _lpWithdraw(
            maxBPTtoWithdraw - IERC20(platformAddress).balanceOf(address(this))
        );

        // STEP 4 - Withdraw the balancer pool assets from the pool

        /* Custom asset exit: BPT_IN_FOR_EXACT_TOKENS_OUT:
         * User sends an estimated but unknown (computed at run time) quantity of BPT,
         * and receives precise quantities of specified tokens.
         *
         * ['uint256', 'uint256[]', 'uint256']
         * [BPT_IN_FOR_EXACT_TOKENS_OUT, amountsOut, maxBPTAmountIn]
         */
        bytes memory userData = abi.encode(
            IBalancerVault.WeightedPoolExitKind.BPT_IN_FOR_EXACT_TOKENS_OUT,
            poolAssetsAmountsOut,
            maxBPTtoWithdraw
        );

        IBalancerVault.ExitPoolRequest memory request = IBalancerVault
            .ExitPoolRequest(
                poolAssets,
                /* We specify the exact amount of a tokens we are expecting in the encoded
                 * userData, for that reason we don't need to specify the amountsOut here.
                 *
                 * Also Balancer has a rounding issue that can make a transaction fail:
                 * https://github.com/balancer/balancer-v2-monorepo/issues/2541
                 * which is an extra reason why this field is empty.
                 */
                new uint256[](tokens.length),
                userData,
                false
            );

        balancerVault.exitPool(
            balancerPoolId,
            address(this),
            /* Payable keyword is required because of the IBalancerVault interface even though
             * this strategy shall never be receiving native ETH
             */
            payable(address(this)),
            request
        );

        // STEP 5 - Re-deposit any left over BPT tokens back into Aura
        /* When concluding how much of BPT we need to withdraw from Aura we overshoot by
         * roughly around 1% (initial mainnet setting of maxWithdrawalDeviation). After exiting
         * the pool strategy could have left over BPT tokens that are not earning boosted yield.
         * We re-deploy those back in.
         */
        _lpDepositAll();

        // STEP 6 - Unswap balancer pool assets to vault collateral assets and send to the vault.

        // For each of the specified assets
        for (uint256 i = 0; i < _strategyAssets.length; ++i) {
            // Unwrap assets like wstETH and sfrxETH to rebasing assets stETH and frxETH
            if (strategyAssetsToPoolAssetsAmounts[i] > 0) {
                _unwrapPoolAsset(
                    _strategyAssets[i],
                    strategyAssetsToPoolAssetsAmounts[i]
                );
            }

            // Transfer the vault collateral assets to the recipient, which is typically the vault
            if (_strategyAmounts[i] > 0) {
                IERC20(_strategyAssets[i]).safeTransfer(
                    _recipient,
                    _strategyAmounts[i]
                );

                emit Withdrawal(
                    _strategyAssets[i],
                    platformAddress,
                    _strategyAmounts[i]
                );
            }
        }
    }

    /**
     * @notice Withdraws all supported Vault collateral assets from the Balancer pool
     * and send to the OToken's Vault.
     *
     * Is only executable by the OToken's Vault or the Governor.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        // STEP 1 - Withdraw all Balancer Pool Tokens (BPT) from Aura to this strategy contract

        _lpWithdrawAll();
        // Get the BPTs withdrawn from Aura plus any that were already in this strategy contract
        uint256 BPTtoWithdraw = IERC20(platformAddress).balanceOf(
            address(this)
        );
        // Get the balancer pool assets and their total balances
        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );
        uint256[] memory minAmountsOut = new uint256[](tokens.length);
        address[] memory poolAssets = new address[](tokens.length);
        for (uint256 i = 0; i < tokens.length; ++i) {
            poolAssets[i] = address(tokens[i]);
        }

        // STEP 2 - Withdraw the Balancer pool assets from the pool
        /* Proportional exit: EXACT_BPT_IN_FOR_TOKENS_OUT:
         * User sends a precise quantity of BPT, and receives an estimated but unknown
         * (computed at run time) quantity of a single token
         *
         * ['uint256', 'uint256']
         * [EXACT_BPT_IN_FOR_TOKENS_OUT, bptAmountIn]
         *
         * It is ok to pass an empty minAmountsOut since tilting the pool in any direction
         * when doing a proportional exit can only be beneficial to the strategy. Since
         * it will receive more of the underlying tokens for the BPT traded in.
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
            /* Payable keyword is required because of the IBalancerVault interface even though
             * this strategy shall never be receiving native ETH
             */
            payable(address(this)),
            request
        );

        // STEP 3 - Convert the balancer pool assets to the vault collateral assets and send to the vault
        // For each of the Balancer pool assets
        for (uint256 i = 0; i < tokens.length; ++i) {
            address poolAsset = address(tokens[i]);
            // Convert the balancer pool asset to the strategy asset
            address strategyAsset = _fromPoolAsset(poolAsset);
            // Get the balancer pool assets withdraw from the pool plus any that were already in this strategy contract
            uint256 poolAssetAmount = IERC20(poolAsset).balanceOf(
                address(this)
            );

            // Unwrap assets like wstETH and sfrxETH to rebasing assets stETH and frxETH
            uint256 unwrappedAmount = 0;
            if (poolAssetAmount > 0) {
                unwrappedAmount = _unwrapPoolAsset(
                    strategyAsset,
                    poolAssetAmount
                );
            }

            // Transfer the vault collateral assets to the vault
            if (unwrappedAmount > 0) {
                IERC20(strategyAsset).safeTransfer(
                    vaultAddress,
                    unwrappedAmount
                );
                emit Withdrawal(
                    strategyAsset,
                    platformAddress,
                    unwrappedAmount
                );
            }
        }
    }

    /**
     * @notice Approves the Balancer Vault to transfer poolAsset counterparts
     * of all of the supported assets from this strategy. E.g. stETH is a supported
     * strategy and Balancer Vault gets unlimited approval to transfer wstETH.
     *
     * If Balancer pool uses a wrapped version of a supported asset then also approve
     * unlimited usage of an asset to the contract responsible for wrapping.
     *
     * Approve unlimited spending by Balancer Vault and Aura reward pool of the
     * pool BPT tokens.
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
            _abstractSetPToken(assetsMapped[i], platformAddress);
        }
        _approveBase();
    }

    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address) internal override {
        address poolAsset = _toPoolAsset(_asset);
        if (_asset == stETH) {
            // slither-disable-next-line unused-return
            IERC20(stETH).approve(wstETH, type(uint256).max);
        } else if (_asset == frxETH) {
            // slither-disable-next-line unused-return
            IERC20(frxETH).approve(sfrxETH, type(uint256).max);
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
        // slither-disable-next-line unused-return
        asset.approve(address(balancerVault), type(uint256).max);
    }

    /**
     * @notice Returns the rate supplied by the Balancer configured rate
     * provider. Rate is used to normalize the token to common underlying
     * pool denominator. (ETH for ETH Liquid staking derivatives)
     *
     * @param _asset Address of the Balancer pool asset
     * @return rate of the corresponding asset
     */
    function _getRateProviderRate(address _asset)
        internal
        view
        override
        returns (uint256)
    {
        IMetaStablePool pool = IMetaStablePool(platformAddress);
        IRateProvider[] memory providers = pool.getRateProviders();
        (IERC20[] memory tokens, , ) = balancerVault.getPoolTokens(
            balancerPoolId
        );

        uint256 providersLength = providers.length;
        for (uint256 i = 0; i < providersLength; ++i) {
            // _assets and corresponding rate providers are all in the same order
            if (address(tokens[i]) == _asset) {
                // rate provider doesn't exist, defaults to 1e18
                if (address(providers[i]) == address(0)) {
                    return 1e18;
                }
                return providers[i].getRate();
            }
        }

        // should never happen
        assert(false);
    }
}
