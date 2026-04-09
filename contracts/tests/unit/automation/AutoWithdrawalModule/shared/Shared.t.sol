// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Base} from "tests/Base.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

// --- External libraries
import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

// --- Project imports
import {IAutoWithdrawalModule} from "contracts/interfaces/automation/IAutoWithdrawalModule.sol";
import {MockAutoWithdrawalVault} from "tests/mocks/MockAutoWithdrawalVault.sol";
import {MockSafeContract} from "tests/mocks/MockSafeContract.sol";
import {MockStrategy} from "contracts/mocks/MockStrategy.sol";

abstract contract Unit_AutoWithdrawalModule_Shared_Test is Base {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS & MOCKS
    //////////////////////////////////////////////////////

    MockSafeContract internal mockSafe;
    MockStrategy internal mockStrategy;
    IAutoWithdrawalModule internal autoWithdrawalModule;
    MockERC20 internal assetToken;
    MockAutoWithdrawalVault internal mockVault;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _deployContracts();
        label();
    }

    function _deployContracts() internal {
        // Deploy mock safe
        mockSafe = new MockSafeContract();

        // Deploy mock asset token
        assetToken = new MockERC20("Mock Asset", "MASSET", 18);

        // Deploy mock vault with asset
        mockVault = new MockAutoWithdrawalVault(address(assetToken));

        // Deploy mock strategy
        mockStrategy = new MockStrategy();

        // Deploy AutoWithdrawalModule
        autoWithdrawalModule = IAutoWithdrawalModule(
            vm.deployCode(
                Automation.AUTO_WITHDRAWAL_MODULE,
                abi.encode(address(mockSafe), operator, address(mockVault), address(mockStrategy))
            )
        );
    }

    //////////////////////////////////////////////////////
    /// --- LABELS
    //////////////////////////////////////////////////////

    function label() public {
        vm.label(address(mockSafe), "MockSafe");
        vm.label(address(assetToken), "AssetToken");
        vm.label(address(mockVault), "MockVault");
        vm.label(address(mockStrategy), "MockStrategy");
        vm.label(address(autoWithdrawalModule), "AutoWithdrawalModule");
    }
}
