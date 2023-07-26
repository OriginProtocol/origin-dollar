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

abstract contract BaseAuraStrategy is BaseBalancerStrategy {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    address public immutable auraRewardPoolAddress;
    address public immutable auraRewardStakerAddress;
    uint256 public immutable auraDepositorPTokenId;

    // renamed from __reserved to not shadow BaseBalancerStrategy.__reserved,
    int256[50] private __reserved_2;

    struct AuraConfig {
        address auraRewardPoolAddress; // Address of the Aura rewards pool
        address auraRewardStakerAddress; // Address of the Aura rewards staker
        uint256 auraDepositorPTokenId; // The Aura rewards staker
    }

    constructor(AuraConfig memory _auraConfig) {
        auraRewardPoolAddress = _auraConfig.auraRewardPoolAddress;
        auraRewardStakerAddress = _auraConfig.auraRewardStakerAddress;
        auraDepositorPTokenId = _auraConfig.auraDepositorPTokenId;
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
     */
    function initialize(
        address[] calldata _rewardTokenAddresses, // BAL & AURA
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external override onlyGovernor initializer {
        maxWithdrawalSlippage = 1e15;
        maxDepositSlippage = 1e15;

        IERC20[] memory poolAssets = getPoolAssets();
        require(
            poolAssets.length == _assets.length,
            "Pool assets length mismatch"
        );
        for (uint256 i = 0; i < _assets.length; ++i) {
            (address asset, ) = fromPoolAsset(address(poolAssets[i]), 0);
            require(_assets[i] == asset, "Pool assets mismatch");
        }

        super._initialize(_rewardTokenAddresses, _assets, _pTokens);
        _approveBase();
    }

    /**
     * @dev Deposit all Balancer Pool Tokens (BPT) in this strategy contract
     * to the Aura rewards pool.
     */
    function _lpDepositAll() internal virtual override {
        uint256 bptBalance = IERC20(platformAddress).balanceOf(address(this));
        // slither-disable-next-line unused-return
        IERC4626(auraRewardPoolAddress).deposit(bptBalance, address(this));
    }

    /**
     * @dev Withdraw `numBPTTokens` Balancer Pool Tokens (BPT) from
     * the Aura rewards pool to this strategy contract.
     * @param numBPTTokens Number of Balancer Pool Tokens (BPT) to withdraw
     */
    function _lpWithdraw(uint256 numBPTTokens) internal virtual override {
        IRewardStaking(auraRewardPoolAddress).withdrawAndUnwrap(
            numBPTTokens,
            true // also claim reward tokens
        );
    }

    /**
     * @dev Withdraw all Balancer Pool Tokens (BPT) from
     * the Aura rewards pool to this strategy contract.
     */
    function _lpWithdrawAll() internal virtual override {
        uint256 bptBalance = IERC4626(auraRewardPoolAddress).balanceOf(
            address(this)
        );

        IRewardStaking(auraRewardPoolAddress).withdrawAndUnwrap(
            bptBalance,
            true // also claim reward tokens
        );
    }

    /**
     * @notice Collects BAL and AURA tokens from the rewards pool.
     */
    function collectRewardTokens()
        external
        virtual
        override
        onlyHarvester
        nonReentrant
    {
        // Collect BAL and AURA
        IRewardStaking(auraRewardPoolAddress).getReward();
        _collectRewardTokens();
    }

    /**
     * @notice Get the total asset value held in the Balancer pool
     * and the Aura rewards pool.
     * @param _asset  Address of the Vault collateral asset
     * @return value  Total value of the asset
     */
    function checkBalance(address _asset)
        external
        view
        virtual
        override
        returns (uint256 value)
    {
        // Get the total balance of each of the Balancer pool assets
        (IERC20[] memory tokens, uint256[] memory balances, ) = balancerVault
            .getPoolTokens(balancerPoolId);

        // Balancer Pool Tokens (BPT) in the Balancer pool and Aura rewards pool.
        uint256 bptBalance = IERC20(platformAddress).balanceOf(address(this)) +
            IERC4626(auraRewardPoolAddress).balanceOf(address(this));

        // The strategy's shares of the assets in the Balancer pool
        // denominated in 1e18. (1e18 == 100%)
        uint256 strategyShare = bptBalance.divPrecisely(
            IERC20(platformAddress).totalSupply()
        );

        for (uint256 i = 0; i < balances.length; ++i) {
            address poolAsset = toPoolAsset(_asset);
            if (address(tokens[i]) == poolAsset) {
                // convert Balancer pool asset value to Vault asset value
                (, value) = fromPoolAsset(
                    poolAsset,
                    balances[i].mulTruncate(strategyShare)
                );
                return value;
            }
        }
    }

    function _approveBase() internal virtual override {
        super._approveBase();

        IERC20 pToken = IERC20(platformAddress);
        pToken.safeApprove(auraRewardPoolAddress, 0);
        pToken.safeApprove(auraRewardPoolAddress, type(uint256).max);
    }
}
