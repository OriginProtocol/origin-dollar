// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {MockSwapXPair} from "tests/mocks/MockSwapXPair.sol";
import {MockSwapXGauge} from "tests/mocks/MockSwapXGauge.sol";
import {OETH} from "contracts/token/OETH.sol";
import {OETHVault} from "contracts/vault/OETHVault.sol";
import {OETHProxy, OETHVaultProxy} from "contracts/proxies/Proxies.sol";
import {OETHSupernovaAMOStrategy} from "contracts/strategies/algebra/OETHSupernovaAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

abstract contract Unit_OETHSupernovaAMOStrategy_Shared_Test is Base {
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
        // Deploy MockWETH
        mockWeth = new MockWETH();

        // Deploy OETH + OETHVault through proxies
        vm.startPrank(deployer);

        OETH oethImpl = new OETH();
        OETHVault oethVaultImpl = new OETHVault(address(mockWeth));

        oethProxy = new OETHProxy();
        oethVaultProxy = new OETHVaultProxy();

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = OETH(address(oethProxy));
        oethVault = OETHVault(address(oethVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Deploy SwapX mocks: token0=WETH, token1=OETH
        mockSwapXPair = new MockSwapXPair(address(mockWeth), address(oeth));
        swpxToken = new MockERC20("Supernova", "SUPERNOVA", 18);
        mockSwapXGauge = new MockSwapXGauge(address(mockSwapXPair), address(swpxToken));

        // Deploy OETHSupernovaAMOStrategy
        oethSupernovaAMOStrategy = new OETHSupernovaAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(mockSwapXPair), vaultAddress: address(oethVault)
            }),
            address(mockSwapXGauge)
        );

        // Set governor via slot
        vm.store(address(oethSupernovaAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(swpxToken);
        vm.prank(governor);
        oethSupernovaAMOStrategy.initialize(rewardTokens, DEFAULT_MAX_DEPEG);

        // Register strategy
        vm.startPrank(governor);
        oethVault.approveStrategy(address(oethSupernovaAMOStrategy));
        oethVault.addStrategyToMintWhitelist(address(oethSupernovaAMOStrategy));
        vm.stopPrank();

        // Set harvester
        harvester = makeAddr("Harvester");
        vm.prank(governor);
        oethSupernovaAMOStrategy.setHarvesterAddress(harvester);

        // Seed pool with initial reserves for price checks to work
        _setupPoolReserves(100 ether, 100 ether);
    }

    function _labelContracts() internal {
        vm.label(address(oethSupernovaAMOStrategy), "OETHSupernovaAMOStrategy");
        vm.label(address(mockSwapXPair), "MockSwapXPair");
        vm.label(address(mockSwapXGauge), "MockSwapXGauge");
        vm.label(address(swpxToken), "SupernovaToken");
        vm.label(address(mockWeth), "MockWETH");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(harvester, "Harvester");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH to strategy then call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        deal(address(mockWeth), address(oethSupernovaAMOStrategy), amount);
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.deposit(address(mockWeth), amount);
    }

    /// @dev Set pool reserves: deal WETH to pool, adjust OETH in pool to match, set reserves.
    /// Handles idempotent calls by only minting/burning the difference in OETH.
    function _setupPoolReserves(uint256 wethR, uint256 oethR) internal {
        deal(address(mockWeth), address(mockSwapXPair), wethR);

        uint256 currentOethBalance = IERC20(address(oeth)).balanceOf(address(mockSwapXPair));
        if (oethR > currentOethBalance) {
            vm.prank(address(oethVault));
            oeth.mint(address(mockSwapXPair), oethR - currentOethBalance);
        } else if (currentOethBalance > oethR) {
            vm.prank(address(oethVault));
            oeth.burn(address(mockSwapXPair), currentOethBalance - oethR);
        }
        mockSwapXPair.setReserves(wethR, oethR);
    }

    /// @dev Seed the vault with WETH to ensure solvency
    function _seedVaultForSolvency(uint256 amount) internal {
        deal(address(mockWeth), address(oethVault), amount);
    }
}
