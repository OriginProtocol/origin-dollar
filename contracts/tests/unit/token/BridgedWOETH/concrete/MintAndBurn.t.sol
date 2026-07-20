// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BridgedWOETH_Shared_Test} from "tests/unit/token/BridgedWOETH/shared/Shared.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Unit_Concrete_BridgedWOETH_MintAndBurn_Test is Unit_BridgedWOETH_Shared_Test {
    function test_mint_updatesBalanceAndSupply() public {
        uint256 amount = 1.2344 ether;

        vm.prank(minter);
        vm.expectEmit(true, true, true, true);
        emit IERC20.Transfer(address(0), alice, amount);
        bridgedWOETH.mint(alice, amount);

        assertEq(bridgedWOETH.balanceOf(alice), amount);
        assertEq(bridgedWOETH.totalSupply(), amount);
    }

    function test_mint_RevertWhen_notMinter() public {
        vm.prank(alice);
        vm.expectRevert();
        bridgedWOETH.mint(alice, 1 ether);
    }

    function test_burnFromAccount_updatesBalanceAndSupply() public {
        vm.prank(minter);
        bridgedWOETH.mint(alice, 1 ether);

        vm.prank(burner);
        bridgedWOETH.burn(alice, 0.787 ether);

        assertEq(bridgedWOETH.balanceOf(alice), 0.213 ether);
        assertEq(bridgedWOETH.totalSupply(), 0.213 ether);
    }

    function test_burnFromCaller_updatesBalanceAndSupply() public {
        vm.prank(minter);
        bridgedWOETH.mint(burner, 1 ether);

        vm.prank(burner);
        bridgedWOETH.burn(0.787 ether);

        assertEq(bridgedWOETH.balanceOf(burner), 0.213 ether);
        assertEq(bridgedWOETH.totalSupply(), 0.213 ether);
    }

    function test_burn_RevertWhen_notBurner() public {
        vm.prank(minter);
        bridgedWOETH.mint(alice, 1 ether);

        vm.prank(alice);
        vm.expectRevert();
        bridgedWOETH.burn(alice, 1 ether);
    }
}
