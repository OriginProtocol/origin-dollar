// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {ICampaignRemoteManager} from "contracts/interfaces/ICampaignRemoteManager.sol";
import {ICreateX} from "contracts/interfaces/ICreateX.sol";

import {OETH} from "contracts/token/OETH.sol";
import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";
import {CurvePoolBooster} from "contracts/poolBooster/curve/CurvePoolBooster.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {CurvePoolBoosterFactory} from "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol";
import {MockCreateX} from "tests/mocks/MockCreateX.sol";

abstract contract Unit_Curve_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    uint16 internal constant DEFAULT_FEE = 1000; // 10%

    //////////////////////////////////////////////////////
    /// --- MOCK ADDRESSES
    //////////////////////////////////////////////////////

    address internal mockCampaignRemoteManager;
    address internal mockVotemarket;
    address internal mockFeeCollector;
    address internal mockGauge;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createMockAddresses();
        _deployOETH();
        _deployCentralRegistry();
        _deployCurvePoolBooster();
        _deployCurvePoolBoosterFactory();
        _approveFactoryOnRegistry();
        _labelContracts();
    }

    function _createMockAddresses() internal {
        mockCampaignRemoteManager = makeAddr("MockCampaignRemoteManager");
        mockVotemarket = makeAddr("MockVotemarket");
        mockFeeCollector = makeAddr("MockFeeCollector");
        mockGauge = makeAddr("MockGauge");
    }

    function _deployOETH() internal {
        oeth = OETH(address(new MockERC20("Origin Ether", "OETH", 18)));
    }

    function _deployCentralRegistry() internal {
        centralRegistry = new PoolBoostCentralRegistry();
        _setGovernorViaSlot(address(centralRegistry), governor);
    }

    function _deployCurvePoolBooster() internal {
        curvePoolBoosterPlain = new CurvePoolBoosterPlain(address(oeth), mockGauge);
        curvePoolBoosterPlain.initialize(
            governor, strategist, DEFAULT_FEE, mockFeeCollector, mockCampaignRemoteManager, mockVotemarket
        );
    }

    function _deployCurvePoolBoosterFactory() internal {
        curvePoolBoosterFactory = new CurvePoolBoosterFactory();
        curvePoolBoosterFactory.initialize(governor, strategist, address(centralRegistry));

        _deployMockCreateX();
    }

    function _approveFactoryOnRegistry() internal {
        vm.prank(governor);
        centralRegistry.approveFactory(address(curvePoolBoosterFactory));
    }

    function _labelContracts() internal {
        vm.label(address(oeth), "OETH (MockERC20)");
        vm.label(address(centralRegistry), "CentralRegistry");
        vm.label(address(curvePoolBoosterPlain), "CurvePoolBoosterPlain");
        vm.label(address(curvePoolBoosterFactory), "CurvePoolBoosterFactory");
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

    function _mockCampaignRemoteManager() internal {
        vm.mockCall(
            mockCampaignRemoteManager,
            abi.encodeWithSelector(ICampaignRemoteManager.createCampaign.selector),
            abi.encode()
        );
        vm.mockCall(
            mockCampaignRemoteManager,
            abi.encodeWithSelector(ICampaignRemoteManager.manageCampaign.selector),
            abi.encode()
        );
        vm.mockCall(
            mockCampaignRemoteManager,
            abi.encodeWithSelector(ICampaignRemoteManager.closeCampaign.selector),
            abi.encode()
        );
    }

    function _deployMockCreateX() internal {
        address createXAddr = 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed;
        mockCreateX = new MockCreateX();
        vm.etch(createXAddr, address(mockCreateX).code);
    }
}
