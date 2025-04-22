// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IUSDT {
    // Tether's approve does not return a bool like standard IERC20 contracts
    // slither-disable-next-line erc20-interface
    function approve(address _spender, uint256 _value) external;
}

/**
 * @title Generalized 4626 Strategy when asset is Tether USD (USDT)
 * @notice Investment strategy for ERC-4626 Tokenized Vaults for the USDT asset.
 * @author Origin Protocol Inc
 */
import { Generalized4626Strategy } from "./Generalized4626Strategy.sol";

contract Generalized4626USDTStrategy is Generalized4626Strategy {
    /**
     * @param _baseConfig Base strategy config with platformAddress (ERC-4626 Vault contract), eg sfrxETH or sDAI,
     * and vaultAddress (OToken Vault contract), eg VaultProxy or OETHVaultProxy
     * @param _assetToken Address of the ERC-4626 asset token. eg frxETH or DAI
     */
    constructor(BaseStrategyConfig memory _baseConfig, address _assetToken)
        Generalized4626Strategy(_baseConfig, _assetToken)
    {}

    /// @dev Override for Tether as USDT does not return a bool on approve.
    /// Using assetToken.approve will fail as it expects a bool return value
    function _approveBase() internal virtual override {
        // Approval the asset to be transferred to the ERC-4626 Tokenized Vault.
        // Used by the ERC-4626 deposit() and mint() functions
        // slither-disable-next-line unused-return
        IUSDT(address(assetToken)).approve(platformAddress, type(uint256).max);
    }
}
