// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title OUSD Compound Strategy
 * @notice Investment strategy for investing stablecoins via Compound
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { BaseCompoundStrategy } from "./BaseCompoundStrategy.sol";
import { IERC20 } from "../utils/InitializableAbstractStrategy.sol";
import { IMorpho } from "../interfaces/morpho/IMorpho.sol";


contract MorphoCompoundStrategy is BaseCompoundStrategy {
    address public constant MORPHO = 0x8888882f8f843896699869179fB6E4f7e3B58888;
    using SafeERC20 for IERC20;
    event SkippedWithdrawal(address asset, uint256 amount);

    /**
     * @dev Internal initialize function, to set up initial internal state
     * @param _vaultAddress Address of the Vault
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address _vaultAddress,
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external onlyGovernor initializer {
        super._initialize(
            MORPHO,
            _vaultAddress,
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }

    /**
     * @dev Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external override {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = assetsMapped[i];

            // Safe approval
            IERC20(asset).safeApprove(MORPHO, 0);
            IERC20(asset).safeApprove(MORPHO, type(uint256).max);
        }
    }

    /**
     * @dev Collect accumulated rewards and send to Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        
    }

    /**
     * @dev Deposit asset into Morpho
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
     * @dev Deposit asset into Morpho
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");

        IMorpho(MORPHO).supply(
            address(_getCTokenFor(_asset)),
            address(this), // the address of the user you want to supply on behalf of
            _amount
        );
        emit Deposit(_asset, address(0), _amount);
    }

    /**
     * @dev Deposit the entire balance of any supported asset into Compound
     */
    function depositAll() external override onlyVault nonReentrant {
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
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {

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
        override
        returns (uint256 balance)
    {
        return 0;
    }
}
