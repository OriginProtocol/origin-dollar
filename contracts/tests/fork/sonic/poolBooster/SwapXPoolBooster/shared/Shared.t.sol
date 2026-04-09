// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";
import {PoolBoosters} from "tests/utils/Artifacts.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {IPoolBoostCentralRegistryFull} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistryFull.sol";
import {IPoolBoosterFactorySwapxDouble} from "contracts/interfaces/poolBooster/IPoolBoosterFactorySwapxDouble.sol";
import {IPoolBoosterFactorySwapxSingle} from "contracts/interfaces/poolBooster/IPoolBoosterFactorySwapxSingle.sol";
import {IPoolBoosterSwapxDouble} from "contracts/interfaces/poolBooster/IPoolBoosterSwapxDouble.sol";
import {IPoolBoosterSwapxSingle} from "contracts/interfaces/poolBooster/IPoolBoosterSwapxSingle.sol";

abstract contract Fork_SwapXPoolBooster_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IERC20 internal oSonic;
    IPoolBoostCentralRegistryFull internal centralRegistry;
    IPoolBoosterFactorySwapxDouble internal factorySwapxDouble;
    IPoolBoosterFactorySwapxSingle internal factorySwapxSingle;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkSonic();
        _deployFreshContracts();
        _labelContracts();
    }

    function _deployFreshContracts() internal {
        // 1. Deploy fresh MockERC20 cast into the Base-declared oSonic variable
        oSonic = IERC20(address(new MockERC20("Origin Sonic", "OS", 18)));

        // 2. Deploy PoolBoostCentralRegistry and set governor via storage slot
        centralRegistry = IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        vm.store(address(centralRegistry), GOVERNOR_SLOT, bytes32(uint256(uint160(Sonic.timelock))));

        // 3. Deploy SwapX Double factory
        factorySwapxDouble = IPoolBoosterFactorySwapxDouble(
            vm.deployCode(
                PoolBoosters.POOL_BOOSTER_FACTORY_SWAPX_DOUBLE,
                abi.encode(address(oSonic), Sonic.timelock, address(centralRegistry))
            )
        );

        // 4. Deploy SwapX Single factory
        factorySwapxSingle = IPoolBoosterFactorySwapxSingle(
            vm.deployCode(
                PoolBoosters.POOL_BOOSTER_FACTORY_SWAPX_SINGLE,
                abi.encode(address(oSonic), Sonic.timelock, address(centralRegistry))
            )
        );

        // 5. Approve both factories on registry
        vm.startPrank(Sonic.timelock);
        centralRegistry.approveFactory(address(factorySwapxDouble));
        centralRegistry.approveFactory(address(factorySwapxSingle));
        vm.stopPrank();
    }

    function _labelContracts() internal {
        vm.label(address(oSonic), "OS (MockERC20)");
        vm.label(address(centralRegistry), "CentralRegistry");
        vm.label(address(factorySwapxDouble), "FactorySwapxDouble");
        vm.label(address(factorySwapxSingle), "FactorySwapxSingle");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Whitelist the mock OS token on a SwapX bribe contract by setting
    ///      isRewardToken[oSonic] = true in storage slot 3.
    function _whitelistOnBribe(address _bribeContract) internal {
        bytes32 slot = keccak256(abi.encode(address(oSonic), uint256(3)));
        vm.store(_bribeContract, slot, bytes32(uint256(1)));
    }

    function _dealOSToken(address _to, uint256 _amount) internal {
        MockERC20(address(oSonic)).mint(_to, _amount);
    }

    function _createDoubleBooster(address _bribeOS, address _bribeOther, address _pool, uint256 _split, uint256 _salt)
        internal
        returns (IPoolBoosterSwapxDouble)
    {
        vm.prank(Sonic.timelock);
        factorySwapxDouble.createPoolBoosterSwapxDouble(_bribeOS, _bribeOther, _pool, _split, _salt);

        uint256 count = factorySwapxDouble.poolBoosterLength();
        (address boosterAddr,,) = factorySwapxDouble.poolBoosters(count - 1);
        return IPoolBoosterSwapxDouble(boosterAddr);
    }

    function _createSingleBooster(address _bribe, address _pool, uint256 _salt)
        internal
        returns (IPoolBoosterSwapxSingle)
    {
        vm.prank(Sonic.timelock);
        factorySwapxSingle.createPoolBoosterSwapxSingle(_bribe, _pool, _salt);

        uint256 count = factorySwapxSingle.poolBoosterLength();
        (address boosterAddr,,) = factorySwapxSingle.poolBoosters(count - 1);
        return IPoolBoosterSwapxSingle(boosterAddr);
    }
}
