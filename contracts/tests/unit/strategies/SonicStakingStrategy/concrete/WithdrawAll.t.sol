// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_SonicStakingStrategy_Shared_Test} from
    "tests/unit/strategies/SonicStakingStrategy/shared/Shared.t.sol";

contract Unit_Concrete_SonicStakingStrategy_WithdrawAll_Test is Unit_SonicStakingStrategy_Shared_Test {
    function test_withdrawAll_wrapsNativeSAndTransfersAllWS() public {
        uint256 nativeAmount = 3 ether;
        uint256 wsAmount = 5 ether;

        // Give strategy native S
        vm.deal(address(sonicStakingStrategy), nativeAmount);
        // Give strategy wS
        _mintWS(address(sonicStakingStrategy), wsAmount);

        uint256 vaultBalBefore = mockWrappedSonic.balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.withdrawAll();

        uint256 vaultBalAfter = mockWrappedSonic.balanceOf(address(oSonicVault));
        assertEq(vaultBalAfter - vaultBalBefore, nativeAmount + wsAmount);
        assertEq(mockWrappedSonic.balanceOf(address(sonicStakingStrategy)), 0);
        assertEq(address(sonicStakingStrategy).balance, 0);
    }

    function test_withdrawAll_handlesOnlyWS() public {
        uint256 wsAmount = 5 ether;
        _mintWS(address(sonicStakingStrategy), wsAmount);

        uint256 vaultBalBefore = mockWrappedSonic.balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.withdrawAll();

        uint256 vaultBalAfter = mockWrappedSonic.balanceOf(address(oSonicVault));
        assertEq(vaultBalAfter - vaultBalBefore, wsAmount);
    }

    function test_withdrawAll_noOpOnZeroBalance() public {
        uint256 vaultBalBefore = mockWrappedSonic.balanceOf(address(oSonicVault));

        vm.prank(address(oSonicVault));
        sonicStakingStrategy.withdrawAll();

        uint256 vaultBalAfter = mockWrappedSonic.balanceOf(address(oSonicVault));
        assertEq(vaultBalAfter, vaultBalBefore);
    }

    function test_withdrawAll_RevertWhen_calledByNonVaultOrGovernor() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Vault or Governor");
        sonicStakingStrategy.withdrawAll();
    }
}
