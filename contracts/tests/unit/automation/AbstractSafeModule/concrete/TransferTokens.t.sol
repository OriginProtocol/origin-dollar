// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_AbstractSafeModule_Shared_Test} from
    "tests/unit/automation/AbstractSafeModule/shared/Shared.t.sol";

contract Unit_Concrete_AbstractSafeModule_TransferTokens_Test is Unit_AbstractSafeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- ERC20 TRANSFERS
    //////////////////////////////////////////////////////

    function test_transferTokens_erc20SpecificAmount() public {
        // Mint tokens to the module
        mockToken.mint(address(module), 100e18);

        // Call transferTokens from the safe
        vm.prank(address(mockSafe));
        module.transferTokens(address(mockToken), 40e18);

        assertEq(mockToken.balanceOf(address(mockSafe)), 40e18);
        assertEq(mockToken.balanceOf(address(module)), 60e18);
    }

    function test_transferTokens_erc20ZeroMeansAllBalance() public {
        // Mint tokens to the module
        mockToken.mint(address(module), 100e18);

        // Call transferTokens with amount = 0 (should transfer all)
        vm.prank(address(mockSafe));
        module.transferTokens(address(mockToken), 0);

        assertEq(mockToken.balanceOf(address(mockSafe)), 100e18);
        assertEq(mockToken.balanceOf(address(module)), 0);
    }

    //////////////////////////////////////////////////////
    /// --- NATIVE ETH TRANSFERS
    //////////////////////////////////////////////////////

    function test_transferTokens_nativeEthSpecificAmount() public {
        // Fund the module with ETH
        vm.deal(address(module), 10 ether);

        uint256 safeBefore = address(mockSafe).balance;

        // Call transferTokens with token = address(0) for native ETH
        vm.prank(address(mockSafe));
        module.transferTokens(address(0), 3 ether);

        assertEq(address(mockSafe).balance, safeBefore + 3 ether);
        assertEq(address(module).balance, 7 ether);
    }

    function test_transferTokens_nativeEthZeroMeansAllBalance() public {
        // Fund the module with ETH
        vm.deal(address(module), 10 ether);

        uint256 safeBefore = address(mockSafe).balance;

        // Call transferTokens with amount = 0 (should transfer all ETH)
        vm.prank(address(mockSafe));
        module.transferTokens(address(0), 0);

        assertEq(address(mockSafe).balance, safeBefore + 10 ether);
        assertEq(address(module).balance, 0);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTS
    //////////////////////////////////////////////////////

    function test_transferTokens_RevertWhen_callerIsNotSafe() public {
        mockToken.mint(address(module), 100e18);

        vm.prank(alice);
        vm.expectRevert("Caller is not the safe contract");
        module.transferTokens(address(mockToken), 50e18);
    }
}
