// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_CurveAmoRepegModule_Shared_Test,
    IRepegCheckerSnapshots
} from "tests/unit/automation/CurveAmoRepegModule/shared/Shared.t.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ICurveAmoRepegModule} from "contracts/interfaces/automation/ICurveAmoRepegModule.sol";
import {MockRepegVault, MockRepegAmo, MockRepegSafe} from "tests/mocks/MockCurveAmoRepeg.sol";

contract Unit_Concrete_CurveAmoRepegModule_Repeg_Test is Unit_CurveAmoRepegModule_Shared_Test {
    function test_constructorBindingsAndRoles() public view {
        assertEq(module.safeContract(), address(safe));
        assertEq(module.vault(), address(vault));
        assertEq(module.amo(), address(amo));
        assertEq(module.checker(), checker);
        assertEq(module.maxProfitVariance(), 1e18);
        assertEq(module.maxVaultChangeVariance(), 1e18);
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), operator));
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), address(safe)));
        assertTrue(module.hasRole(module.DEFAULT_ADMIN_ROLE(), address(safe)));
        assertFalse(module.hasRole(module.DEFAULT_ADMIN_ROLE(), operator));
    }

    function test_exactCallOrderAndSameSafeSnapshot() public {
        _run();
        assertEq(module.nonce(), 1);
        assertEq(safe.calls(), 4);
        assertEq(safe.targets(1), address(vault));
        assertEq(safe.inputs(1), abi.encodeWithSignature("rebase()"));
        assertEq(safe.targets(2), checker);
        assertEq(safe.inputs(2), abi.encodeWithSignature("takeSnapshot()"));
        assertEq(safe.targets(3), address(amo));
        assertEq(safe.inputs(3), abi.encodeWithSignature("removeAndBurnOTokens(uint256)", 100e18));
        assertEq(safe.targets(4), checker);
        assertEq(
            safe.inputs(4),
            abi.encodeWithSignature(
                "checkDelta(int256,int256,int256,int256)", int256(10e18), int256(1e18), int256(-90e18), int256(1e18)
            )
        );
        (uint256 value, uint256 supply,) = IRepegCheckerSnapshots(checker).snapshots(address(safe));
        assertEq(value, 10_100e18);
        assertEq(supply, 10_100e18);
        (,, uint256 moduleSnapshot) = IRepegCheckerSnapshots(checker).snapshots(address(module));
        assertEq(moduleSnapshot, 0);
        assertEq(vault.totalValue(), 10_010e18);
        assertEq(token.totalSupply(), 10_000e18);
    }

    function test_emitsCompletion() public {
        vm.expectEmit(true, false, false, true);
        emit ICurveAmoRepegModule.Repegged(0, 100e18, 10e18, 1e18, -90e18, 1e18);
        _run();
    }

    function test_unauthorized() public {
        vm.expectRevert("Caller is not an operator");
        module.repeg(100e18, 10e18, 1e18, -90e18, 1e18, 0, block.timestamp);
        _expectRollback();
    }

    function test_roleRevocation() public {
        bytes32 role = module.OPERATOR_ROLE();
        vm.prank(address(safe));
        IAccessControl(address(module)).revokeRole(role, operator);
        vm.expectRevert("Caller is not an operator");
        _run();
        _expectRollback();
    }

    function test_operatorCannotGrantRole() public {
        bytes32 role = module.OPERATOR_ROLE();
        address attacker = makeAddr("attacker");
        vm.prank(operator);
        vm.expectRevert();
        module.grantRole(role, attacker);
    }

    function test_safeCanExecute() public {
        vm.prank(address(safe));
        module.repeg(100e18, 10e18, 0, -90e18, 0, 0, block.timestamp);
        assertEq(module.nonce(), 1);
    }

    function test_zeroLPRejected() public {
        vm.prank(operator);
        vm.expectRevert("Zero LP amount");
        module.repeg(0, 0, 0, 0, 0, 0, block.timestamp);
    }

    function test_negativeProfitVarianceRejected() public {
        vm.prank(operator);
        vm.expectRevert("Invalid profit variance");
        module.repeg(100e18, 10e18, -1, -90e18, 0, 0, block.timestamp);
    }

    function test_profitVarianceCapRejected() public {
        vm.prank(operator);
        vm.expectRevert("Invalid profit variance");
        module.repeg(100e18, 10e18, 1e18 + 1, -90e18, 0, 0, block.timestamp);
    }

    function test_negativeVaultVarianceRejected() public {
        vm.prank(operator);
        vm.expectRevert("Invalid vault variance");
        module.repeg(100e18, 10e18, 0, -90e18, -1, 0, block.timestamp);
    }

    function test_vaultVarianceCapRejected() public {
        vm.prank(operator);
        vm.expectRevert("Invalid vault variance");
        module.repeg(100e18, 10e18, 0, -90e18, 1e18 + 1, 0, block.timestamp);
    }

    function test_negativeProfitRejected() public {
        vm.prank(operator);
        vm.expectRevert("Profit required");
        module.repeg(100e18, -1, 0, -90e18, 0, 0, block.timestamp);
    }

    function test_lossRangeRejected() public {
        vm.prank(operator);
        vm.expectRevert("Profit required");
        module.repeg(100e18, 1e18 - 1, 1e18, -90e18, 0, 0, block.timestamp);
    }

    function test_positiveVaultChangeRejected() public {
        vm.prank(operator);
        vm.expectRevert("Positive vault change");
        module.repeg(100e18, 10e18, 0, 1, 0, 0, block.timestamp);
    }

    function test_wrongNonceRejected() public {
        vm.prank(operator);
        vm.expectRevert("Invalid nonce");
        module.repeg(100e18, 10e18, 0, -90e18, 0, 1, block.timestamp);
    }

    function test_duplicateRequestRejected() public {
        _run();
        vm.prank(operator);
        vm.expectRevert("Invalid nonce");
        module.repeg(100e18, 10e18, 0, -90e18, 0, 0, block.timestamp);
    }

    function test_expiredRequestRejected() public {
        vm.prank(operator);
        vm.expectRevert("Invalid deadline");
        module.repeg(100e18, 10e18, 0, -90e18, 0, 0, block.timestamp - 1);
    }

    function test_distantDeadlineRejected() public {
        vm.prank(operator);
        vm.expectRevert("Invalid deadline");
        module.repeg(100e18, 10e18, 0, -90e18, 0, 0, block.timestamp + 301);
    }

    function test_rebaseFailureRollsBack() public {
        safe.setFailAt(1);
        vm.expectRevert("Safe call failed");
        _run();
        _expectRollback();
    }

    function test_snapshotFailureRollsBack() public {
        safe.setFailAt(2);
        vm.expectRevert("Safe call failed");
        _run();
        _expectRollback();
    }

    function test_burnFailureRollsBack() public {
        safe.setFailAt(3);
        vm.expectRevert("Safe call failed");
        _run();
        _expectRollback();
    }

    function test_checkerFailureRollsBack() public {
        safe.setFailAt(4);
        vm.expectRevert("Safe call failed");
        _run();
        _expectRollback();
    }

    function test_realCheckerRejectsLossAndRollsBack() public {
        amo.setValueReduction(101e18);
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.repeg(100e18, 1, 0, -101e18, 1e18, 0, block.timestamp);
        _expectRollback();
    }

    function test_realCheckerRejectsProfitOutsideBounds() public {
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.repeg(100e18, 8e18, 1e18, -90e18, 1e18, 0, block.timestamp);
        _expectRollback();
    }

    function test_realCheckerRejectsVaultChangeOutsideBounds() public {
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.repeg(100e18, 10e18, 1e18, -92e18, 1e18, 0, block.timestamp);
        _expectRollback();
    }

    function test_zeroProfitRejectedBeforeExecution() public {
        amo.setValueReduction(100e18);
        vm.prank(operator);
        vm.expectRevert("Profit required");
        module.repeg(100e18, 0, 0, -100e18, 0, 0, block.timestamp);
        _expectRollback();
    }

    function test_zeroLowerProfitBoundRejected() public {
        vm.prank(operator);
        vm.expectRevert("Profit required");
        module.repeg(100e18, 1e18, 1e18, -90e18, 0, 0, block.timestamp);
        _expectRollback();
    }

    function test_realCheckerRejectsActualZeroProfitAndRollsBack() public {
        amo.setValueReduction(100e18);
        vm.prank(operator);
        vm.expectRevert("Safe call failed");
        module.repeg(100e18, 1, 0, -100e18, 0, 0, block.timestamp);
        _expectRollback();
    }

    function test_minimumOneWeiProfitAccepted() public {
        amo.setValueReduction(100e18 - 1);
        vm.prank(operator);
        module.repeg(100e18, 1, 0, -100e18 + 1, 0, 0, block.timestamp);
        assertEq(module.nonce(), 1);
        assertEq(vault.totalValue() - token.totalSupply(), 1);
    }

    function test_minimumOneWeiLowerBoundWithVarianceAccepted() public {
        amo.setValueReduction(100e18 - 1);
        vm.prank(operator);
        module.repeg(100e18, 1e18 + 1, 1e18, -100e18 + 1, 0, 0, block.timestamp);
        assertEq(module.nonce(), 1);
        assertEq(vault.totalValue() - token.totalSupply(), 1);
    }

    function test_profitBoundsInclusive() public {
        vm.prank(operator);
        module.repeg(100e18, 9e18, 1e18, -90e18, 1e18, 0, block.timestamp);
        assertEq(module.nonce(), 1);
    }

    function test_rebasePausedRollsBack() public {
        vault.setRebasePaused(true);
        vm.expectRevert("Safe call failed");
        _run();
        _expectRollback();
        assertTrue(vault.rebasePaused());
    }

    function test_reentrancyRejectedEvenForSafeOperator() public {
        safe.setReentry(
            address(module),
            abi.encodeWithSelector(
                module.repeg.selector,
                uint256(100e18),
                int256(10e18),
                int256(0),
                int256(-90e18),
                int256(0),
                uint256(1),
                block.timestamp
            )
        );
        _run();
        assertEq(safe.reentryRevert(), abi.encodeWithSignature("Error(string)", "ReentrancyGuard: reentrant call"));
        assertEq(module.nonce(), 1);
    }

    function test_constructorRejectsInvalidToken() public {
        MockRepegVault otherVault = new MockRepegVault(address(safe), address(0));
        MockRepegAmo otherAmo = new MockRepegAmo(address(otherVault));
        address otherChecker = vm.deployCode(
            "contracts/strategies/VaultValueChecker.sol:VaultValueChecker", abi.encode(address(otherVault), address(0))
        );
        vm.expectRevert();
        _deploy(address(safe), operator, address(otherVault), address(otherAmo), otherChecker, 1, 1);
    }

    function test_capsAreDeploymentSpecific() public {
        ICurveAmoRepegModule narrow =
            _deploy(address(safe), operator, address(vault), address(amo), checker, 1e14, 1e14);
        assertEq(narrow.maxProfitVariance(), 1e14);
        assertEq(narrow.maxVaultChangeVariance(), 1e14);
        vm.prank(operator);
        narrow.repeg(100e18, 10e18, 1e14, -90e18, 1e14, 0, block.timestamp);
        assertEq(narrow.nonce(), 1);
    }

    function test_constructorRejectsInvalidSafe() public {
        vm.expectRevert();
        _deploy(address(0), operator, address(vault), address(amo), checker, 1, 1);
    }

    function test_constructorRejectsInvalidOperator() public {
        vm.expectRevert();
        _deploy(address(safe), address(0), address(vault), address(amo), checker, 1, 1);
    }

    function test_constructorRejectsInvalidVault() public {
        vm.expectRevert();
        _deploy(address(safe), operator, address(0), address(amo), checker, 1, 1);
    }

    function test_constructorRejectsInvalidAmo() public {
        vm.expectRevert();
        _deploy(address(safe), operator, address(vault), address(0), checker, 1, 1);
    }

    function test_constructorRejectsInvalidChecker() public {
        vm.expectRevert();
        _deploy(address(safe), operator, address(vault), address(amo), address(0), 1, 1);
    }

    function test_constructorRejectsWrongSafeBinding() public {
        MockRepegSafe other = new MockRepegSafe();
        vm.expectRevert();
        _deploy(address(other), operator, address(vault), address(amo), checker, 1, 1);
    }

    function test_constructorRejectsWrongAmoBinding() public {
        MockRepegAmo other = new MockRepegAmo(address(token));
        vm.expectRevert();
        _deploy(address(safe), operator, address(vault), address(other), checker, 1, 1);
    }

    function test_constructorRejectsWrongCheckerVault() public {
        address other = vm.deployCode(
            "contracts/strategies/VaultValueChecker.sol:VaultValueChecker", abi.encode(address(token), address(token))
        );
        vm.expectRevert();
        _deploy(address(safe), operator, address(vault), address(amo), other, 1, 1);
    }

    function test_constructorRejectsWrongCheckerToken() public {
        address other = vm.deployCode(
            "contracts/strategies/VaultValueChecker.sol:VaultValueChecker", abi.encode(address(vault), address(amo))
        );
        vm.expectRevert();
        _deploy(address(safe), operator, address(vault), address(amo), other, 1, 1);
    }

    function test_constructorRejectsZeroProfitCap() public {
        vm.expectRevert();
        _deploy(address(safe), operator, address(vault), address(amo), checker, 0, 1);
    }

    function test_constructorRejectsZeroVaultCap() public {
        vm.expectRevert();
        _deploy(address(safe), operator, address(vault), address(amo), checker, 1, 0);
    }

    function test_constructorRejectsOverflowingProfitCap() public {
        vm.expectRevert();
        _deploy(address(safe), operator, address(vault), address(amo), checker, uint256(type(int256).max) + 1, 1);
    }

    function test_constructorRejectsOverflowingVaultCap() public {
        vm.expectRevert();
        _deploy(address(safe), operator, address(vault), address(amo), checker, 1, uint256(type(int256).max) + 1);
    }
}
