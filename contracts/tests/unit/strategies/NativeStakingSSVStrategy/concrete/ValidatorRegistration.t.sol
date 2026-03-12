// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_NativeStakingSSVStrategy_Shared_Test} from
    "tests/unit/strategies/NativeStakingSSVStrategy/shared/Shared.t.sol";

contract Unit_Concrete_NativeStakingSSVStrategy_ValidatorRegistration_Test
    is Unit_NativeStakingSSVStrategy_Shared_Test
{
    function setUp() public override {
        super.setUp();

        // Fund strategy with SSV tokens and WETH
        deal(address(mockSsv), address(nativeStakingSSVStrategy), 1000 ether);
        vm.prank(josh);
        weth.transfer(address(nativeStakingSSVStrategy), 256 ether);
    }

    function test_registerSsvValidators_single() public {
        bytes[] memory pubKeys = new bytes[](1);
        pubKeys[0] = testPublicKeys[0];
        bytes[] memory sharesData = new bytes[](1);
        sharesData[0] = TEST_SHARES_DATA;

        // State should be NON_REGISTERED before
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[0]))), 0
        );

        vm.prank(governor);
        vm.expectEmit(true, true, true, true);
        emit SSVValidatorRegistered(keccak256(testPublicKeys[0]), testPublicKeys[0], _operatorIds());
        nativeStakingSSVStrategy.registerSsvValidators(
            pubKeys, _operatorIds(), sharesData, 2 ether, _emptyCluster()
        );

        // State should be REGISTERED
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[0]))), 1
        );
    }

    function test_registerSsvValidators_bulk() public {
        bytes[] memory pubKeys = new bytes[](2);
        pubKeys[0] = testPublicKeys[0];
        pubKeys[1] = testPublicKeys[1];
        bytes[] memory sharesData = new bytes[](2);
        sharesData[0] = TEST_SHARES_DATA;
        sharesData[1] = TEST_SHARES_DATA;

        vm.prank(governor);
        nativeStakingSSVStrategy.registerSsvValidators(
            pubKeys, _operatorIds(), sharesData, 2 ether, _emptyCluster()
        );

        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[0]))), 1
        );
        assertEq(
            uint256(nativeStakingSSVStrategy.validatorsStates(keccak256(testPublicKeys[1]))), 1
        );
    }

    function test_registerSsvValidators_RevertWhen_duplicate() public {
        _registerValidator(0);

        bytes[] memory pubKeys = new bytes[](1);
        pubKeys[0] = testPublicKeys[0];
        bytes[] memory sharesData = new bytes[](1);
        sharesData[0] = TEST_SHARES_DATA;

        vm.prank(governor);
        vm.expectRevert("Validator already registered");
        nativeStakingSSVStrategy.registerSsvValidators(
            pubKeys, _operatorIds(), sharesData, 2 ether, _emptyCluster()
        );
    }

    function test_registerSsvValidators_RevertWhen_nonRegistrator() public {
        bytes[] memory pubKeys = new bytes[](1);
        pubKeys[0] = testPublicKeys[0];
        bytes[] memory sharesData = new bytes[](1);
        sharesData[0] = TEST_SHARES_DATA;

        vm.prank(alice);
        vm.expectRevert("Caller is not the Registrator");
        nativeStakingSSVStrategy.registerSsvValidators(
            pubKeys, _operatorIds(), sharesData, 2 ether, _emptyCluster()
        );
    }

    // ----------------
    // Events
    // ----------------

    event SSVValidatorRegistered(bytes32 indexed pubKeyHash, bytes pubKey, uint64[] operatorIds);
}
