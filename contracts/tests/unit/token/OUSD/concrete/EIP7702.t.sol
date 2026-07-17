// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";

contract Unit_Concrete_OUSD_EIP7702_Test is Unit_OUSD_Shared_Test {
    bytes internal constant DELEGATION_DESIGNATOR = hex"ef010063c0c19a282a1b52b07dd5a65b58948a07dae32b";

    function test_eip7702DelegationDesignator_isTreatedAsEOA() public {
        address eip7702User = makeAddr("EIP7702User");
        vm.etch(eip7702User, DELEGATION_DESIGNATOR);

        assertEq(eip7702User.code.length, 23);
        assertEq(bytes3(eip7702User.code), bytes3(hex"ef0100"));

        _mintOUSD(eip7702User, 3e6);

        vm.startPrank(eip7702User);
        ousd.transfer(address(mockNonRebasing), 1 ether);
        ousd.transfer(alice, 1 ether);
        vm.stopPrank();

        assertEq(uint256(ousd.rebaseState(eip7702User)), 0); // NotSet, same as an EOA
        assertEq(uint256(ousd.rebaseState(alice)), 0); // NotSet, same as an EOA
        assertEq(uint256(ousd.rebaseState(address(mockNonRebasing))), 1); // Contract still opts out
        assertEq(ousd.nonRebasingSupply(), 1 ether);

        uint256 eip7702BalanceBefore = ousd.balanceOf(eip7702User);
        uint256 aliceBalanceBefore = ousd.balanceOf(alice);
        uint256 contractBalanceBefore = ousd.balanceOf(address(mockNonRebasing));

        _rebase(10e6);

        assertGt(ousd.balanceOf(eip7702User), eip7702BalanceBefore);
        assertGt(ousd.balanceOf(alice), aliceBalanceBefore);
        assertEq(ousd.balanceOf(address(mockNonRebasing)), contractBalanceBefore);
        assertEq(ousd.nonRebasingSupply(), contractBalanceBefore);
        _assertSupplyInvariant();
    }
}
