// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_CompoundingStakingStrategy_Shared_Test
} from "tests/fork/mainnet/strategies/CompoundingStakingStrategy/shared/Shared.t.sol";

contract Fork_Concrete_CompoundingStakingStrategy_BalanceSnapshot_Test is Fork_CompoundingStakingStrategy_Shared_Test {
    function test_snapBalances_readsLiveBeaconRootAsArbitraryCaller() public {
        // Isolate the live EIP-4788 lookup from any snapshot made shortly before the fork block.
        vm.store(address(strategy), bytes32(SNAPPED_BALANCE_DATA_SLOT), bytes32(0));

        vm.prank(alice);
        strategy.snapBalances();

        (bytes32 blockRoot, uint64 timestamp, uint128 ethBalance) = strategy.snappedBalance();
        assertNotEq(blockRoot, bytes32(0), "beacon block root not snapped");
        assertEq(timestamp, block.timestamp, "wrong snapshot timestamp");
        assertEq(ethBalance, address(strategy).balance, "wrong strategy ETH balance");
    }
}
