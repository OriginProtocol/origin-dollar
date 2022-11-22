// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { VaultCore } from "../vault/VaultCore.sol";
import { OUSD } from "../token/OUSD.sol";

contract VaultValueChecker {
    struct Snapshot {
        uint256 vaultValue;
        uint256 totalSupply;
    }

    VaultCore public immutable vault;
    OUSD public immutable ousd;

    // By doing per user snapshots, we prevent a reentrancy attack
    // from a third party that updates the snapshot in the middle
    // of an allocation process
    mapping(address => Snapshot) public snapshots;

    constructor(address _vault, address _ousd) {
        vault = VaultCore(payable(_vault));
        ousd = OUSD(_ousd);
    }

    function takeSnapshot() external {
        snapshots[msg.sender] = Snapshot({
            vaultValue: vault.totalValue(),
            totalSupply: ousd.totalSupply()
        });
    }

    function checkDelta(
        int256 lowValueDelta,
        int256 highValueDelta,
        int256 lowSupplyDelta,
        int256 highSupplyDelta
    ) external {
        Snapshot memory snapshot = snapshots[msg.sender];
        int256 valueChange = toInt256(vault.totalValue()) -
            toInt256(snapshot.vaultValue);
        int256 supplyChange = toInt256(ousd.totalSupply()) -
            toInt256(snapshot.totalSupply);

        require(valueChange >= lowValueDelta, "Vault value too low");
        require(valueChange <= highValueDelta, "Vault value too high");
        require(supplyChange >= lowSupplyDelta, "OUSD supply too low");
        require(supplyChange <= highSupplyDelta, "OUSD supply too high");
    }

    function toInt256(uint256 value) internal pure returns (int256) {
        // From openzeppelin math/SafeCast.sol
        // Note: Unsafe cast below is okay because `type(int256).max` is guaranteed to be positive
        require(
            value <= uint256(type(int256).max),
            "SafeCast: value doesn't fit in an int256"
        );
        return int256(value);
    }
}
