// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BaseFeeBridgeModule_Shared_Test} from "tests/unit/automation/BaseFeeBridgeModule/shared/Shared.t.sol";

contract Unit_Concrete_BaseFeeBridgeModule_SwapAndBridge_Test is Unit_BaseFeeBridgeModule_Shared_Test {
    uint256 internal constant AMOUNT = 2 ether;

    event FeesBridged(uint256 oethbAmount, uint256 wethAmount, uint256 ccipFee);

    function setUp() public override {
        super.setUp();
        oethb.mint(address(mockSafe), AMOUNT);
    }

    //////////////////////////////////////////////////////
    /// --- HAPPY PATH
    //////////////////////////////////////////////////////

    function test_swapAndBridge_sellsOethbAndBridgesWeth() public {
        vm.prank(operator);
        module.swapAndBridge(AMOUNT, AMOUNT);

        assertEq(oethb.balanceOf(address(mockSafe)), 0, "OETHb left on Safe");
        assertEq(mockWeth.balanceOf(address(mockSafe)), 0, "WETH left on Safe");
        assertEq(mockWeth.balanceOf(address(router)), AMOUNT, "WETH not sent to router");
        assertEq(router.sentMessagesLength(), 1);
    }

    function test_swapAndBridge_sendsToFeeSplitterOnDestination() public {
        vm.expectEmit(address(router));
        emit MockCcipSend(DEST_SELECTOR, abi.encode(feeSplitter), address(mockWeth), AMOUNT, CCIP_FEE);

        vm.prank(operator);
        module.swapAndBridge(AMOUNT, AMOUNT);
    }

    function test_swapAndBridge_safePaysCcipFee() public {
        uint256 ethBefore = address(mockSafe).balance;

        vm.prank(operator);
        module.swapAndBridge(AMOUNT, AMOUNT);

        assertEq(ethBefore - address(mockSafe).balance, CCIP_FEE);
        assertEq(address(router).balance, CCIP_FEE);
    }

    function test_swapAndBridge_bridgesOnlySwappedWeth() public {
        uint256 existing = 5 ether;
        mockWeth.mint(address(mockSafe), existing);

        vm.prank(operator);
        module.swapAndBridge(AMOUNT, AMOUNT);

        assertEq(mockWeth.balanceOf(address(mockSafe)), existing, "Pre-existing WETH was bridged");
        assertEq(mockWeth.balanceOf(address(router)), AMOUNT);
    }

    function test_swapAndBridge_acceptsMinOutAtFloor() public {
        vm.prank(operator);
        module.swapAndBridge(AMOUNT, _floor(AMOUNT));

        assertEq(mockWeth.balanceOf(address(router)), AMOUNT);
    }

    function test_swapAndBridge_emitsFeesBridged() public {
        vm.expectEmit(address(module));
        emit FeesBridged(AMOUNT, AMOUNT, CCIP_FEE);

        vm.prank(operator);
        module.swapAndBridge(AMOUNT, AMOUNT);
    }

    function test_bridgeFee_returnsRouterFee() public view {
        assertEq(module.bridgeFee(AMOUNT), CCIP_FEE);
    }

    //////////////////////////////////////////////////////
    /// --- REVERTS
    //////////////////////////////////////////////////////

    function test_swapAndBridge_revertsForNonOperator() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not an operator");
        module.swapAndBridge(AMOUNT, AMOUNT);
    }

    function test_swapAndBridge_revertsOnZeroAmount() public {
        vm.prank(operator);
        vm.expectRevert("Invalid amount");
        module.swapAndBridge(0, 0);
    }

    function test_swapAndBridge_revertsWhenMinOutBelowFloor() public {
        vm.prank(operator);
        vm.expectRevert("Min out below floor");
        module.swapAndBridge(AMOUNT, _floor(AMOUNT) - 1);
    }

    function test_swapAndBridge_revertsWhenSafeCallFails() public {
        mockSafe.setShouldFail(true);

        vm.prank(operator);
        vm.expectRevert("Failed to approve OETHb");
        module.swapAndBridge(AMOUNT, AMOUNT);
    }

    function test_swapAndBridge_revertsWhenSwapFails() public {
        // More OETHb than the Safe holds: the pool's transferFrom fails.
        vm.prank(operator);
        vm.expectRevert("Swap failed");
        module.swapAndBridge(AMOUNT + 1, AMOUNT + 1);
    }

    function test_swapAndBridge_revertsWhenSafeCannotPayCcipFee() public {
        vm.deal(address(mockSafe), CCIP_FEE - 1);

        vm.prank(operator);
        vm.expectRevert("Failed to send CCIP message");
        module.swapAndBridge(AMOUNT, AMOUNT);
    }
}
