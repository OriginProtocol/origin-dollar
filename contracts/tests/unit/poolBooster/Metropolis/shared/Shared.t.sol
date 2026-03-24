// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";

import {OSonic} from "contracts/token/OSonic.sol";
import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";
import {PoolBoosterFactoryMetropolis} from "contracts/poolBooster/PoolBoosterFactoryMetropolis.sol";
import {PoolBoosterMetropolis} from "contracts/poolBooster/PoolBoosterMetropolis.sol";

abstract contract Unit_Metropolis_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////
    OSonic internal oSonic;
    PoolBoostCentralRegistry internal centralRegistry;
    PoolBoosterFactoryMetropolis internal factoryMetropolis;
    PoolBoosterMetropolis internal boosterMetropolis;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    //////////////////////////////////////////////////////
    /// --- MOCK ADDRESSES
    //////////////////////////////////////////////////////

    address internal mockRewardFactory;
    address internal mockVoter;
    address internal mockAmmPool;
    address internal mockRewarder;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createMockAddresses();
        _deployOSonic();
        _deployCentralRegistry();
        _deployFactory();
        _mockMetropolisContracts();
        _deployStandaloneBooster();
        _approveFactoryOnRegistry();
        _labelContracts();
    }

    function _createMockAddresses() internal {
        mockRewardFactory = makeAddr("MockRewardFactory");
        mockVoter = makeAddr("MockVoter");
        mockAmmPool = makeAddr("MockAmmPool");
        mockRewarder = makeAddr("MockRewarder");
    }

    function _deployOSonic() internal {
        oSonic = OSonic(address(new MockERC20("Origin Sonic", "OS", 18)));
    }

    function _deployCentralRegistry() internal {
        centralRegistry = new PoolBoostCentralRegistry();
        _setGovernorViaSlot(address(centralRegistry), governor);
    }

    function _deployFactory() internal {
        factoryMetropolis = new PoolBoosterFactoryMetropolis(
            address(oSonic), governor, address(centralRegistry), mockRewardFactory, mockVoter
        );
    }

    function _deployStandaloneBooster() internal {
        boosterMetropolis = new PoolBoosterMetropolis(address(oSonic), mockRewardFactory, mockAmmPool, mockVoter);
    }

    function _approveFactoryOnRegistry() internal {
        vm.prank(governor);
        centralRegistry.approveFactory(address(factoryMetropolis));
    }

    function _labelContracts() internal {
        vm.label(address(oSonic), "OSonic (MockERC20)");
        vm.label(address(centralRegistry), "CentralRegistry");
        vm.label(address(factoryMetropolis), "FactoryMetropolis");
        vm.label(address(boosterMetropolis), "BoosterMetropolis");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _setGovernorViaSlot(address _contract, address _governor) internal {
        vm.store(_contract, GOVERNOR_SLOT, bytes32(uint256(uint160(_governor))));
    }

    function _dealOSonic(address _to, uint256 _amount) internal {
        MockERC20(address(oSonic)).mint(_to, _amount);
    }

    function _mockMetropolisContracts() internal {
        // Mock getWhitelistedTokenInfo
        vm.mockCall(
            mockRewardFactory,
            abi.encodeWithSelector(bytes4(keccak256("getWhitelistedTokenInfo(address)"))),
            abi.encode(true, uint256(1e10))
        );

        // Mock getCurrentVotingPeriod
        vm.mockCall(
            mockVoter, abi.encodeWithSelector(bytes4(keccak256("getCurrentVotingPeriod()"))), abi.encode(uint256(5))
        );

        // Mock createBribeRewarder
        vm.mockCall(
            mockRewardFactory,
            abi.encodeWithSelector(bytes4(keccak256("createBribeRewarder(address,address)"))),
            abi.encode(mockRewarder)
        );

        // Mock fundAndBribe on the rewarder
        vm.mockCall(
            mockRewarder,
            abi.encodeWithSelector(bytes4(keccak256("fundAndBribe(uint256,uint256,uint256)"))),
            abi.encode()
        );
    }
}
