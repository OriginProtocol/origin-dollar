// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Generalized 4626 Strategy
 * @notice Investment strategy for vaults supporting ERC4626
 * @author Origin Protocol Inc
 */
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";

contract Generalized4626Strategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;

    IERC20 internal shareToken;
    IERC20 internal assetToken;

    // For future use
    uint256[50] private __gap;

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

    /**
     * @dev Deposit assets by converting them to shares
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
     * @dev Deposit assets by converting them to shares
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal virtual {
        require(_amount > 0, "Must deposit something");
        require(_asset == address(assetToken), "Unexpected asset address");

        // slither-disable-next-line unused-return
        IERC4626(platformAddress).deposit(_amount, address(this));
        emit Deposit(_asset, address(shareToken), _amount);
    }

    /**
     * @dev Deposit the entire balance of assetToken to gain shareToken
     */
    function depositAll() external virtual override onlyVault nonReentrant {
        uint256 balance = assetToken.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(assetToken), balance);
        }
    }

    /**
     * @dev Withdraw asset by burning shares
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external virtual override onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");
        require(_asset == address(assetToken), "Unexpected asset address");

        // slither-disable-next-line unused-return
        IERC4626(platformAddress).withdraw(_amount, _recipient, address(this));
        emit Withdrawal(_asset, address(shareToken), _amount);
    }

    /**
     * @dev Internal method to respond to the addition of new asset / share tokens
     * @param _asset Address of the asset to approve
     * @param _pToken The pToken for the approval
     */
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        virtual
        override
    {
        shareToken = IERC20(_pToken);
        assetToken = IERC20(_asset);

        // Safe approval
        shareToken.safeApprove(platformAddress, type(uint256).max);
        assetToken.safeApprove(platformAddress, type(uint256).max);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll()
        external
        virtual
        override
        onlyVaultOrGovernor
        nonReentrant
    {
        uint256 shareBalance = shareToken.balanceOf(address(this));
        uint256 assetAmount = IERC4626(platformAddress).redeem(
            shareBalance,
            vaultAddress,
            address(this)
        );
        emit Withdrawal(address(assetToken), address(shareToken), assetAmount);
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        virtual
        override
        returns (uint256 balance)
    {
        require(_asset == address(assetToken), "Unexpected asset address");
        /* We are intentionally not counting the amount of assetToken parked on the
         * contract toward the checkBalance. The deposit and withdraw functions
         * should not result in assetToken being unused and owned by this strategy
         * contract.
         */
        return IERC4626(platformAddress).maxWithdraw(address(this));
    }

    /**
     * @dev Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external override {
        assetToken.safeApprove(platformAddress, type(uint256).max);
        shareToken.safeApprove(platformAddress, type(uint256).max);
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        external
        view
        virtual
        override
        returns (bool)
    {
        return _asset == address(assetToken);
    }
}
