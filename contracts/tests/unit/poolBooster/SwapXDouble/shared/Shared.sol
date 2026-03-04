// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";
import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";
import {IBribe} from "contracts/interfaces/poolBooster/ISwapXAlgebraBribe.sol";

import {OSonic} from "contracts/token/OSonic.sol";
import {PoolBoostCentralRegistry} from "contracts/poolBooster/PoolBoostCentralRegistry.sol";
import {PoolBoosterFactorySwapxDouble} from "contracts/poolBooster/PoolBoosterFactorySwapxDouble.sol";
import {PoolBoosterSwapxDouble} from "contracts/poolBooster/PoolBoosterSwapxDouble.sol";

abstract contract Unit_SwapXDouble_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    uint256 internal constant DEFAULT_SPLIT = 50e16; // 50%

    //////////////////////////////////////////////////////
    /// --- MOCK ADDRESSES
    //////////////////////////////////////////////////////

    address internal mockBribeContractOS;
    address internal mockBribeContractOther;
    address internal mockAmmPool;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createMockAddresses();
        _deployOSonic();
        _deployCentralRegistry();
        _deployFactory();
        _deployStandaloneBooster();
        _approveFactoryOnRegistry();
        _labelContracts();
    }

    function _createMockAddresses() internal {
        mockBribeContractOS = makeAddr("MockBribeContractOS");
        mockBribeContractOther = makeAddr("MockBribeContractOther");
        mockAmmPool = makeAddr("MockAmmPool");
    }

    function _deployOSonic() internal {
        oSonic = OSonic(address(new MockERC20("Origin Sonic", "OS", 18)));
    }

    function _deployCentralRegistry() internal {
        centralRegistry = new PoolBoostCentralRegistry();
        _setGovernorViaSlot(address(centralRegistry), governor);
    }

    function _deployFactory() internal {
        factorySwapxDouble = new PoolBoosterFactorySwapxDouble(
            address(oSonic),
            governor,
            address(centralRegistry)
        );
    }

    function _deployStandaloneBooster() internal {
        boosterSwapxDouble = new PoolBoosterSwapxDouble(
            mockBribeContractOS,
            mockBribeContractOther,
            address(oSonic),
            DEFAULT_SPLIT
        );
    }

    function _approveFactoryOnRegistry() internal {
        vm.prank(governor);
        centralRegistry.approveFactory(address(factorySwapxDouble));
    }

    function _labelContracts() internal {
        vm.label(address(oSonic), "OSonic (MockERC20)");
        vm.label(address(centralRegistry), "CentralRegistry");
        vm.label(address(factorySwapxDouble), "FactorySwapxDouble");
        vm.label(address(boosterSwapxDouble), "BoosterSwapxDouble");
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

    function _mockBribeNotifyRewardAmount(address _bribeContract) internal {
        vm.mockCall(
            _bribeContract,
            abi.encodeWithSelector(IBribe.notifyRewardAmount.selector),
            abi.encode()
        );
    }
}
