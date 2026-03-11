// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Base} from "tests/Base.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockWrappedSonic} from "tests/mocks/MockWrappedSonic.sol";
import {MockSFC} from "contracts/mocks/MockSFC.sol";
import {OSonic} from "contracts/token/OSonic.sol";
import {OSVault} from "contracts/vault/OSVault.sol";
import {OSonicProxy, OSonicVaultProxy} from "contracts/proxies/SonicProxies.sol";
import {SonicStakingStrategy} from "contracts/strategies/sonic/SonicStakingStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

abstract contract Unit_SonicStakingStrategy_Shared_Test is Base {
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
            address(oSonicVaultImpl),
            governor,
            abi.encodeWithSignature("initialize(address)", address(oSonicProxy))
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

        // Deploy SonicStakingStrategy
        sonicStakingStrategy = new SonicStakingStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(mockSfc),
                vaultAddress: address(oSonicVault)
            }),
            address(mockWrappedSonic),
            address(mockSfc)
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
