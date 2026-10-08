// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAbstractSafeModule } from "contracts/interfaces/automation/IAbstractSafeModule.sol";

interface IPermissionedRebaseModule is IAbstractSafeModule {
    event VaultAdded(address vault);
    event VaultRemoved(address vault);
    event PermissionedRebaseExecuted(address vault);

    function isVaultWhitelisted(address vault) external view returns (bool);

    function vaults(uint256 index) external view returns (address);

    function permissionedRebase() external;

    function addVault(address _vault) external;

    function removeVault(address _vault) external;
}
