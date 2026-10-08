// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { AbstractSafeModule } from "./AbstractSafeModule.sol";
import { IVault } from "../interfaces/IVault.sol";

/**
 * @title PermissionedRebaseModule
 * @notice Safe module that lets a permissioned operator drive a `rebase()`
 *         on vaults that are kept in the rebase-paused state. For each
 *         configured vault, the module calls (in order, via the Safe):
 *         `unpauseRebase()` -> `rebase()` -> `pauseRebase()`.
 *         If any sub-call fails, the whole transaction reverts so a vault
 *         can never be left unpaused by a partial run.
 */
contract PermissionedRebaseModule is AbstractSafeModule {
    mapping(address => bool) public isVaultWhitelisted;
    address[] public vaults;

    event VaultAdded(address vault);
    event VaultRemoved(address vault);
    event PermissionedRebaseExecuted(address vault);

    constructor(
        address _safeAddress,
        address _operator,
        address[] memory _vaults
    ) AbstractSafeModule(_safeAddress) {
        _grantRole(OPERATOR_ROLE, _operator);

        for (uint256 i = 0; i < _vaults.length; i++) {
            _addVault(_vaults[i]);
        }
    }

    /**
     * @notice For every whitelisted vault, sequentially call
     *         `unpauseRebase()`, `rebase()`, then `pauseRebase()` via the
     *         Safe. Reverts atomically on any sub-call failure.
     */
    function permissionedRebase() external onlyRole(OPERATOR_ROLE) {
        uint256 vaultsLength = vaults.length;
        for (uint256 i = 0; i < vaultsLength; i++) {
            address vault = vaults[i];
            _execOnVault(vault, IVault.unpauseRebase.selector);
            _execOnVault(vault, IVault.rebase.selector);
            _execOnVault(vault, IVault.pauseRebase.selector);
            emit PermissionedRebaseExecuted(vault);
        }
    }

    function _execOnVault(address vault, bytes4 selector) internal {
        bool success = safeContract.execTransactionFromModule(
            vault,
            0, // Value
            abi.encodeWithSelector(selector),
            0 // Call
        );
        require(success, "Vault call failed");
    }

    /**
     * @notice Add a vault to the whitelist. Only the Safe can call.
     */
    function addVault(address _vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _addVault(_vault);
    }

    function _addVault(address _vault) internal {
        require(_vault != address(0), "Vault is zero address");
        require(!isVaultWhitelisted[_vault], "Vault already whitelisted");
        isVaultWhitelisted[_vault] = true;
        vaults.push(_vault);
        emit VaultAdded(_vault);
    }

    /**
     * @notice Remove a vault from the whitelist. Only the Safe can call.
     */
    function removeVault(address _vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isVaultWhitelisted[_vault], "Vault not whitelisted");
        isVaultWhitelisted[_vault] = false;

        for (uint256 i = 0; i < vaults.length; i++) {
            if (vaults[i] == _vault) {
                vaults[i] = vaults[vaults.length - 1];
                vaults.pop();
                break;
            }
        }

        emit VaultRemoved(_vault);
    }
}
