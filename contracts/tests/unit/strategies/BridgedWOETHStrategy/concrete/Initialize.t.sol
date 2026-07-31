// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";

// --- Test utilities
import {Strategies} from "tests/utils/artifacts/Strategies.sol";

// --- Project imports
import {IBridgedWOETHStrategy} from "contracts/interfaces/strategies/IBridgedWOETHStrategy.sol";

contract Unit_Concrete_BridgedWOETHStrategy_Initialize_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    function test_initialize_setsMaxPriceDiffBps() public view {
        assertEq(bridgedWOETHStrategy.maxPriceDiffBps(), DEFAULT_MAX_PRICE_DIFF_BPS);
    }

    function test_initialize_setsImmutables() public view {
        assertEq(address(bridgedWOETHStrategy.weth()), address(mockWeth));
        assertEq(address(bridgedWOETHStrategy.bridgedWOETH()), address(bridgedWOETH));
        assertEq(address(bridgedWOETHStrategy.oethb()), address(oeth));
        assertEq(address(bridgedWOETHStrategy.oracle()), mockOracle);
    }

    function test_initialize_emitsMaxPriceDiffBpsUpdated() public {
        // Deploy a fresh strategy to test event emission
        IBridgedWOETHStrategy freshStrategy = IBridgedWOETHStrategy(
            vm.deployCode(
                Strategies.BRIDGED_WOETH_STRATEGY,
                abi.encode(
                    address(0), address(oethVault), address(mockWeth), address(bridgedWOETH), address(oeth), mockOracle
                )
            )
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        vm.expectEmit(true, true, true, true);
        emit IBridgedWOETHStrategy.MaxPriceDiffBpsUpdated(0, 200);

        vm.prank(governor);
        freshStrategy.initialize(200);
    }

    function test_initialize_RevertWhen_calledTwice() public {
        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        bridgedWOETHStrategy.initialize(200);
    }

    function test_initialize_RevertWhen_calledByNonGovernor() public {
        IBridgedWOETHStrategy freshStrategy = IBridgedWOETHStrategy(
            vm.deployCode(
                Strategies.BRIDGED_WOETH_STRATEGY,
                abi.encode(
                    address(0), address(oethVault), address(mockWeth), address(bridgedWOETH), address(oeth), mockOracle
                )
            )
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        freshStrategy.initialize(200);
    }

    function test_initialize_RevertWhen_zeroBps() public {
        IBridgedWOETHStrategy freshStrategy = IBridgedWOETHStrategy(
            vm.deployCode(
                Strategies.BRIDGED_WOETH_STRATEGY,
                abi.encode(
                    address(0), address(oethVault), address(mockWeth), address(bridgedWOETH), address(oeth), mockOracle
                )
            )
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        vm.prank(governor);
        vm.expectRevert("Invalid bps value");
        freshStrategy.initialize(0);
    }

    function test_initialize_RevertWhen_bpsExceeds10000() public {
        IBridgedWOETHStrategy freshStrategy = IBridgedWOETHStrategy(
            vm.deployCode(
                Strategies.BRIDGED_WOETH_STRATEGY,
                abi.encode(
                    address(0), address(oethVault), address(mockWeth), address(bridgedWOETH), address(oeth), mockOracle
                )
            )
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        vm.prank(governor);
        vm.expectRevert("Invalid bps value");
        freshStrategy.initialize(10001);
    }
}
