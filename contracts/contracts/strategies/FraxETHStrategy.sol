// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title OETH FraxETH Strategy
 * @notice Investment strategy for investing ETH via staking frxETH
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";

contract FraxETHStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;

    /**
     * @dev Deposit asset into Compound
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        //_deposit(_asset, _amount);
    }

    /**
     * @dev Deposit asset into Compound
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        // require(_amount > 0, "Must deposit something");
        // IERC20 cToken = _getCTokenFor(_asset);
        // emit Deposit(_asset, address(cToken), _amount);
        // require(cToken.mint(_amount) == 0, "cToken mint failed");
    }

    /**
     * @dev Deposit the entire balance of any supported asset into Compound
     */
    function depositAll() external override onlyVault nonReentrant {
        // for (uint256 i = 0; i < assetsMapped.length; i++) {
        //     uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
        //     if (balance > 0) {
        //         _deposit(assetsMapped[i], balance);
        //     }
        // }
    }

    /**
     * @dev Withdraw asset from Compound
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        // require(_amount > 0, "Must withdraw something");
        // require(_recipient != address(0), "Must specify recipient");
        // IERC20 cToken = _getCTokenFor(_asset);
        // // If redeeming 0 cTokens, just skip, else COMP will revert
        // uint256 cTokensToRedeem = _convertUnderlyingToCToken(cToken, _amount);
        // if (cTokensToRedeem == 0) {
        //     emit SkippedWithdrawal(_asset, _amount);
        //     return;
        // }
        // emit Withdrawal(_asset, address(cToken), _amount);
        // require(cToken.redeemUnderlying(_amount) == 0, "Redeem failed");
        // IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Internal method to respond to the addition of new asset / cTokens
     *      We need to approve the cToken and give it permission to spend the asset
     * @param _asset Address of the asset to approve
     * @param _pToken The pToken for the approval
     */
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        // Safe approval
        // IERC20(_asset).safeApprove(_pToken, 0);
        // IERC20(_asset).safeApprove(_pToken, type(uint256).max);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        // for (uint256 i = 0; i < assetsMapped.length; i++) {
        //     // Redeem entire balance of cToken
        //     IERC20 cToken = _getCTokenFor(assetsMapped[i]);
        //     if (cToken.balanceOf(address(this)) > 0) {
        //         require(
        //             cToken.redeem(cToken.balanceOf(address(this))) == 0,
        //             "Redeem failed"
        //         );
        //         // Transfer entire balance to Vault
        //         IERC20 asset = IERC20(assetsMapped[i]);
        //         asset.safeTransfer(
        //             vaultAddress,
        //             asset.balanceOf(address(this))
        //         );
        //     }
        // }
    }

    /**
     * @dev Get the total asset value held in the platform
     *      This includes any interest that was generated since depositing
     *      Compound exchange rate between the cToken and asset gradually increases,
     *      causing the cToken to be worth more corresponding asset.
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        // Balance is always with token cToken decimals
        // IERC20 cToken = _getCTokenFor(_asset);
        // balance = _checkBalance(cToken);
    }

    /**
     * @dev Get the total asset value held in the platform
     *      underlying = (cTokenAmt * exchangeRate) / 1e18
     * @param _cToken     cToken for which to check balance
     * @return balance    Total value of the asset in the platform
     */
    function _checkBalance(IERC20 _cToken)
        internal
        view
        returns (uint256 balance)
    {
        // e.g. 50e8*205316390724364402565641705 / 1e18 = 1.0265..e18
        // balance =
        //     (_cToken.balanceOf(address(this)) * _cToken.exchangeRateStored()) /
        //     1e18;
    }

    /**
     * @dev Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external override {
        // uint256 assetCount = assetsMapped.length;
        // for (uint256 i = 0; i < assetCount; i++) {
        //     address asset = assetsMapped[i];
        //     address cToken = assetToPToken[asset];
        //     // Safe approval
        //     IERC20(asset).safeApprove(cToken, 0);
        //     IERC20(asset).safeApprove(cToken, type(uint256).max);
        // }
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
        //return assetToPToken[_asset] != address(0);
        return true;
    }
}
