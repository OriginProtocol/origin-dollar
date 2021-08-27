pragma solidity 0.5.11;

import { IVaultStorage } from "./IVaultStorage.sol";
import { IVaultAdmin } from "./IVaultAdmin.sol";
import { IVaultCore } from "./IVaultCore.sol";

interface IVault is IVaultStorage, IVaultAdmin, IVaultCore {}
