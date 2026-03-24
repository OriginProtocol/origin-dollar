// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";
import {IMerklDistributor} from "contracts/interfaces/poolBooster/IMerklDistributor.sol";

import {OETH} from "contracts/token/OETH.sol";
import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";
import {PoolBoosterFactoryMerkl} from "contracts/poolBooster/PoolBoosterFactoryMerkl.sol";
import {PoolBoosterMerklV2} from "contracts/poolBooster/PoolBoosterMerklV2.sol";

abstract contract Unit_Merkl_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////
    OETH internal oeth;
    PoolBoostCentralRegistry internal centralRegistry;
    PoolBoosterFactoryMerkl internal factoryMerkl;
    PoolBoosterMerklV2 internal boosterMerkl;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    uint32 internal constant DEFAULT_CAMPAIGN_DURATION = 7200; // 2 hours
    uint32 internal constant DEFAULT_CAMPAIGN_TYPE = 2;
    bytes internal constant DEFAULT_CAMPAIGN_DATA = hex"deadbeef";

    //////////////////////////////////////////////////////
    /// --- MOCK ADDRESSES
    //////////////////////////////////////////////////////

    address internal mockMerklDistributor;
    address internal mockAmmPool;
    UpgradeableBeacon internal beacon;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createMockAddresses();
        _deployOETH();
        _deployCentralRegistry();
        _deployBeacon();
        _deployFactory();
        _deployStandaloneBooster();
        _approveFactoryOnRegistry();
        _labelContracts();
    }

    function _createMockAddresses() internal {
        mockMerklDistributor = makeAddr("MockMerklDistributor");
        mockAmmPool = makeAddr("MockAmmPool");
    }

    function _deployOETH() internal {
        oeth = OETH(address(new MockERC20("Origin Ether", "OETH", 18)));
    }

    function _deployCentralRegistry() internal {
        centralRegistry = new PoolBoostCentralRegistry();
        _setGovernorViaSlot(address(centralRegistry), governor);
    }

    function _deployBeacon() internal {
        PoolBoosterMerklV2 impl = new PoolBoosterMerklV2();
        beacon = new UpgradeableBeacon(address(impl));
    }

    function _deployFactory() internal {
        factoryMerkl = new PoolBoosterFactoryMerkl(address(oeth), governor, address(centralRegistry), address(beacon));
    }

    function _deployStandaloneBooster() internal {
        // Mock rewardTokenMinAmounts for merkl distributor
        vm.mockCall(
            mockMerklDistributor,
            abi.encodeWithSelector(IMerklDistributor.rewardTokenMinAmounts.selector, address(oeth)),
            abi.encode(uint256(1e10))
        );

        // Mock acceptConditions on merkl distributor (called during initialize)
        vm.mockCall(
            mockMerklDistributor, abi.encodeWithSelector(IMerklDistributor.acceptConditions.selector), abi.encode()
        );

        // Deploy via BeaconProxy with initialize data
        bytes memory initData = abi.encodeWithSelector(
            PoolBoosterMerklV2.initialize.selector,
            DEFAULT_CAMPAIGN_DURATION,
            DEFAULT_CAMPAIGN_TYPE,
            address(oeth),
            mockMerklDistributor,
            governor,
            strategist,
            DEFAULT_CAMPAIGN_DATA
        );

        address proxy = address(new BeaconProxy(address(beacon), initData));
        boosterMerkl = PoolBoosterMerklV2(proxy);
    }

    function _approveFactoryOnRegistry() internal {
        vm.prank(governor);
        centralRegistry.approveFactory(address(factoryMerkl));
    }

    function _labelContracts() internal {
        vm.label(address(oeth), "OETH (MockERC20)");
        vm.label(address(centralRegistry), "CentralRegistry");
        vm.label(address(factoryMerkl), "FactoryMerkl");
        vm.label(address(boosterMerkl), "BoosterMerkl");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _setGovernorViaSlot(address _contract, address _governor) internal {
        vm.store(_contract, GOVERNOR_SLOT, bytes32(uint256(uint160(_governor))));
    }

    function _dealOETH(address _to, uint256 _amount) internal {
        MockERC20(address(oeth)).mint(_to, _amount);
    }

    function _mockMerklDistributor(uint256 _minAmount) internal {
        vm.mockCall(
            mockMerklDistributor,
            abi.encodeWithSelector(IMerklDistributor.rewardTokenMinAmounts.selector, address(oeth)),
            abi.encode(_minAmount)
        );
        vm.mockCall(
            mockMerklDistributor,
            abi.encodeWithSelector(IMerklDistributor.createCampaign.selector),
            abi.encode(bytes32(uint256(1)))
        );
    }

    /// @dev Build the default init data for factory-created boosters
    function _defaultInitData() internal view returns (bytes memory) {
        return abi.encodeWithSelector(
            PoolBoosterMerklV2.initialize.selector,
            DEFAULT_CAMPAIGN_DURATION,
            DEFAULT_CAMPAIGN_TYPE,
            address(oeth),
            mockMerklDistributor,
            governor,
            strategist,
            DEFAULT_CAMPAIGN_DATA
        );
    }
}
