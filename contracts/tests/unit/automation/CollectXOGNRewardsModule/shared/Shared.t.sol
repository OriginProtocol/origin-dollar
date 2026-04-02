// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockXOGN} from "tests/mocks/MockXOGN.sol";
import {ICollectXOGNRewardsModule} from "contracts/interfaces/automation/ICollectXOGNRewardsModule.sol";

abstract contract Unit_CollectXOGNRewardsModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    ICollectXOGNRewardsModule internal collectXOGNRewardsModule;
    MockERC20 internal ognToken;
    MockXOGN internal xognMock;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    address internal constant OGN_ADDRESS = 0x8207c1FfC5B6804F6024322CcF34F29c3541Ae26;
    address internal constant XOGN_ADDRESS = 0x63898b3b6Ef3d39332082178656E9862bee45C57;
    address internal constant REWARDS_SOURCE = 0x67CE815d91de0f843472Fe9c171Acb036994Cd05;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        // Deploy mock safe
        mockSafe = new MockSafeContract();

        // Deploy OGN mock at the hardcoded address using vm.etch
        MockERC20 ognImpl = new MockERC20("OGN", "OGN", 18);
        vm.etch(OGN_ADDRESS, address(ognImpl).code);
        ognToken = MockERC20(OGN_ADDRESS);
        // Initialize name/symbol/decimals storage (solmate MockERC20 slots)
        vm.store(OGN_ADDRESS, bytes32(uint256(0)), bytes32(abi.encodePacked(uint16(0x0003), "OGN")));

        // Deploy MockXOGN at the hardcoded address using vm.etch
        MockXOGN xognImpl = new MockXOGN(address(ognImpl));
        vm.etch(XOGN_ADDRESS, address(xognImpl).code);
        xognMock = MockXOGN(XOGN_ADDRESS);
        // Set ogn storage slot (slot 0 in MockXOGN)
        vm.store(XOGN_ADDRESS, bytes32(uint256(0)), bytes32(uint256(uint160(OGN_ADDRESS))));

        // Deploy CollectXOGNRewardsModule
        collectXOGNRewardsModule = ICollectXOGNRewardsModule(
            vm.deployCode(
                "contracts/automation/CollectXOGNRewardsModule.sol:CollectXOGNRewardsModule",
                abi.encode(address(mockSafe), operator)
            )
        );
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(OGN_ADDRESS, "OGN");
        vm.label(XOGN_ADDRESS, "xOGN");
        vm.label(REWARDS_SOURCE, "RewardsSource");
        vm.label(address(collectXOGNRewardsModule), "CollectXOGNRewardsModule");
    }
}
