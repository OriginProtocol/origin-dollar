pragma solidity 0.5.11;

import {
    IERC20,
    InitializableAbstractStrategy
} from "../../contracts/contracts/utils/InitializableAbstractStrategy.sol";
import "./IPToken.sol";
import "./DummyERC20Impl.sol";

contract SimpleStrategy is InitializableAbstractStrategy {

    function collectRewardToken() external onlyVault nonReentrant {
        IERC20 rewardToken = IERC20(rewardTokenAddress);
        uint256 balance = rewardToken.balanceOf(address(this));
        rewardToken.safeTransfer(vaultAddress, balance);
    }

    function deposit(address _asset, uint256 _amount)
        public
        onlyVault
        nonReentrant
    {
        require(_amount > 0, "Must deposit something");
        IPToken pToken = _getPTokenFor(_asset);
        DummyERC20Impl(_asset).transfer(address(pToken), _amount);
        pToken.mint(_amount);
    }

    /**
     * @dev Deposit the entire balance of any supported asset into Compound
     */
    function depositAll() external onlyVault nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
            if (balance > 0) {
                deposit(assetsMapped[i], balance);
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

        IPToken pToken = _getPTokenFor(_asset);
        DummyERC20Impl(_asset).transferFrom(address(pToken), address(this), _amount);
        pToken.burn(_amount);
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external onlyVaultOrGovernor nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            // Redeem entire balance of pToken
            IPToken pToken = _getPTokenFor(assetsMapped[i]);
            uint amt = pToken.balanceOf(address(this));
            if (amt > 0) {
                pToken.transfer(address(this), amt);
                pToken.burn(amt);
                
                // Transfer entire balance to Vault
                IERC20 asset = IERC20(assetsMapped[i]);
                asset.safeTransfer(
                    vaultAddress,
                    asset.balanceOf(address(this))
                );
            }
        }
    }

    function checkBalance(address _asset)
        public
        view
        returns (uint256 balance)
    {
        // Balance is always with token pToken decimals
        IPToken pToken = _getPTokenFor(_asset);
        uint256 pTokenBalance = pToken.balanceOf(address(this));
        balance = pTokenBalance;
    }

    function supportsAsset(address _asset) external view returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    function safeApproveAllTokens() external {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = assetsMapped[i];
            address pToken = assetToPToken[asset];
            // Safe approval
            IERC20(asset).safeApprove(pToken, 0);
            IERC20(asset).safeApprove(pToken, uint256(-1));
        }
    }

    function _abstractSetPToken(address _asset, address _pToken) internal {
        /*
        // Safe approval
        IERC20(_asset).safeApprove(_pToken, 0);
        IERC20(_asset).safeApprove(_pToken, uint256(-1));
        */
    }

    function _getPTokenFor(address _asset) internal view returns (IPToken) {
        address pToken = assetToPToken[_asset];
        require(pToken != address(0), "pToken does not exist");
        return IPToken(pToken);
    }
}
