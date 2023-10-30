// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Convex Automated Market Maker (AMO) Strategy
 * @notice AMO strategy for the Balancer OETH/WETH pool
 * @author Origin Protocol Inc
 */
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { BaseBalancerAMOStrategy } from "./BaseBalancerAMOStrategy.sol";
import { VaultReentrancyLib } from "../balancer/VaultReentrancyLib.sol";
import { IRateProvider } from "../../interfaces/balancer/IRateProvider.sol";
import { IERC4626 } from "../../../lib/openzeppelin/interfaces/IERC4626.sol";
import { StableMath } from "../../utils/StableMath.sol";

contract BalancerEthAMOStrategy is BaseBalancerAMOStrategy {
    using StableMath for uint256;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        AMOConfig memory _amoConfig,
        BalancerConfig memory _balancerConfig
    ) BaseBalancerAMOStrategy(_baseConfig, _amoConfig, _balancerConfig) {}

    /***************************************
        Vault to Pool Asset Conversions
    ****************************************/

    /// @dev WETH is the Vault asset and the Balancer pool asset so
    /// nothing to except return the vault asset amount
    function _toPoolAsset(address, uint256 assets)
        internal
        pure
        override
        returns (uint256 poolAssets)
    {
        poolAssets = assets;
    }

    function _calcPoolAsset(address, uint256 vaultAssetAmount)
        internal
        pure
        override
        returns (uint256 poolAssetAmount)
    {
        poolAssetAmount = vaultAssetAmount;
    }

    /// @dev WETH is the Vault asset and the pool asset so return the WETH amount
    /// @param poolAssetAmount Amount of WETH to convert to OETH
    /// @param oTokenAmount Amount of OETH converted from WETH
    function _toOTokens(uint256 poolAssetAmount)
        internal
        pure
        override
        returns (uint256 oTokenAmount)
    {
        oTokenAmount = poolAssetAmount;
    }

    /***************************************
            Curve Pool Withdrawals
    ****************************************/

    /// @dev transfers the specified WETH amount to the recipient
    function _withdrawAsset(
        address,
        uint256 vaultAssetAmount,
        address _recipient
    ) internal override {
        // Transfer the WETH to the Vault
        require(
            asset.transfer(_recipient, vaultAssetAmount),
            "WETH transfer failed"
        );

        emit Withdrawal(address(asset), address(lpToken), vaultAssetAmount);
    }

    /// @dev transfers the EETH balance of this strategy contract to the recipient
    function _withdrawAllAsset(address _recipient) internal override {
        uint256 vaultAssets = asset.balanceOf(address(this));

        _withdrawAsset(address(asset), vaultAssets, _recipient);
    }

    /***************************************
                Asset Balance
    ****************************************/

    /**
     * @notice Get strategy's share of an assets in the Balancer pool.
     * This is not denominated in OUSD/ETH value of the assets in the Balancer pool.
     * @param _asset  Address of the Vault asset. eg WETH
     * @return balance  the amount of vault assets
     *
     * IMPORTANT if this function is overridden it needs to do a call to:
     *  - VaultReentrancyLib.ensureNotInVaultContext(balancerVault);
     * to prevent a read only re-entrancy vulnerability.
     *
     * @dev it is important that this function is not affected by reporting inflated
     * values of assets in case of any pool manipulation. Such a manipulation could easily
     * exploit the protocol by:
     *  - minting OETH
     *  - tilting Balancer pool to report higher balances of assets
     *  - rebasing() -> all that extra token balances get distributed to OETH holders
     *  - tilting pool back
     *  - redeeming OETH
     */
    function checkBalance(address _asset)
        public
        view
        override
        returns (uint256 balance)
    {
        /**
         * @dev Ensure we are not in a Vault context when this function is called, by attempting a no-op internal
         * balance operation. If we are already in a Vault transaction (e.g., a swap, join, or exit), the Vault's
         * reentrancy protection will cause this function to revert.
         *
         * Use this with any function that can cause a state change in a pool and is either public itself,
         * or called by a public function *outside* a Vault operation (e.g., join, exit, or swap).
         *
         * This is to protect against Balancer's read-only re-entrancy vulnerability:
         * https://www.notion.so/originprotocol/Balancer-read-only-reentrancy-c686e72c82414ef18fa34312bb02e11b
         */
        VaultReentrancyLib.ensureNotInVaultContext(balancerVault);
        require(_asset == address(asset), "Unsupported asset");

        uint256 bptBalance = IERC4626(auraRewardPool).maxRedeem(address(this));

        if (bptBalance > 0) {
            balance = (bptBalance.mulTruncate(
                IRateProvider(address(lpToken)).getRate()
            ) / 2);
        }
    }

    /***************************************
                    Approvals
    ****************************************/

    /// @dev Is not used
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}
}
