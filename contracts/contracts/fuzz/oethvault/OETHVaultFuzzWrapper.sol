// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {OETHVault} from "../../vault/OETHVault.sol";
import {OETHVaultCore} from "../../vault/OETHVaultCore.sol";

/**
 * @title OETH Vault Fuzz Wrapper Contract
 * @author Rappie <rappie@perimetersec.io>
 * @dev This contract is used to simplify deployment of the Vault and
 * prevent the use of proxies.
 */
contract OETHVaultFuzzWrapper is OETHVault, OETHVaultCore {
    constructor(address _weth) OETHVaultCore(_weth) {}
}
