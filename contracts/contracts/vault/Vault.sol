// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD VaultInitializer Contract
 * @notice The VaultInitializer sets up the initial contract.
 * @author Origin Protocol Inc
 */
import { VaultInitializer } from "./VaultInitializer.sol";
import { VaultAdmin } from "./VaultAdmin.sol";

contract Vault is VaultInitializer, VaultAdmin {}
