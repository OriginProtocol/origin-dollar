// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseFork} from "tests/fork/BaseFork.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IPair} from "contracts/interfaces/algebra/IAlgebraPair.sol";
import {IGauge} from "contracts/interfaces/algebra/IAlgebraGauge.sol";
import {IOETHSupernovaAMOStrategy} from "contracts/interfaces/strategies/IOETHSupernovaAMOStrategy.sol";

abstract contract Fork_OETHSupernovaAMOStrategy_Shared_Test is BaseFork {
    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    uint256 internal constant DEFAULT_MAX_DEPEG = 0.01 ether; // 1%

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IOToken internal oeth;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;
    IOETHSupernovaAMOStrategy internal oethSupernovaAMOStrategy;
    IPair internal supernovaPool;
    IGauge internal supernovaGauge;
    IERC20 internal wethToken;
    IERC20 internal supernovaRewardToken;
    address internal harvester;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkMainnet();
        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Assign from fork
        wethToken = IERC20(Mainnet.WETH);
        supernovaRewardToken = IERC20(Mainnet.supernovaToken);

        // Deploy fresh OETH + OETHVault
        vm.startPrank(deployer);

        address oethImpl = vm.deployCode(Tokens.OETH);
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(Mainnet.WETH));

        oethProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethProxy.initialize(
            oethImpl, governor, abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            oethVaultImpl, governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
        );

        vm.stopPrank();

        oeth = IOToken(address(oethProxy));
        oethVault = IVault(address(oethVaultProxy));

        // Configure vault
        vm.startPrank(governor);
        oethVault.unpauseCapital();
        oethVault.setStrategistAddr(strategist);
        oethVault.setMaxSupplyDiff(5e16);
        oethVault.setDripDuration(0);
        oethVault.setRebaseRateMax(200e18);
        vm.stopPrank();

        // Fund clement with WETH
        deal(Mainnet.WETH, clement, 100_000_000 ether);

        // --- Create fresh Supernova pool via factory ---
        // The Supernova factory requires authorization. The feeManager can add
        // authorized accounts via addAuthorizedAccount(). We prank as feeManager
        // to authorize the deployer, then create the pair.
        address factoryFeeManager = _getFactoryFeeManager();
        bool ok;
        bytes memory data;

        vm.prank(factoryFeeManager);
        (ok,) = Mainnet.supernovaPairFactory.call(abi.encodeWithSignature("addAuthorizedAccount(address)", deployer));
        require(ok, "addAuthorizedAccount failed");

        vm.prank(deployer);
        (ok, data) = Mainnet.supernovaPairFactory
            .call(abi.encodeWithSignature("createPair(address,address,bool)", Mainnet.WETH, address(oeth), true));
        require(ok, "Pool creation failed");
        supernovaPool = IPair(abi.decode(data, (address)));

        // --- Create fresh gauge via gauge manager ---
        // createGauge requires the pool to be registered in the factory (it is
        // now) and can be called by the gauge manager owner.
        address gaugeManagerOwner = _getGaugeManagerOwner();

        // Whitelist the fresh OETH token in the gauge manager's tokenHandler
        // so createGauge doesn't revert with "!WHITELISTED".
        address tokenHandler;
        (, data) = Mainnet.supernovaGaugeManager.staticcall(abi.encodeWithSignature("tokenHandler()"));
        tokenHandler = abi.decode(data, (address));

        address tokenHandlerOwner;
        (, data) = tokenHandler.staticcall(abi.encodeWithSignature("owner()"));
        tokenHandlerOwner = abi.decode(data, (address));

        // whitelistToken requires GOVERNANCE role. Directly set the
        // isWhitelisted mapping (slot 1) via vm.store.
        bytes32 whitelistSlot = keccak256(abi.encode(address(oeth), uint256(1)));
        vm.store(tokenHandler, whitelistSlot, bytes32(uint256(1)));

        // Create gauge — the gauge manager owner can call createGauge
        vm.prank(gaugeManagerOwner);
        (ok, data) = Mainnet.supernovaGaugeManager
            .call(abi.encodeWithSignature("createGauge(address,uint256)", address(supernovaPool), uint256(0)));
        if (!ok) {
            assembly {
                revert(add(data, 32), mload(data))
            }
        }
        // createGauge returns (gauge, internalBribe, externalBribe)
        (address gaugeAddr,,) = abi.decode(data, (address, address, address));
        supernovaGauge = IGauge(gaugeAddr);

        // Seed pool with initial balanced liquidity
        uint256 initialLiquidity = 1_000_000 ether;
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(supernovaPool), initialLiquidity);
        vm.prank(address(oethVault));
        oeth.mint(address(supernovaPool), initialLiquidity);
        supernovaPool.mint(address(0xdead)); // Mint base LP to dead address

        // Deploy fresh OETHSupernovaAMOStrategy
        oethSupernovaAMOStrategy = IOETHSupernovaAMOStrategy(
            vm.deployCode(
                Strategies.OETH_SUPERNOVA_AMO_STRATEGY,
                abi.encode(address(supernovaPool), address(oethVault), address(supernovaGauge))
            )
        );

        // Set governor via storage slot
        vm.store(address(oethSupernovaAMOStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize strategy
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = Mainnet.supernovaToken;
        vm.prank(governor);
        oethSupernovaAMOStrategy.initialize(rewardTokens, DEFAULT_MAX_DEPEG);

        // Register strategy in vault
        vm.startPrank(governor);
        oethVault.approveStrategy(address(oethSupernovaAMOStrategy));
        oethVault.addStrategyToMintWhitelist(address(oethSupernovaAMOStrategy));
        vm.stopPrank();

        // Set harvester
        harvester = makeAddr("Harvester");
        vm.prank(governor);
        oethSupernovaAMOStrategy.setHarvesterAddress(harvester);

        // Seed vault for solvency
        _seedVaultForSolvency(5_000_000 ether);
    }

    function _labelContracts() internal {
        vm.label(address(oethSupernovaAMOStrategy), "OETHSupernovaAMOStrategy");
        vm.label(address(supernovaPool), "SupernovaPool");
        vm.label(address(supernovaGauge), "SupernovaGauge");
        vm.label(Mainnet.supernovaToken, "SupernovaToken");
        vm.label(Mainnet.WETH, "WETH");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(harvester, "Harvester");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Transfer WETH to strategy then call deposit as vault
    function _depositAsVault(uint256 amount) internal {
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), amount);
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.deposit(Mainnet.WETH, amount);
    }

    /// @dev Transfer WETH to strategy then call depositAll as vault
    function _depositAllAsVault(uint256 amount) internal {
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethSupernovaAMOStrategy), amount);
        vm.prank(address(oethVault));
        oethSupernovaAMOStrategy.depositAll();
    }

    /// @dev Seed the vault with WETH to ensure solvency
    function _seedVaultForSolvency(uint256 amount) internal {
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(oethVault), amount);
    }

    /// @dev Balance the pool by adding tokens to the side with less
    function _balancePool() internal {
        (uint256 reserve0, uint256 reserve1,) = supernovaPool.getReserves();
        (uint256 wethReserves, uint256 oethReserves) = _orderReserves(reserve0, reserve1);
        if (wethReserves > oethReserves) {
            uint256 diff = wethReserves - oethReserves;
            vm.prank(address(oethVault));
            oeth.mint(address(supernovaPool), diff);
            supernovaPool.sync();
        } else if (oethReserves > wethReserves) {
            uint256 diff = oethReserves - wethReserves;
            vm.prank(clement);
            IERC20(Mainnet.WETH).transfer(address(supernovaPool), diff);
            supernovaPool.sync();
        }
    }

    /// @dev Tilt pool toward more OETH (pool gets more OETH, less balanced)
    function _tiltPoolToMoreOETH(uint256 amount) internal {
        vm.prank(address(oethVault));
        oeth.mint(address(supernovaPool), amount);
        supernovaPool.sync();
    }

    /// @dev Tilt pool toward more WETH (pool gets more WETH, less balanced)
    function _tiltPoolToMoreWETH(uint256 amount) internal {
        vm.prank(clement);
        IERC20(Mainnet.WETH).transfer(address(supernovaPool), amount);
        supernovaPool.sync();
    }

    /// @dev Swap tokens in the pool. tokenIn is transferred from clement.
    function _swapTokensInPool(address tokenIn, uint256 amountIn) internal returns (uint256 amountOut) {
        amountOut = supernovaPool.getAmountOut(amountIn, tokenIn);
        vm.prank(clement);
        IERC20(tokenIn).transfer(address(supernovaPool), amountIn);

        address poolToken0 = supernovaPool.token0();
        if (tokenIn == poolToken0) {
            supernovaPool.swap(0, amountOut, clement, "");
        } else {
            supernovaPool.swap(amountOut, 0, clement, "");
        }
    }

    /// @dev Mint OETH for clement directly
    function _mintOETHForClement(uint256 amount) internal {
        vm.prank(address(oethVault));
        oeth.mint(clement, amount);
    }

    /// @dev Make the vault insolvent by minting unbacked OETH
    function _makeInsolvent() internal {
        // Deposit a little to the strategy first
        _depositAsVault(100 ether);

        // Mint enough unbacked OETH to push backing ratio below 0.998
        uint256 totalValue = oethVault.totalValue();
        uint256 totalSupply = oeth.totalSupply();
        uint256 targetSupply = (totalValue * 1e18) / 0.998 ether;
        uint256 extraNeeded = targetSupply > totalSupply ? targetSupply - totalSupply : 0;
        vm.prank(address(oethVault));
        oeth.mint(alice, extraNeeded + 100 ether);
    }

    /// @dev Order reserves so that wethReserves and oethReserves are correct
    ///      regardless of pool token ordering
    function _orderReserves(uint256 reserve0, uint256 reserve1)
        internal
        view
        returns (uint256 wethReserves, uint256 oethReserves)
    {
        if (supernovaPool.token0() == Mainnet.WETH) {
            wethReserves = reserve0;
            oethReserves = reserve1;
        } else {
            wethReserves = reserve1;
            oethReserves = reserve0;
        }
    }

    /// @dev Read the feeManager address from the Supernova factory
    function _getFactoryFeeManager() internal view returns (address) {
        (, bytes memory data) = Mainnet.supernovaPairFactory.staticcall(abi.encodeWithSignature("feeManager()"));
        return abi.decode(data, (address));
    }

    /// @dev Read the owner address from the Supernova gauge manager
    function _getGaugeManagerOwner() internal view returns (address) {
        (, bytes memory data) = Mainnet.supernovaGaugeManager.staticcall(abi.encodeWithSignature("owner()"));
        return abi.decode(data, (address));
    }
}
