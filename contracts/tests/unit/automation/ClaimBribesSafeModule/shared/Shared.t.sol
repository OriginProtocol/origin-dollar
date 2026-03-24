// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockAerodromeVoter} from "tests/mocks/MockAerodromeVoter.sol";
import {MockVeNFT} from "tests/mocks/MockVeNFT.sol";
import {MockCLRewardContract} from "tests/mocks/MockCLRewardContract.sol";
import {MockCLPoolForBribes, MockCLGaugeForBribes} from "tests/mocks/MockCLPoolForBribes.sol";
import {ClaimBribesSafeModule} from "contracts/automation/ClaimBribesSafeModule.sol";

abstract contract Unit_ClaimBribesSafeModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    ClaimBribesSafeModule internal claimBribesModule;
    MockAerodromeVoter internal mockVoter;
    MockVeNFT internal mockVeNFT;
    MockCLRewardContract internal mockRewardContract;
    MockCLPoolForBribes internal mockPool;
    MockCLGaugeForBribes internal mockGauge;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        // Deploy mocks
        mockSafe = new MockSafeContract();
        mockVoter = new MockAerodromeVoter();
        mockVeNFT = new MockVeNFT();
        mockRewardContract = new MockCLRewardContract();

        // Deploy gauge and pool mocks (pool -> gauge -> rewardContract)
        mockGauge = new MockCLGaugeForBribes(address(mockRewardContract));
        mockPool = new MockCLPoolForBribes(address(mockGauge));

        // Deploy ClaimBribesSafeModule
        claimBribesModule = new ClaimBribesSafeModule(address(mockSafe), address(mockVoter), address(mockVeNFT));

        // Grant OPERATOR_ROLE to operator via safe (safe has DEFAULT_ADMIN_ROLE)
        bytes32 operatorRole = claimBribesModule.OPERATOR_ROLE();
        vm.prank(address(mockSafe));
        claimBribesModule.grantRole(operatorRole, operator);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _addNFT(uint256 nftId) internal {
        mockVeNFT.setOwner(nftId, address(mockSafe));
        uint256[] memory ids = new uint256[](1);
        ids[0] = nftId;
        vm.prank(operator);
        claimBribesModule.addNFTIds(ids);
    }

    function _addBribePoolAsVoting(address pool) internal {
        vm.prank(address(mockSafe));
        claimBribesModule.addBribePool(pool, true);
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(mockVoter), "MockVoter");
        vm.label(address(mockVeNFT), "MockVeNFT");
        vm.label(address(mockRewardContract), "MockRewardContract");
        vm.label(address(mockPool), "MockPool");
        vm.label(address(mockGauge), "MockGauge");
        vm.label(address(claimBribesModule), "ClaimBribesModule");
    }
}
