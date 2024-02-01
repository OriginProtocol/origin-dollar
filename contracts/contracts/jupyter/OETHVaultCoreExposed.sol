// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETHVaultCoreExposed contract
 * @notice Contract that exposes additional data points required by the Jupyter
 *         research notebook
 * @author Origin Protocol Inc
 */

import { OETHVaultCore } from "../vault/OETHVaultCore.sol";

contract OETHVaultCoreExposed is OETHVaultCore {
    function totalValueInVault() external view virtual returns (uint256 value) {
        return _totalValueInVault();
    }
}
