// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title OETH FraxETH Strategy
 * @notice Investment strategy for investing ETH via staking frxETH
 * @author Origin Protocol Inc
 */
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";

contract FraxETHStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;

    IERC20 sfrxETH;
    IERC20 frxETH;

    /**
     * @dev Deposit frxEth by staking it as sfrxETH
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit frxEth by staking it as sfrxETH
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");
        require(_asset == address(frxETH), "Asset it not frxETH");

        IERC4626(platformAddress).deposit(_amount, address(this));
        emit Deposit(_asset, address(frxETH), _amount);
    }

    /**
     * @dev Deposit the entire balance of frxETH to sfrxETH
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 balance = frxETH.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(frxETH), balance);
        }
    }

    /**
     * @dev Withdraw frxETH from sfrxETH
     * @param _recipient Address to receive withdrawn frxETH
     * @param _asset Address of frxETH to withdraw
     * @param _amount Amount of frxETH to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");
        require(_asset == address(frxETH), "Asset it not frxETH");

        IERC4626(platformAddress).withdraw(_amount, _recipient, address(this));
        emit Withdrawal(_asset, address(sfrxETH), _amount);
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
        sfrxETH = IERC20(_pToken);
        frxETH = IERC20(_asset);

        // Safe approval
        sfrxETH.safeApprove(platformAddress, type(uint256).max);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 sfrxEthBalance = sfrxETH.balanceOf(address(this));
        uint256 assetAmount = IERC4626(platformAddress).redeem(
            sfrxEthBalance,
            vaultAddress,
            address(this)
        );
        emit Withdrawal(address(frxETH), address(sfrxETH), assetAmount);
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the frxETH
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        require(_asset == address(frxETH), "Asset it not frxETH");
        return IERC4626(platformAddress).totalAssets();
    }

    /**
     * @dev Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external override {
        sfrxETH.safeApprove(platformAddress, type(uint256).max);
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
        return _asset == address(frxETH);
    }
}
