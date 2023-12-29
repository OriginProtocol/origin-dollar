// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IVault } from "./IVault.sol";

interface IOETHVault is IVault {
    // VaultCore.sol
    function mint(
        uint256 _amount
    ) external;
}
