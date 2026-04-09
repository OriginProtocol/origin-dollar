// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Strategies} from "tests/utils/artifacts/Strategies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

// Interfaces
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IBridgedWOETHStrategy} from "contracts/interfaces/strategies/IBridgedWOETHStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Mocks
import {MockWETH} from "contracts/mocks/MockWETH.sol";
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

abstract contract Unit_BridgedWOETHStrategy_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & PROXIES
    //////////////////////////////////////////////////////

    MockWETH internal mockWeth;
    IOToken internal oeth;
    IVault internal oethVault;
    IProxy internal oethProxy;
    IProxy internal oethVaultProxy;
    IBridgedWOETHStrategy internal bridgedWOETHStrategy;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////

    bytes32 internal constant GOVERNOR_SLOT = 0x7bea13895fa79d2831e0a9e28edede30099005a50d652d8957cf8a607ee6ca4a;
    uint128 internal constant DEFAULT_MAX_PRICE_DIFF_BPS = 200;

    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    MockERC20 internal bridgedWOETH;
    address internal mockOracle;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        _labelContracts();
    }

    function _deployContracts() internal {
        // Deploy real WETH
        mockWeth = new MockWETH();
        weth = IERC20(address(mockWeth));

        // Deploy bridgedWOETH (a simple ERC20 mock — no real bridged token contract)
        bridgedWOETH = new MockERC20("Bridged WOETH", "bWOETH", 18);

        // Oracle is external — keep as mock address
        mockOracle = makeAddr("MockOracle");

        // Deploy real OETH + OETHVault
        vm.startPrank(deployer);

        IOToken oethImpl = IOToken(vm.deployCode(Tokens.OETH));
        address oethVaultImpl = vm.deployCode(Vaults.OETH, abi.encode(address(mockWeth)));

        oethProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        oethVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        oethProxy.initialize(
            address(oethImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(oethVaultProxy), 1e27)
        );

        oethVaultProxy.initialize(
            address(oethVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(oethProxy))
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

        // Deploy strategy with real vault
        bridgedWOETHStrategy = IBridgedWOETHStrategy(
            vm.deployCode(
                Strategies.BRIDGED_WOETH_STRATEGY,
                abi.encode(
                    address(0),
                    address(oethVault),
                    address(mockWeth),
                    address(bridgedWOETH),
                    address(oeth), // oethb is the real OETH token
                    mockOracle
                )
            )
        );

        // Set governor via slot
        vm.store(address(bridgedWOETHStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        // Initialize
        vm.prank(governor);
        bridgedWOETHStrategy.initialize(DEFAULT_MAX_PRICE_DIFF_BPS);

        // Approve strategy in vault and add to mint whitelist
        vm.startPrank(governor);
        oethVault.approveStrategy(address(bridgedWOETHStrategy));
        oethVault.addStrategyToMintWhitelist(address(bridgedWOETHStrategy));
        vm.stopPrank();
    }

    function _labelContracts() internal {
        vm.label(address(bridgedWOETHStrategy), "BridgedWOETHStrategy");
        vm.label(address(mockWeth), "MockWETH");
        vm.label(address(bridgedWOETH), "BridgedWOETH");
        vm.label(address(oeth), "OETH");
        vm.label(address(oethVault), "OETHVault");
        vm.label(mockOracle, "MockOracle");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _mockOraclePrice(uint256 _price) internal {
        vm.mockCall(mockOracle, abi.encodeWithSignature("price(address)", address(bridgedWOETH)), abi.encode(_price));
    }

    function _setOraclePrice(uint256 _price) internal {
        _mockOraclePrice(_price);
        bridgedWOETHStrategy.updateWOETHOraclePrice();
    }

    function _setupDeposit(address _caller, uint256 _woethAmount, uint256 _oraclePrice) internal {
        _mockOraclePrice(_oraclePrice);

        // Give caller bridgedWOETH and approve
        bridgedWOETH.mint(_caller, _woethAmount);
        vm.prank(_caller);
        bridgedWOETH.approve(address(bridgedWOETHStrategy), _woethAmount);
    }

    function _setupWithdraw(address _caller, uint256 _oethToBurn, uint256 _oraclePrice) internal {
        _mockOraclePrice(_oraclePrice);

        // Pre-mint bridgedWOETH to strategy so transfer works
        uint256 woethAmount = (_oethToBurn * 1 ether) / _oraclePrice;
        bridgedWOETH.mint(address(bridgedWOETHStrategy), woethAmount);

        // Give caller OETH by minting via vault
        vm.prank(address(oethVault));
        oeth.mint(_caller, _oethToBurn);

        // Caller approves strategy to spend OETH
        vm.prank(_caller);
        oeth.approve(address(bridgedWOETHStrategy), _oethToBurn);
    }
}
