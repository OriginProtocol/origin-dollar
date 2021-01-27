pragma solidity 0.5.11;

/**
 * @title OUSD Compound Strategy
 * @notice Investment strategy for investing stablecoins via Compound
 * @author Origin Protocol Inc
 */
import { ICERC20 } from "./ICompound.sol";
import { IComptroller } from "../interfaces/IComptroller.sol";
import {
    IERC20,
    InitializableAbstractStrategy
} from "../utils/InitializableAbstractStrategy.sol";

contract CompoundStrategy is InitializableAbstractStrategy {
    event SkippedWithdrawal(address asset, uint256 amount);

    /**
     * @dev Collect accumulated COMP and send to Vault.
     */
    function collectRewardToken() external onlyVault nonReentrant {
        // Claim COMP from Comptroller
        ICERC20 cToken = _getCTokenFor(assetsMapped[0]);
        IComptroller comptroller = IComptroller(cToken.comptroller());
        comptroller.claimComp(address(this));
        // Transfer COMP to Vault
        IERC20 rewardToken = IERC20(rewardTokenAddress);
        uint256 balance = rewardToken.balanceOf(address(this));
        emit RewardTokenCollected(vaultAddress, balance);
        rewardToken.safeTransfer(vaultAddress, balance);
    }

    /**
     * @dev Deposit asset into Compound
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     * @return amountDeposited Amount of asset that was deposited
     */
    function deposit(address _asset, uint256 _amount)
        external
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit asset into Compound
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     * @return amountDeposited Amount of asset that was deposited
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");
        ICERC20 cToken = _getCTokenFor(_asset);
        emit Deposit(_asset, address(cToken), _amount);
        require(cToken.mint(_amount) == 0, "cToken mint failed");
    }

    /**
     * @dev Deposit the entire balance of any supported asset into Compound
     */
    function depositAll() external onlyVault nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
            if (balance > 0) {
                _deposit(assetsMapped[i], balance);
            }
        }
    }

    /**
     * @dev Withdraw asset from Compound
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     * @return amountWithdrawn Amount of asset that was withdrawn
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        ICERC20 cToken = _getCTokenFor(_asset);
        // If redeeming 0 cTokens, just skip, else COMP will revert
        uint256 cTokensToRedeem = _convertUnderlyingToCToken(cToken, _amount);
        if (cTokensToRedeem == 0) {
            emit SkippedWithdrawal(_asset, _amount);
            return;
        }

        emit Withdrawal(_asset, address(cToken), _amount);
        require(cToken.redeemUnderlying(_amount) == 0, "Redeem failed");
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external onlyVaultOrGovernor nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            // Redeem entire balance of cToken
            ICERC20 cToken = _getCTokenFor(assetsMapped[i]);
            if (cToken.balanceOf(address(this)) > 0) {
                require(
                    cToken.redeem(cToken.balanceOf(address(this))) == 0,
                    "Redeem failed"
                );
                // Transfer entire balance to Vault
                IERC20 asset = IERC20(assetsMapped[i]);
                asset.safeTransfer(
                    vaultAddress,
                    asset.balanceOf(address(this))
                );
            }
        }
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
        returns (uint256 balance)
    {
        // Balance is always with token cToken decimals
        ICERC20 cToken = _getCTokenFor(_asset);
        balance = _checkBalance(cToken);
    }

    /**
     * @dev Get the total asset value held in the platform
     *      underlying = (cTokenAmt * exchangeRate) / 1e18
     * @param _cToken     cToken for which to check balance
     * @return balance    Total value of the asset in the platform
     */
    function _checkBalance(ICERC20 _cToken)
        internal
        view
        returns (uint256 balance)
    {
        uint256 cTokenBalance = _cToken.balanceOf(address(this));
        uint256 exchangeRate = _cToken.exchangeRateStored();
        // e.g. 50e8*205316390724364402565641705 / 1e18 = 1.0265..e18
        balance = cTokenBalance.mul(exchangeRate).div(1e18);
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) external view returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    /**
     * @dev Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = assetsMapped[i];
            address cToken = assetToPToken[asset];
            // Safe approval
            IERC20(asset).safeApprove(cToken, 0);
            IERC20(asset).safeApprove(cToken, uint256(-1));
        }
    }

    /**
     * @dev Internal method to respond to the addition of new asset / cTokens
     *      We need to approve the cToken and give it permission to spend the asset
     * @param _asset Address of the asset to approve
     * @param _cToken This cToken has the approval approval
     */
    function _abstractSetPToken(address _asset, address _cToken) internal {
        // Safe approval
        IERC20(_asset).safeApprove(_cToken, 0);
        IERC20(_asset).safeApprove(_cToken, uint256(-1));
    }

    /**
     * @dev Get the cToken wrapped in the ICERC20 interface for this asset.
     *      Fails if the pToken doesn't exist in our mappings.
     * @param _asset Address of the asset
     * @return Corresponding cToken to this asset
     */
    function _getCTokenFor(address _asset) internal view returns (ICERC20) {
        address cToken = assetToPToken[_asset];
        require(cToken != address(0), "cToken does not exist");
        return ICERC20(cToken);
    }

    /**
     * @dev Converts an underlying amount into cToken amount
     *      cTokenAmt = (underlying * 1e18) / exchangeRate
     * @param _cToken     cToken for which to change
     * @param _underlying Amount of underlying to convert
     * @return amount     Equivalent amount of cTokens
     */
    function _convertUnderlyingToCToken(ICERC20 _cToken, uint256 _underlying)
        internal
        view
        returns (uint256 amount)
    {
        uint256 exchangeRate = _cToken.exchangeRateStored();
        // e.g. 1e18*1e18 / 205316390724364402565641705 = 50e8
        // e.g. 1e8*1e18 / 205316390724364402565641705 = 0.45 or 0
        amount = _underlying.mul(1e18).div(exchangeRate);
    }
}
