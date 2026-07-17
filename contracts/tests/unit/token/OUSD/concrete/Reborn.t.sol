// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";

import {Sanctum, Reborner} from "contracts/mocks/MockRebornMinter.sol";

contract Unit_Concrete_OUSD_Reborn_Test is Unit_OUSD_Shared_Test {
    uint256 internal constant SALT = 12_345;

    Sanctum internal sanctum;
    bytes internal rebornerCreationCode;
    address internal rebornerAddress;

    function setUp() public override {
        super.setUp();

        sanctum = new Sanctum(address(usdc), address(ousdVault));
        sanctum.setOUSDAddress(address(ousd));
        rebornerCreationCode = abi.encodePacked(type(Reborner).creationCode, abi.encode(address(sanctum)));
        rebornerAddress = sanctum.computeAddress(SALT, rebornerCreationCode);
        _dealUSDC(rebornerAddress, 4e6);

        vm.label(address(sanctum), "Sanctum");
        vm.label(rebornerAddress, "Reborner");
    }

    function test_rebornAccount_autoMigratesWithoutBreakingAccounting() public {
        sanctum.setShouldAttack(true);
        sanctum.setShouldDesctruct(true);
        sanctum.deploy(SALT, rebornerCreationCode);

        assertEq(ousd.balanceOf(rebornerAddress), 1 ether);
        assertEq(uint256(ousd.rebaseState(rebornerAddress)), 0);
        assertEq(rebornerAddress.code.length, 0);

        sanctum.setShouldAttack(false);
        sanctum.setShouldDesctruct(false);
        sanctum.deploy(SALT, rebornerCreationCode);

        Reborner(rebornerAddress).mint();

        assertEq(ousd.balanceOf(rebornerAddress), 2 ether);
        assertEq(ousd.nonRebasingSupply(), 2 ether);
        assertEq(uint256(ousd.rebaseState(rebornerAddress)), 1);
        _assertSupplyInvariant();
    }

    function test_rebornAccount_preservesBalanceAcrossRecreation() public {
        sanctum.setShouldAttack(true);
        sanctum.setShouldDesctruct(true);
        sanctum.deploy(SALT, rebornerCreationCode);

        uint256 balanceBefore = ousd.balanceOf(rebornerAddress);

        sanctum.setShouldAttack(false);
        sanctum.setShouldDesctruct(false);
        sanctum.deploy(SALT, rebornerCreationCode);

        assertEq(ousd.balanceOf(rebornerAddress), balanceBefore);
        _assertSupplyInvariant();
    }

    function test_rebornAccount_transferAfterRecreationPreservesAccounting() public {
        sanctum.setShouldAttack(true);
        sanctum.setShouldDesctruct(true);
        sanctum.deploy(SALT, rebornerCreationCode);

        assertEq(ousd.balanceOf(rebornerAddress), 1 ether);
        assertEq(ousd.nonRebasingSupply(), 0);
        assertEq(rebornerAddress.code.length, 0);

        sanctum.setShouldAttack(false);
        sanctum.setShouldDesctruct(false);
        sanctum.deploy(SALT, rebornerCreationCode);

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
}
