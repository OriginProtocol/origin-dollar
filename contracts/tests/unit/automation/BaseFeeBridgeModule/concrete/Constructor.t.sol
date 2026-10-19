// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    IBaseFeeBridgeModule,
    Unit_BaseFeeBridgeModule_Shared_Test
} from "tests/unit/automation/BaseFeeBridgeModule/shared/Shared.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

// --- Project imports
import {MockCurvePool} from "tests/mocks/MockCurvePool.sol";

contract Unit_Concrete_BaseFeeBridgeModule_Constructor_Test is Unit_BaseFeeBridgeModule_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- CONSTRUCTOR
    //////////////////////////////////////////////////////

    function test_constructor_immutablesSet() public view {
        assertEq(module.safeContract(), address(mockSafe));
        assertEq(module.oethb(), address(oethb));
        assertEq(module.weth(), address(mockWeth));
        assertEq(module.curvePool(), address(pool));
        assertEq(module.ccipRouter(), address(router));
        assertEq(module.destinationChainSelector(), DEST_SELECTOR);
        assertEq(module.feeSplitter(), feeSplitter);
        assertEq(module.maxSlippageBps(), MAX_SLIPPAGE);
    }

    function test_constructor_poolIndicesWethFirst() public view {
        assertEq(module.wethIndex(), 0);
        assertEq(module.oethbIndex(), 1);
    }

    function test_constructor_poolIndicesOethbFirst() public {
        MockCurvePool flipped = new MockCurvePool(address(oethb), address(mockWeth));
        IBaseFeeBridgeModule m = _deployModule(address(flipped));
        assertEq(m.oethbIndex(), 0);
        assertEq(m.wethIndex(), 1);
    }

    function test_constructor_operatorRoleGranted() public view {
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), operator));
    }

    function test_constructor_safeHasAdminRole() public view {
        assertTrue(module.hasRole(module.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
    }

    function test_constructor_revertsOnPoolCoinsMismatch() public {
        MockCurvePool other = new MockCurvePool(address(mockWeth), makeAddr("Other"));
        vm.expectRevert("Pool coins mismatch");
        _deployModule(address(other));
    }

    function test_constructor_revertsOnZeroOperator() public {
        vm.expectRevert("Invalid operator");
        vm.deployCode(
            Automation.BASE_FEE_BRIDGE_MODULE,
            abi.encode(
                address(mockSafe),
                address(0),
                address(oethb),
                address(mockWeth),
                address(pool),
                address(router),
                DEST_SELECTOR,
                feeSplitter,
                MAX_SLIPPAGE
            )
        );
    }

    function test_constructor_revertsOnZeroFeeSplitter() public {
        vm.expectRevert("Invalid fee splitter");
        vm.deployCode(
            Automation.BASE_FEE_BRIDGE_MODULE,
            abi.encode(
                address(mockSafe),
                operator,
                address(oethb),
                address(mockWeth),
                address(pool),
                address(router),
                DEST_SELECTOR,
                address(0),
                MAX_SLIPPAGE
            )
        );
    }

    function test_constructor_revertsOnSlippageAboveCap() public {
        vm.expectRevert("Slippage too high");
        vm.deployCode(
            Automation.BASE_FEE_BRIDGE_MODULE,
            abi.encode(
                address(mockSafe),
                operator,
                address(oethb),
                address(mockWeth),
                address(pool),
                address(router),
                DEST_SELECTOR,
                feeSplitter,
                uint256(101)
            )
        );
    }
}
