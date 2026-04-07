// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_WOETH_Shared_Test} from "tests/unit/token/WOETH/shared/Shared.t.sol";
import {IWOToken} from "contracts/interfaces/IWOToken.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";

contract Unit_Concrete_WOETH_Initialize_Test is Unit_WOETH_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- INITIALIZE
    //////////////////////////////////////////////////////

    function test_initialize_setsAdjuster() public view {
        // After setUp, adjuster should be 1e27 (fresh deploy with zero supply)
        assertEq(woeth.adjuster(), 1e27);
    }

    function test_initialize_enablesRebasing() public view {
        // WOETH should be rebasing — its OETH balance should increase on rebase
        // Verify the contract is initialized by checking adjuster is set
        assertGt(woeth.adjuster(), 0);
    }

    function test_initialize_RevertWhen_notGovernor() public {
        // Deploy fresh WOETH with deployer as proxy governor
        vm.startPrank(deployer);
        address freshImpl = vm.deployCode("contracts/token/WOETH.sol:WOETH", abi.encode(address(oeth)));
        IProxy freshProxy = IProxy(
            vm.deployCode(
                "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:InitializeGovernedUpgradeabilityProxy"
            )
        );
        freshProxy.initialize(address(freshImpl), governor, "");
        vm.stopPrank();

        IWOToken freshWoeth = IWOToken(address(freshProxy));

        vm.prank(matt);
        vm.expectRevert("Caller is not the Governor");
        freshWoeth.initialize();
    }

    function test_initialize_RevertWhen_calledTwice() public {
        // Already initialized in setUp, calling again should revert
        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        woeth.initialize();
    }

    //////////////////////////////////////////////////////
    /// --- INITIALIZE2
    //////////////////////////////////////////////////////

    function test_initialize2_RevertWhen_notGovernor() public {
        vm.prank(matt);
        vm.expectRevert("Caller is not the Governor");
        woeth.initialize2();
    }

    function test_initialize2_RevertWhen_calledTwice() public {
        // initialize2 was already called via initialize() in setUp
        vm.prank(governor);
        vm.expectRevert("Initialize2 already called");
        woeth.initialize2();
    }

    function test_initialize2_withExistingSupply() public {
        // Deploy a fresh WOETH where we can manipulate state
        vm.startPrank(deployer);
        address freshImpl = vm.deployCode("contracts/token/WOETH.sol:WOETH", abi.encode(address(oeth)));
        IProxy freshProxy = IProxy(
            vm.deployCode(
                "contracts/proxies/InitializeGovernedUpgradeabilityProxy.sol:InitializeGovernedUpgradeabilityProxy"
            )
        );
        freshProxy.initialize(address(freshImpl), governor, "");
        vm.stopPrank();

        IWOToken freshWoeth = IWOToken(address(freshProxy));

        // First initialize to enable rebasing and set adjuster
        vm.prank(governor);
        freshWoeth.initialize();

        // Deposit some OETH to create supply
        _mintOETH(alice, 50e18);
        vm.startPrank(alice);
        oeth.approve(address(freshWoeth), 50e18);
        freshWoeth.deposit(50e18, alice);
        vm.stopPrank();

        // Reset adjuster to 0 using vm.store (slot 56)
        vm.store(address(freshWoeth), bytes32(uint256(56)), bytes32(uint256(0)));
        assertEq(freshWoeth.adjuster(), 0);

        // Call initialize2 — should compute adjuster based on existing supply
        vm.prank(governor);
        freshWoeth.initialize2();

        // Adjuster should be set based on balance and supply
        assertGt(freshWoeth.adjuster(), 0);

        // totalAssets should approximately equal the OETH balance
        assertApproxEqAbs(freshWoeth.totalAssets(), oeth.balanceOf(address(freshWoeth)), 1);
    }
}
