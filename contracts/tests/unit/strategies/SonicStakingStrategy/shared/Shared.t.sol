// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies, Strategies, Tokens, Vaults} from "tests/utils/Artifacts.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockWrappedSonic} from "tests/mocks/MockWrappedSonic.sol";
import {MockSFC} from "contracts/mocks/MockSFC.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {ISonicStakingStrategy} from "contracts/interfaces/strategies/ISonicStakingStrategy.sol";

abstract contract Unit_SonicStakingStrategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES (moved from Base)
    //////////////////////////////////////////////////////

    MockWrappedSonic internal mockWrappedSonic;
    MockSFC internal mockSfc;
    IOToken internal oSonic;
    IVault internal oSonicVault;
    IProxy internal oSonicProxy;
    IProxy internal oSonicVaultProxy;
    ISonicStakingStrategy internal sonicStakingStrategy;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Deploy mocks
        mockWrappedSonic = new MockWrappedSonic();
        mockSfc = new MockSFC();

        // Deploy OSonic + OSVault through proxies
        vm.startPrank(deployer);

        IOToken oSonicImpl = IOToken(vm.deployCode(Tokens.OS));
        address oSonicVaultImpl = vm.deployCode(Vaults.OS, abi.encode(address(mockWrappedSonic)));

        oSonicProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oSonicVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oSonicProxy.initialize(
            address(oSonicImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oSonicVaultProxy), 1e27)
        );

        oSonicVaultProxy.initialize(
            address(oSonicVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oSonicProxy))
        );

        vm.stopPrank();

        oSonic = IOToken(address(oSonicProxy));
        oSonicVault = IVault(address(oSonicVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oSonicVault.unpauseCapital();
        oSonicVault.setStrategistAddr(strategist);
        oSonicVault.setMaxSupplyDiff(5e16);
        oSonicVault.setDripDuration(0);
        oSonicVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy SonicStakingStrategy
        sonicStakingStrategy = ISonicStakingStrategy(
            vm.deployCode(
                Strategies.SONIC_STAKING_STRATEGY,
                abi.encode(address(mockSfc), address(oSonicVault), address(mockWrappedSonic), address(mockSfc))
            )
        );

        // Set governor via slot
        vm.store(address(sonicStakingStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize and configure
        vm.startPrank(governor);
        sonicStakingStrategy.initialize();
        oSonicVault.approveStrategy(address(sonicStakingStrategy));
        sonicStakingStrategy.supportValidator(18);
        sonicStakingStrategy.setRegistrator(strategist);
        vm.stopPrank();

        vm.prank(strategist);
        sonicStakingStrategy.setDefaultValidatorId(18);
    }

    function _labelContracts() internal {
        vm.label(address(sonicStakingStrategy), "SonicStakingStrategy");
        vm.label(address(mockWrappedSonic), "MockWrappedSonic");
        vm.label(address(mockSfc), "MockSFC");
        vm.label(address(oSonic), "OSonic");
        vm.label(address(oSonicVault), "OSonicVault");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Mint wS tokens to a recipient by depositing native S
    function _mintWS(address to, uint256 amount) internal {
        vm.deal(address(this), address(this).balance + amount);
        mockWrappedSonic.deposit{value: amount}();
        IERC20(address(mockWrappedSonic)).transfer(to, amount);
    }

    /// @dev Mint wS to strategy then call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        _mintWS(address(sonicStakingStrategy), amount);
        vm.prank(address(oSonicVault));
        sonicStakingStrategy.deposit(address(mockWrappedSonic), amount);
    }

    /// @dev Support a validator and optionally set as default
    function _setupValidator(uint256 id) internal {
        if (!sonicStakingStrategy.isSupportedValidator(id)) {
            vm.prank(governor);
            sonicStakingStrategy.supportValidator(id);
        }
        if (sonicStakingStrategy.defaultValidatorId() != id) {
            vm.prank(strategist);
            sonicStakingStrategy.setDefaultValidatorId(id);
        }
    }

    /// @dev Allow test contract to receive native S
    receive() external payable {}
}
