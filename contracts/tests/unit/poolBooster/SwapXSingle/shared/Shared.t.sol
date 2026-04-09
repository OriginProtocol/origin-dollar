// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {PoolBoosters} from "tests/utils/artifacts/PoolBoosters.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";
import {IPoolBoosterFactorySwapxSingle} from "contracts/interfaces/poolBooster/IPoolBoosterFactorySwapxSingle.sol";
import {IPoolBoosterSwapxSingle} from "contracts/interfaces/poolBooster/IPoolBoosterSwapxSingle.sol";
import {IBribe} from "contracts/interfaces/poolBooster/ISwapXAlgebraBribe.sol";

abstract contract Unit_SwapXSingle_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////
    IERC20 internal oSonic;
    IPoolBoostCentralRegistryFull internal centralRegistry;
    IPoolBoosterFactorySwapxSingle internal factorySwapxSingle;
    IPoolBoosterSwapxSingle internal boosterSwapxSingle;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    //////////////////////////////////////////////////////
    /// --- MOCK ADDRESSES
    //////////////////////////////////////////////////////

    address internal mockBribeContract;
    address internal mockAmmPool;
    address internal mockAmmPool2;

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
        mockBribeContract = makeAddr("MockBribeContract");
        mockAmmPool = makeAddr("MockAmmPool");
        mockAmmPool2 = makeAddr("MockAmmPool2");
    }

    function _deployOSonic() internal {
        oSonic = IERC20(address(new MockERC20("Origin Sonic", "OS", 18)));
    }

    function _deployCentralRegistry() internal {
        centralRegistry = IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        _setGovernorViaSlot(address(centralRegistry), governor);
    }

    function _deployFactory() internal {
        factorySwapxSingle = IPoolBoosterFactorySwapxSingle(
            vm.deployCode(
                PoolBoosters.POOL_BOOSTER_FACTORY_SWAPX_SINGLE,
                abi.encode(address(oSonic), governor, address(centralRegistry))
            )
        );
    }

    function _deployStandaloneBooster() internal {
        boosterSwapxSingle = IPoolBoosterSwapxSingle(
            vm.deployCode(PoolBoosters.POOL_BOOSTER_SWAPX_SINGLE, abi.encode(mockBribeContract, address(oSonic)))
        );
    }

    function _approveFactoryOnRegistry() internal {
        vm.prank(governor);
        centralRegistry.approveFactory(address(factorySwapxSingle));
    }

    function _labelContracts() internal {
        vm.label(address(oSonic), "OSonic (MockERC20)");
        vm.label(address(centralRegistry), "CentralRegistry");
        vm.label(address(factorySwapxSingle), "FactorySwapxSingle");
        vm.label(address(boosterSwapxSingle), "BoosterSwapxSingle");
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
        vm.mockCall(_bribeContract, abi.encodeWithSelector(IBribe.notifyRewardAmount.selector), abi.encode());
    }

    /// @dev Creates a pool booster via the SwapxSingle factory and returns its address
    function _createSwapxSingleBooster(address _bribeAddress, address _pool, uint256 _salt) internal returns (address) {
        vm.prank(governor);
        factorySwapxSingle.createPoolBoosterSwapxSingle(_bribeAddress, _pool, _salt);
        uint256 len = factorySwapxSingle.poolBoosterLength();
        (address boosterAddr,,) = factorySwapxSingle.poolBoosters(len - 1);
        return boosterAddr;
    }
}
