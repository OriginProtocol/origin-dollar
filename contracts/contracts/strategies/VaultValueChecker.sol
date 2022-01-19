// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { VaultCore } from "../vault/VaultCore.sol";

contract VaultValueChecker {
    uint256 public snapshotValue;
    VaultCore public vault;

    constructor(address _vault) {
        vault = VaultCore(payable(_vault));
    }

    function takeSnapshot() external {
        snapshotValue = vault.totalValue();
    }

    function checkLoss(int256 maxLoss) external {
        uint256 currentValue = vault.totalValue();
        int256 actualLoss = int256(snapshotValue) - int256(currentValue);
        require(actualLoss < maxLoss, "Max loss exceeded");
    }
}
