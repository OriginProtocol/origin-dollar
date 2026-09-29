// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BeaconProofsLib_Shared_Test} from "tests/unit/beacon/BeaconProofsLib/shared/Shared.t.sol";

contract Unit_Concrete_BeaconProofsLib_GloasViewFunctions_Test is Unit_BeaconProofsLib_Shared_Test {
    function test_gloasProgressiveChunkGindex_matchesLodestar() public view {
        assertEq(beaconProofs.gloasProgressiveChunkGindex(0), 2);
        assertEq(beaconProofs.gloasProgressiveChunkGindex(1), 24);
        assertEq(beaconProofs.gloasProgressiveChunkGindex(4), 27);
        assertEq(beaconProofs.gloasProgressiveChunkGindex(5), 224);
        assertEq(beaconProofs.gloasProgressiveChunkGindex(85), 15872);
        assertEq(beaconProofs.gloasProgressiveChunkGindex(250), 16037);
    }

    function test_gloasContainerGindices_matchLodestar() public view {
        assertEq(beaconProofs.gloasBalancesContainerGindex(), 2919);
        assertEq(beaconProofs.gloasPendingDepositsContainerGindex(), 23437);
    }

    function test_gloasValidatorGindices_matchLodestar() public view {
        assertEq(beaconProofs.gloasValidatorGindex(0), 11672);
        assertEq(beaconProofs.gloasValidatorFieldGindex(0, 0), 93376);
        assertEq(beaconProofs.gloasValidatorFieldGindex(0, 7), 93383);
        assertEq(beaconProofs.gloasValidatorFieldGindex(1, 0), 747072);
        assertEq(beaconProofs.gloasValidatorFieldGindex(100, 0), 382529656);
        assertEq(beaconProofs.gloasValidatorFieldGindex(1000, 0), 3060257944);
    }

    function test_gloasPendingDepositGindices_matchLodestar() public view {
        assertEq(beaconProofs.gloasPendingDepositGindex(0), 93748);
        assertEq(beaconProofs.gloasPendingDepositGindex(1), 749992);
        assertEq(beaconProofs.gloasPendingDepositGindex(100), 383999503);
    }
}
