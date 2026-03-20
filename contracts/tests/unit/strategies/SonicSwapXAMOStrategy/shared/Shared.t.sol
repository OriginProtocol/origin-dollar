// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockWrappedSonic} from "tests/mocks/MockWrappedSonic.sol";
import {MockSwapXPair} from "tests/mocks/MockSwapXPair.sol";
import {MockSwapXGauge} from "tests/mocks/MockSwapXGauge.sol";
import {OSonic} from "contracts/token/OSonic.sol";
import {OSVault} from "contracts/vault/OSVault.sol";
import {OSonicProxy, OSonicVaultProxy} from "contracts/proxies/SonicProxies.sol";
import {SonicSwapXAMOStrategy} from "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

abstract contract Unit_SonicSwapXAMOStrategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    uint256 internal constant DEFAULT_MAX_DEPEG = 0.01e18; // 1%

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    address internal harvester;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Deploy MockWrappedSonic
        mockWrappedSonic = new MockWrappedSonic();

        // Deploy OSonic + OSVault through proxies
        vm.startPrank(deployer);

        OSonic oSonicImpl = new OSonic();
        OSVault oSonicVaultImpl = new OSVault(address(mockWrappedSonic));

        oSonicProxy = new OSonicProxy();
        oSonicVaultProxy = new OSonicVaultProxy();

        oSonicProxy.initialize(
            address(oSonicImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oSonicVaultProxy), 1e27)
        );

        oSonicVaultProxy.initialize(
            address(oSonicVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oSonicProxy))
        );

        vm.stopPrank();

        oSonic = OSonic(address(oSonicProxy));
        oSonicVault = OSVault(address(oSonicVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oSonicVault.unpauseCapital();
        oSonicVault.setStrategistAddr(strategist);
        oSonicVault.setMaxSupplyDiff(5e16);
        oSonicVault.setDripDuration(0);
        oSonicVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy SwapX mocks: token0=wS, token1=OS
        mockSwapXPair = new MockSwapXPair(address(mockWrappedSonic), address(oSonic));
        swpxToken = new MockERC20("SwapX", "SWPx", 18);
        mockSwapXGauge = new MockSwapXGauge(address(mockSwapXPair), address(swpxToken));

        // Deploy SonicSwapXAMOStrategy
        sonicSwapXAMOStrategy = new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(mockSwapXPair), vaultAddress: address(oSonicVault)
            }),
            address(mockSwapXGauge)
        );

        // Set governor via slot
        vm.store(address(sonicSwapXAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(swpxToken);
        vm.prank(governor);
        sonicSwapXAMOStrategy.initialize(rewardTokens, DEFAULT_MAX_DEPEG);

        // Register strategy
        vm.startPrank(governor);
        oSonicVault.approveStrategy(address(sonicSwapXAMOStrategy));
        oSonicVault.addStrategyToMintWhitelist(address(sonicSwapXAMOStrategy));
        vm.stopPrank();

        // Set harvester
        harvester = makeAddr("Harvester");
        vm.prank(governor);
        sonicSwapXAMOStrategy.setHarvesterAddress(harvester);

        // Seed pool with initial reserves for price checks to work
        _setupPoolReserves(100 ether, 100 ether);
    }

    function _labelContracts() internal {
        vm.label(address(sonicSwapXAMOStrategy), "SonicSwapXAMOStrategy");
        vm.label(address(mockSwapXPair), "MockSwapXPair");
        vm.label(address(mockSwapXGauge), "MockSwapXGauge");
        vm.label(address(swpxToken), "SWPx");
        vm.label(address(mockWrappedSonic), "MockWrappedSonic");
        vm.label(address(oSonic), "OSonic");
        vm.label(address(oSonicVault), "OSonicVault");
        vm.label(harvester, "Harvester");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal wS to strategy then call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        deal(address(mockWrappedSonic), address(sonicSwapXAMOStrategy), amount);
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.deposit(address(mockWrappedSonic), amount);
    }

    /// @dev Set pool reserves: deal wS to pool, adjust OS in pool to match, set reserves.
    /// Handles idempotent calls by only minting/burning the difference in OS.
    function _setupPoolReserves(uint256 wsR, uint256 osR) internal {
        deal(address(mockWrappedSonic), address(mockSwapXPair), wsR);

        uint256 currentOsBalance = IERC20(address(oSonic)).balanceOf(address(mockSwapXPair));
        if (osR > currentOsBalance) {
            vm.prank(address(oSonicVault));
            oSonic.mint(address(mockSwapXPair), osR - currentOsBalance);
        } else if (currentOsBalance > osR) {
            vm.prank(address(oSonicVault));
            oSonic.burn(address(mockSwapXPair), currentOsBalance - osR);
        }
        mockSwapXPair.setReserves(wsR, osR);
    }

    /// @dev Seed the vault with wS to ensure solvency
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(address(mockWrappedSonic), address(oSonicVault), amount);
    }
}
