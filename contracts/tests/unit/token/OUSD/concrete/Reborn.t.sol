// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";

import {Sanctum, Reborner} from "contracts/mocks/MockRebornMinter.sol";

contract Unit_Concrete_OUSD_Reborn_Test is Unit_OUSD_Shared_Test {
    Sanctum internal sanctum;
    bytes internal rebornerRuntimeCode;
    address internal rebornerAddress;

    function setUp() public override {
        super.setUp();

        sanctum = new Sanctum(address(usdc), address(ousdVault));
        sanctum.setOUSDAddress(address(ousd));
        rebornerRuntimeCode = address(new Reborner(address(sanctum))).code;
        rebornerAddress = makeAddr("Reborner");
        _dealUSDC(rebornerAddress, 4e6);

        vm.label(address(sanctum), "Sanctum");
        vm.label(rebornerAddress, "Reborner");
    }

    function test_rebornAccount_autoMigratesWithoutBreakingAccounting() public {
        _mintWhileAccountHasNoCode();

        assertEq(ousd.balanceOf(rebornerAddress), 1 ether);
        assertEq(uint256(ousd.rebaseState(rebornerAddress)), 0);
        assertEq(rebornerAddress.code.length, 0);

        _installRebornerCode();
        Reborner(rebornerAddress).mint();

        assertEq(ousd.balanceOf(rebornerAddress), 2 ether);
        assertEq(ousd.nonRebasingSupply(), 2 ether);
        assertEq(uint256(ousd.rebaseState(rebornerAddress)), 1);
        _assertSupplyInvariant();
    }

    function test_rebornAccount_preservesBalanceAcrossRecreation() public {
        _mintWhileAccountHasNoCode();

        uint256 balanceBefore = ousd.balanceOf(rebornerAddress);

        _installRebornerCode();

        assertEq(ousd.balanceOf(rebornerAddress), balanceBefore);
        _assertSupplyInvariant();
    }

    function test_rebornAccount_transferAfterRecreationPreservesAccounting() public {
        _mintWhileAccountHasNoCode();

        assertEq(ousd.balanceOf(rebornerAddress), 1 ether);
        assertEq(ousd.nonRebasingSupply(), 0);
        assertEq(rebornerAddress.code.length, 0);

        _installRebornerCode();
        Reborner(rebornerAddress).transfer();

        assertEq(ousd.balanceOf(rebornerAddress), 0);
        assertEq(ousd.balanceOf(address(1)), 1 ether);
        assertEq(ousd.nonRebasingSupply(), 0);

        Reborner(rebornerAddress).mint();

        assertEq(ousd.balanceOf(rebornerAddress), 1 ether);
        assertEq(ousd.nonRebasingSupply(), 1 ether);
        assertEq(uint256(ousd.rebaseState(rebornerAddress)), 1);
        _assertSupplyInvariant();
    }

    function _mintWhileAccountHasNoCode() internal {
        assertEq(rebornerAddress.code.length, 0);

        vm.startPrank(rebornerAddress);
        usdc.approve(address(ousdVault), 1e6);
        ousdVault.mint(1e6);
        vm.stopPrank();
    }

    function _installRebornerCode() internal {
        vm.etch(rebornerAddress, rebornerRuntimeCode);
        vm.store(rebornerAddress, bytes32(0), bytes32(uint256(uint160(address(sanctum)))));

        assertGt(rebornerAddress.code.length, 0);
    }
}
