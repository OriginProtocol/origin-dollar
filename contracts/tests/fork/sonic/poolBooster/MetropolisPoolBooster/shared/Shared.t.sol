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
import {IPoolBoosterFactoryMetropolis} from "contracts/interfaces/poolBooster/IPoolBoosterFactoryMetropolis.sol";
import {IPoolBoosterMetropolis} from "contracts/interfaces/poolBooster/IPoolBoosterMetropolis.sol";

/// @dev Mock rewarder that accepts fundAndBribe and pulls tokens from caller
contract MockBribeRewarder {
    IERC20 internal immutable token;

    constructor(address _token) {
        token = IERC20(_token);
    }

    function fundAndBribe(uint256, uint256, uint256 amountPerPeriod) external payable {
        // Pull tokens from the caller (the booster has approved us)
        token.transferFrom(msg.sender, address(this), amountPerPeriod);
    }
}

abstract contract Fork_MetropolisPoolBooster_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    // Real OSonic's minBribeAmount on Metropolis RewarderFactory
    uint256 internal constant METROPOLIS_MIN_BRIBE_AMOUNT = 200e18;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IERC20 internal oSonic;
    IPoolBoostCentralRegistryFull internal centralRegistry;
    IPoolBoosterFactoryMetropolis internal factoryMetropolis;

    //////////////////////////////////////////////////////
    /// --- LOCAL VARIABLES
    //////////////////////////////////////////////////////

    MockBribeRewarder internal mockRewarder;

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

        // 2. Deploy mock rewarder for bribe calls
        mockRewarder = new MockBribeRewarder(address(oSonic));

        // 3. Mock RewarderFactory to whitelist our mock token and return our mock rewarder
        vm.mockCall(
            Sonic.Metropolis_RewarderFactory,
            abi.encodeWithSignature("getWhitelistedTokenInfo(address)", address(oSonic)),
            abi.encode(true, METROPOLIS_MIN_BRIBE_AMOUNT)
        );
        vm.mockCall(
            Sonic.Metropolis_RewarderFactory,
            abi.encodeWithSignature("createBribeRewarder(address,address)", address(oSonic)),
            abi.encode(address(mockRewarder))
        );

        // 4. Deploy PoolBoostCentralRegistry and set governor via storage slot
        centralRegistry = IPoolBoostCentralRegistryFull(vm.deployCode(PoolBoosters.POOL_BOOST_CENTRAL_REGISTRY));
        vm.store(address(centralRegistry), GOVERNOR_SLOT, bytes32(uint256(uint160(Sonic.timelock))));

        // 5. Deploy Metropolis factory
        factoryMetropolis = IPoolBoosterFactoryMetropolis(
            vm.deployCode(
                PoolBoosters.POOL_BOOSTER_FACTORY_METROPOLIS,
                abi.encode(
                    address(oSonic),
                    Sonic.timelock,
                    address(centralRegistry),
                    Sonic.Metropolis_RewarderFactory,
                    Sonic.Metropolis_Voter
                )
            )
        );

        // 6. Approve factory on registry
        vm.prank(Sonic.timelock);
        centralRegistry.approveFactory(address(factoryMetropolis));
    }

    function _labelContracts() internal {
        vm.label(address(oSonic), "OS (MockERC20)");
        vm.label(address(centralRegistry), "CentralRegistry");
        vm.label(address(factoryMetropolis), "FactoryMetropolis");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _dealOSToken(address _to, uint256 _amount) internal {
        MockERC20(address(oSonic)).mint(_to, _amount);
    }

    function _createMetropolisBooster(address _pool, uint256 _salt) internal returns (IPoolBoosterMetropolis) {
        vm.prank(Sonic.timelock);
        factoryMetropolis.createPoolBoosterMetropolis(_pool, _salt);

        uint256 count = factoryMetropolis.poolBoosterLength();
        (address boosterAddr,,) = factoryMetropolis.poolBoosters(count - 1);
        return IPoolBoosterMetropolis(boosterAddr);
    }
}
