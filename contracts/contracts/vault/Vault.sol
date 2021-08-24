pragma solidity 0.5.11;

/**
 * @title OUSD VaultInitializer Contract
 * @notice The VaultInitializer sets up the initial contract.
 * @author Origin Protocol Inc
 */
import { VaultInitializer } from "./VaultInitializer.sol";
import { VaultAdmin } from "./VaultAdmin.sol";
import { IVault } from "../interfaces/IVault.sol";

contract Vault is IVault, VaultInitializer, VaultAdmin {}
