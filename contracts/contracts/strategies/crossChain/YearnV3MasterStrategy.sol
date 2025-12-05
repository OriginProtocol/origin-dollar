// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Yearn V3 Master Strategy - the Mainnet part
 * @author Origin Protocol Inc
 */

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";

contract YearnV3MasterStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;

    /**
     * @param _stratConfig The platform and OToken vault addresses
     */
    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

    /**
     * Initializer for setting up strategy internal state.
     * @param _rewardTokenAddresses Addresses of reward tokens
     * @param _assets Addresses of supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }

    /**
     * @dev Deposit asset into mainnet strategy making them ready to be 
     *      bridged to Slave part of the strategy
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        
        emit Deposit(_asset, _asset, _amount);
    }

    /**
     * @dev Bridge the assets prepared by a previous Deposit call to the 
     *      Slave part of the strategy
     * @param _amount Amount of asset to deposit
     * @param quote Quote to bridge the assets to the Slave part of the strategy
     */
    function depositWithQuote(uint256 _amount, bytes calldata quote)
        external
        onlyGovernorOrStrategist
        nonReentrant
    {
        
        // TODO: implement this
    }

    /**
     * @dev Deposit the entire balance
     */
    function depositAll() external override onlyVault nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
            if (balance > 0) {
                emit Deposit(assetsMapped[i], assetsMapped[i], balance);
            }
        }
    }

    /**
     * @dev Send a withdrawal Wormhole message requesting a certain withdrawal amount
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
        require(_recipient == vaultAddress, "Only Vault can withdraw");

        // Withdraw the funds from this strategy to the Vault once 
        // they are allready bridged here
    }

    /**
     * @dev Send a withdrawal Wormhole message requesting a certain withdrawal amount
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
     * @param quote Quote to bridge the assets to the Master part of the strategy
     */
    function withdrawWithQuote(
        address _recipient,
        address _asset,
        uint256 _amount,
        bytes calldata quote
    ) external onlyGovernorOrStrategist nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient == vaultAddress, "Only Vault can withdraw");
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        //
        // TODO: implement this
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        // USDC balance on this contract
        // + USDC being bridged
        // + USDC cached in the corresponding Slave part of this contract
    }

    /**
     * @dev Returns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    /**
     * @dev Approve the spending of all assets
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        
    }

    /**
     * @dev 
     * @param _asset Address of the asset to approve
     * @param _aToken Address of the aToken
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _aToken)
        internal
        override
    {
    }

    /**
     * @dev 
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        
    }
}
