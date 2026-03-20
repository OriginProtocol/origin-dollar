// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { VaultCore } from "../vault/VaultCore.sol";

contract MockVaultCoreInstantRebase is VaultCore {
    constructor(address _asset) VaultCore(_asset) {}

    function _nextYield(uint256 supply, uint256 vaultValue)
        internal
        view
        override
        returns (uint256 yield, uint256 targetRate)
    {
        if (vaultValue <= supply) {
            return (0, 0);
        }
        yield = vaultValue - supply;
        return (yield, 0);
    }
}
