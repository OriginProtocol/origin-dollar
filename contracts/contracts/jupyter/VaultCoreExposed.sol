// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title VaultCoreExposed contract
 * @notice Contract that exposes additional data points required by the Jupyter
 *         research notebook
 * @author Origin Protocol Inc
 */

import { VaultCore } from "../vault/VaultCore.sol";

contract VaultCoreExposed is VaultCore {
    function totalValueInVault() external view virtual returns (uint256 value) {
        return _totalValueInVault();
    }
}
