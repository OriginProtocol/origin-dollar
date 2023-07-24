// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Base Balancer Abstract Strategy
 * @author Origin Protocol Inc
 */
import { BaseBalancerStrategy } from "./BaseBalancerStrategy.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "../../utils/InitializableAbstractStrategy.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { StableMath } from "../../utils/StableMath.sol";
import { IRewardStaking } from "../IRewardStaking.sol";

import "hardhat/console.sol";

abstract contract BaseAuraStrategy is BaseBalancerStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    address internal auraRewardPoolAddress;
    address internal auraRewardStakerAddress;
    uint256 internal auraDepositorPTokenId;
    // renamed from __reserved to not shadow BaseBalancerStrategy.__reserved,
    int256[50] private __reserved_2;

    struct InitConfig {
        address platformAddress; // platformAddress Address of the Balancer's pool
        address vaultAddress; // vaultAddress Address of the vault
        address auraRewardPoolAddress; // auraRewardPoolAddress Address of the Aura rewards pool
        address auraRewardStakerAddress; // auraRewardStakerAddress Address of the Aura rewards staker
        uint256 auraDepositorPTokenId; // auraDepositorPTokenId Address of the Aura rewards staker
        bytes32 balancerPoolId; // balancerPoolId bytes32 poolId
    }

    /**
     * Initializer for setting up strategy internal state. This overrides the
     * InitializableAbstractStrategy initializer as Balancer's strategies don't fit
     * well within that abstraction.
     * @param _rewardTokenAddresses Address of BAL & AURA
     * @param _assets Addresses of supported assets. MUST be passed in the same
     *                order as returned by coins on the pool contract, i.e.
     *                WETH, stETH
     * @param _pTokens Platform Token corresponding addresses
     * @param initConfig additional configuration
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // BAL & AURA
        address[] calldata _assets,
        address[] calldata _pTokens,
        InitConfig calldata initConfig
    ) external onlyGovernor initializer {
        auraRewardPoolAddress = initConfig.auraRewardPoolAddress;
        auraRewardStakerAddress = initConfig.auraRewardStakerAddress;
        auraDepositorPTokenId = initConfig.auraDepositorPTokenId;
        pTokenAddress = _pTokens[0];
        maxWithdrawalSlippage = 1e15;
        maxDepositSlippage = 1e15;
        balancerPoolId = initConfig.balancerPoolId;
        IERC20[] memory poolAssets = getPoolAssets();
        uint256 assetsLength = _assets.length;
        require(
            poolAssets.length == assetsLength,
            "Pool assets and _assets should be the same length."
        );
        for (uint256 i = 0; i < assetsLength; ++i) {
            (address asset, ) = fromPoolAsset(address(poolAssets[i]), 0);
            require(
                _assets[i] == asset,
                "Pool assets and _assets should all have the same numerical order."
            );
            poolAssetsMapped.push(address(poolAssets[i]));
        }

        super._initialize(
            initConfig.platformAddress,
            initConfig.vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
        _approveBase();
    }

    function _lpDepositAll() internal virtual override {
        uint256 bptBalance = IERC20(platformAddress).balanceOf(address(this));
        IERC4626(auraRewardPoolAddress).deposit(bptBalance, address(this));
    }

    function _lpWithdraw(uint256 numBPTTokens) internal virtual override {
        IRewardStaking(auraRewardPoolAddress).withdrawAndUnwrap(
            numBPTTokens,
            true // also claim reward tokens
        );
    }

    function _lpWithdrawAll() internal virtual override {
        uint256 bptBalance = IERC4626(auraRewardPoolAddress).balanceOf(
            address(this)
        );

        IRewardStaking(auraRewardPoolAddress).withdrawAndUnwrap(
            bptBalance,
            true // also claim reward tokens
        );
    }

    function collectRewardTokens()
        external
        virtual
        override
        onlyHarvester
        nonReentrant
    {
        // Collect CRV and CVX
        IRewardStaking(auraRewardPoolAddress).getReward();
        _collectRewardTokens();
    }

    function checkBalance(address _asset)
        external
        view
        virtual
        override
        returns (uint256)
    {
        (IERC20[] memory tokens, uint256[] memory balances, ) = balancerVault
            .getPoolTokens(balancerPoolId);
        // pool balance + aura balance
        uint256 bptBalance = IERC20(pTokenAddress).balanceOf(address(this)) +
            IERC4626(auraRewardPoolAddress).balanceOf(address(this));

        // yourPoolShare denominated in 1e18. (1e18 == 100%)
        uint256 yourPoolShare = bptBalance.divPrecisely(
            IERC20(pTokenAddress).totalSupply()
        );

        uint256 balancesLength = balances.length;
        for (uint256 i = 0; i < balancesLength; ++i) {
            (address poolAsset, ) = toPoolAsset(_asset, 0);
            if (address(tokens[i]) == poolAsset) {
                (, uint256 assetAmount) = fromPoolAsset(
                    poolAsset,
                    balances[i].mulTruncate(yourPoolShare)
                );
                return assetAmount;
            }
        }
    }

    function _approveBase() internal virtual override {
        super._approveBase();

        IERC20 pToken = IERC20(pTokenAddress);
        // Gauge for LP token
        pToken.safeApprove(auraRewardPoolAddress, 0);
        pToken.safeApprove(auraRewardPoolAddress, type(uint256).max);
    }
}
