// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseFork} from "tests/fork/BaseFork.t.sol";
import {Sonic} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OSonic} from "contracts/token/OSonic.sol";
import {OSVault} from "contracts/vault/OSVault.sol";
import {OSonicProxy, OSonicVaultProxy} from "contracts/proxies/SonicProxies.sol";
import {SonicSwapXAMOStrategy} from "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";
import {IPair} from "contracts/interfaces/algebra/IAlgebraPair.sol";
import {IGauge} from "contracts/interfaces/algebra/IAlgebraGauge.sol";
import {IWrappedSonic} from "contracts/interfaces/sonic/IWrappedSonic.sol";

abstract contract Fork_SonicSwapXAMOStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    uint256 internal constant DEFAULT_MAX_DEPEG = 0.01 ether; // 1%

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    OSonic internal oSonic;
    OSVault internal oSonicVault;
    OSonicProxy internal oSonicProxy;
    OSonicVaultProxy internal oSonicVaultProxy;
    SonicSwapXAMOStrategy internal sonicSwapXAMOStrategy;
    IPair internal swapXPool;
    IGauge internal swapXGauge;
    IERC20 internal wrappedSonic;
    IERC20 internal swpx;
    address internal harvester;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkSonic();
        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Assign from fork
        wrappedSonic = IERC20(Sonic.wS);
        swpx = IERC20(Sonic.SWPx);

        // Deploy fresh OSonic + OSVault
        vm.startPrank(deployer);

        OSonic oSonicImpl = new OSonic();
        OSVault oSonicVaultImpl = new OSVault(Sonic.wS);

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
        oSonicVault = OSVault(payable(address(oSonicVaultProxy)));

        // Configure vault
        vm.startPrank(governor);
        oSonicVault.unpauseCapital();
        oSonicVault.setStrategistAddr(strategist);
        oSonicVault.setMaxSupplyDiff(5e16);
        oSonicVault.setDripDuration(0);
        oSonicVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Fund clement with wS
        vm.deal(clement, 100_000_000 ether);
        vm.prank(clement);
        IWrappedSonic(Sonic.wS).deposit{value: 100_000_000 ether}();

        // Create fresh SwapX pool via factory
        // wS (0x039e...) should be lower than fresh OSonic proxy → token0=wS, token1=OS
        require(Sonic.wS < address(oSonic), "wS must be token0");

        (bool success, bytes memory data) = Sonic.SwapXPairFactory
            .call(abi.encodeWithSignature("createPair(address,address,bool)", Sonic.wS, address(oSonic), true));
        require(success, "Pool creation failed");
        swapXPool = IPair(abi.decode(data, (address)));

        // Create fresh gauge via Voter
        (success, data) = Sonic.SwapXVoter
            .call(abi.encodeWithSignature("createGauge(address,uint256)", address(swapXPool), uint256(0)));
        if (!success) {
            vm.prank(Sonic.SwapXOwner);
            (success, data) = Sonic.SwapXVoter
                .call(abi.encodeWithSignature("createGauge(address,uint256)", address(swapXPool), uint256(0)));
            require(success, "Gauge creation failed");
        }
        (address gaugeAddr,,) = abi.decode(data, (address, address, address));
        swapXGauge = IGauge(gaugeAddr);

        // Seed pool with initial balanced liquidity
        uint256 initialLiquidity = 1_000_000 ether;
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(swapXPool), initialLiquidity);
        vm.prank(address(oSonicVault));
        oSonic.mint(address(swapXPool), initialLiquidity);
        swapXPool.mint(address(0xdead)); // Mint base LP to dead address

        // Deploy fresh SonicSwapXAMOStrategy
        sonicSwapXAMOStrategy = new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(swapXPool), vaultAddress: address(oSonicVault)
            }),
            address(swapXGauge)
        );

        // Set governor via storage slot
        vm.store(address(sonicSwapXAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize strategy
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = Sonic.SWPx;
        vm.prank(governor);
        sonicSwapXAMOStrategy.initialize(rewardTokens, DEFAULT_MAX_DEPEG);

        // Register strategy in vault
        vm.startPrank(governor);
        oSonicVault.approveStrategy(address(sonicSwapXAMOStrategy));
        oSonicVault.addStrategyToMintWhitelist(address(sonicSwapXAMOStrategy));
        vm.stopPrank();

        // Set harvester
        harvester = makeAddr("Harvester");
        vm.prank(governor);
        sonicSwapXAMOStrategy.setHarvesterAddress(harvester);

        // Seed vault for solvency
        _seedVaultForSolvency(5_000_000 ether);
    }

    function _labelContracts() internal {
        vm.label(address(sonicSwapXAMOStrategy), "SonicSwapXAMOStrategy");
        vm.label(address(swapXPool), "SwapXPool");
        vm.label(address(swapXGauge), "SwapXGauge");
        vm.label(Sonic.SWPx, "SWPx");
        vm.label(Sonic.wS, "wS");
        vm.label(address(oSonic), "OSonic");
        vm.label(address(oSonicVault), "OSonicVault");
        vm.label(harvester, "Harvester");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Transfer wS to strategy then call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), amount);
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.deposit(Sonic.wS, amount);
    }

    /// @dev Transfer wS to strategy then call depositAll as vault
    function _depositAllAsVault(uint256 amount) internal {
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(sonicSwapXAMOStrategy), amount);
        vm.prank(address(oSonicVault));
        sonicSwapXAMOStrategy.depositAll();
    }

    /// @dev Seed the vault with wS to ensure solvency
    function _seedVaultForSolvency(uint256 amount) internal {
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(oSonicVault), amount);
    }

    /// @dev Balance the pool by adding tokens to the side with less
    function _balancePool() internal {
        (uint256 wsReserves, uint256 osReserves,) = swapXPool.getReserves();
        if (wsReserves > osReserves) {
            uint256 diff = wsReserves - osReserves;
            // Mint OS directly to pool
            vm.prank(address(oSonicVault));
            oSonic.mint(address(swapXPool), diff);
            swapXPool.sync();
        } else if (osReserves > wsReserves) {
            uint256 diff = osReserves - wsReserves;
            vm.prank(clement);
            IERC20(Sonic.wS).transfer(address(swapXPool), diff);
            swapXPool.sync();
        }
    }

    /// @dev Tilt pool toward more OS (pool gets more OS, less balanced)
    function _tiltPoolToMoreOS(uint256 amount) internal {
        vm.prank(address(oSonicVault));
        oSonic.mint(address(swapXPool), amount);
        swapXPool.sync();
    }

    /// @dev Tilt pool toward more wS (pool gets more wS, less balanced)
    function _tiltPoolToMoreWS(uint256 amount) internal {
        vm.prank(clement);
        IERC20(Sonic.wS).transfer(address(swapXPool), amount);
        swapXPool.sync();
    }

    /// @dev Swap tokens in the pool. tokenIn is transferred from clement.
    function _swapTokensInPool(address tokenIn, uint256 amountIn) internal returns (uint256 amountOut) {
        amountOut = swapXPool.getAmountOut(amountIn, tokenIn);
        vm.prank(clement);
        IERC20(tokenIn).transfer(address(swapXPool), amountIn);
        if (tokenIn == Sonic.wS) {
            // wS in (token0), OS out (token1)
            swapXPool.swap(0, amountOut, clement, "");
        } else {
            // OS in (token1), wS out (token0)
            swapXPool.swap(amountOut, 0, clement, "");
        }
    }

    /// @dev Mint OS for clement directly
    function _mintOSForClement(uint256 amount) internal {
        vm.prank(address(oSonicVault));
        oSonic.mint(clement, amount);
    }

    /// @dev Make the vault insolvent by minting unbacked OS
    function _makeInsolvent() internal {
        // Deposit a little to the strategy first
        _depositAsVault(100 ether);

        // Mint enough unbacked OS to push backing ratio below 0.998
        // Need: totalValue * 1e18 / (totalSupply + extra) < 0.998e18
        uint256 totalValue = oSonicVault.totalValue();
        uint256 totalSupply = oSonic.totalSupply();
        // extra = totalValue * 1e18 / 0.998e18 - totalSupply + buffer
        uint256 targetSupply = (totalValue * 1e18) / 0.998 ether;
        uint256 extraNeeded = targetSupply > totalSupply ? targetSupply - totalSupply : 0;
        vm.prank(address(oSonicVault));
        oSonic.mint(alice, extraNeeded + 100 ether);
    }
}
