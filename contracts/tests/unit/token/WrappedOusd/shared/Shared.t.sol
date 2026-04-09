// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Proxies} from "tests/utils/artifacts/Proxies.sol";
import {Tokens} from "tests/utils/artifacts/Tokens.sol";
import {Vaults} from "tests/utils/artifacts/Vaults.sol";

// --- External libraries
// Interfaces
import {IVault} from "contracts/interfaces/IVault.sol";
import {IProxy} from "contracts/interfaces/IProxy.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IWOToken} from "contracts/interfaces/IWOToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Mocks
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

abstract contract Unit_WrappedOusd_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////
    IOToken internal ousd;
    IVault internal ousdVault;
    IProxy internal ousdProxy;
    IProxy internal ousdVaultProxy;

    IWOToken internal wrappedOusd;
    IProxy internal wrappedOusdProxy;

    //////////////////////////////////////////////////////
    /// --- CONSTANTS
    //////////////////////////////////////////////////////
    uint256 internal constant DELAY_PERIOD = 600;
    uint256 internal constant REBASE_RATE_MAX = 200e18;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////
    function setUp() public virtual override {
        super.setUp();
        vm.warp(7 days);

        _deployMockContracts();
        _deployContracts();
        _deployWrappedOusd();
        _configureContracts();
        _fundInitialUsers();
        label();
    }

    function _deployMockContracts() internal {
        usdc = IERC20(address(new MockERC20("USD Coin", "USDC", 6)));
    }

    function _deployContracts() internal {
        vm.startPrank(deployer);

        IOToken ousdImpl = IOToken(vm.deployCode(Tokens.OUSD));
        address ousdVaultImpl = vm.deployCode(Vaults.OUSD, abi.encode(address(usdc)));

        ousdProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        ousdVaultProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));

        ousdProxy.initialize(
            address(ousdImpl),
            governor,
            abi.encodeWithSignature("initialize(address,uint256)", address(ousdVaultProxy), 1e27)
        );

        ousdVaultProxy.initialize(
            address(ousdVaultImpl), governor, abi.encodeWithSignature("initialize(address)", address(ousdProxy))
        );

        vm.stopPrank();

        ousd = IOToken(address(ousdProxy));
        ousdVault = IVault(address(ousdVaultProxy));
    }

    function _deployWrappedOusd() internal {
        vm.startPrank(deployer);

        address wrappedOusdImpl = vm.deployCode(Tokens.WRAPPED_OUSD, abi.encode(address(ousd)));
        wrappedOusdProxy = IProxy(vm.deployCode(Proxies.IG_PROXY));
        wrappedOusdProxy.initialize(address(wrappedOusdImpl), governor, "");

        vm.stopPrank();

        wrappedOusd = IWOToken(address(wrappedOusdProxy));

        vm.prank(governor);
        wrappedOusd.initialize();
    }

    function _configureContracts() internal {
        vm.startPrank(governor);
        ousdVault.unpauseCapital();
        ousdVault.setStrategistAddr(strategist);
        ousdVault.setMaxSupplyDiff(5e16);
        ousdVault.setWithdrawalClaimDelay(DELAY_PERIOD);
        ousdVault.setDripDuration(0);
        ousdVault.setRebaseRateMax(REBASE_RATE_MAX);
        vm.stopPrank();
    }

    function _fundInitialUsers() internal {
        _mintOUSD(matt, 100e6);
        _mintOUSD(josh, 100e6);
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    function _dealUSDC(address to, uint256 amount) internal {
        MockERC20(address(usdc)).mint(to, amount);
    }

    function _mintOUSD(address user, uint256 usdcAmount) internal {
        _dealUSDC(user, usdcAmount);
        vm.startPrank(user);
        usdc.approve(address(ousdVault), usdcAmount);
        ousdVault.mint(usdcAmount);
        vm.stopPrank();
    }

    function _depositToWrappedOusd(address user, uint256 ousdAmount) internal returns (uint256 shares) {
        vm.startPrank(user);
        ousd.approve(address(wrappedOusd), ousdAmount);
        shares = wrappedOusd.deposit(ousdAmount, user);
        vm.stopPrank();
    }

    function _mintAndDeposit(address user, uint256 usdcAmount) internal returns (uint256 shares) {
        _mintOUSD(user, usdcAmount);
        shares = _depositToWrappedOusd(user, ousd.balanceOf(user));
    }

    function _rebase(uint256 yieldUSDC) internal {
        _dealUSDC(address(ousdVault), yieldUSDC);
        vm.warp(block.timestamp + 1);
        vm.prank(governor);
        ousdVault.rebase();
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////
    function label() public {
        vm.label(address(usdc), "USDC");
        vm.label(address(ousd), "OUSD");
        vm.label(address(ousdVault), "OUSDVault");
        vm.label(address(wrappedOusd), "WrappedOUSD");
        vm.label(address(wrappedOusdProxy), "WrappedOUSDProxy");
    }
}
