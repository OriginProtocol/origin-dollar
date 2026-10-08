// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IOUSD } from "../interfaces/IOUSD.sol";
import { IVault } from "../interfaces/IVault.sol";

contract VaultValueChecker {
    IVault public immutable vault;
    IOUSD public immutable ousd;
    // Snapshot expiration time in seconds.
    // Used to prevent accidental use of an old snapshot, but
    // is not zero to allow easy testing of strategist actions in fork testing
    uint256 constant SNAPSHOT_EXPIRES = 5 * 60;

    struct Snapshot {
        uint256 vaultValue;
        uint256 totalSupply;
        uint256 time;
    }
    // By doing per user snapshots, we prevent a reentrancy attack
    // from a third party that updates the snapshot in the middle
    // of an allocation process

    mapping(address => Snapshot) public snapshots;

    constructor(address _vault, address _ousd) {
        vault = IVault(_vault);
        ousd = IOUSD(_ousd);
    }

    function takeSnapshot() external {
        snapshots[msg.sender] = Snapshot({
            vaultValue: vault.totalValue(),
            totalSupply: ousd.totalSupply(),
            time: block.timestamp
        });
    }

    function checkDelta(
        int256 expectedProfit,
        int256 profitVariance,
        int256 expectedVaultChange,
        int256 vaultChangeVariance
    ) external {
        // Intentionaly not view so that this method shows up in TX builders
        Snapshot memory snapshot = snapshots[msg.sender];
        int256 vaultChange = toInt256(vault.totalValue()) -
            toInt256(snapshot.vaultValue);
        int256 supplyChange = toInt256(ousd.totalSupply()) -
            toInt256(snapshot.totalSupply);
        int256 profit = vaultChange - supplyChange;

        require(
            snapshot.time >= block.timestamp - SNAPSHOT_EXPIRES,
            "Snapshot too old"
        );
        require(snapshot.time <= block.timestamp, "Snapshot too new");
        require(profit >= expectedProfit - profitVariance, "Profit too low");
        require(profit <= expectedProfit + profitVariance, "Profit too high");
        require(
            vaultChange >= expectedVaultChange - vaultChangeVariance,
            "Vault value change too low"
        );
        require(
            vaultChange <= expectedVaultChange + vaultChangeVariance,
            "Vault value change too high"
        );
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

contract OETHVaultValueChecker is VaultValueChecker {
    constructor(address _vault, address _ousd)
        VaultValueChecker(_vault, _ousd)
    {}
}
