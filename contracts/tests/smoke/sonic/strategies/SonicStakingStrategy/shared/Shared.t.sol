// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";

// --- Test utilities
import {Sonic} from "tests/utils/Addresses.sol";

// --- Project imports
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {ISFC} from "contracts/interfaces/sonic/ISFC.sol";
import {ISonicStakingStrategy} from "contracts/interfaces/strategies/ISonicStakingStrategy.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IWrappedSonic} from "contracts/interfaces/sonic/IWrappedSonic.sol";

abstract contract Smoke_SonicStakingStrategy_Shared_Test is BaseSmoke {
    //////////////////////////////////////////////////////
    /// --- CONTRACTS
    //////////////////////////////////////////////////////

    IOToken internal oSonic;
    IVault internal oSonicVault;
    ISonicStakingStrategy internal sonicStakingStrategy;
    ISFC internal sfc;
    IWrappedSonic internal wrappedSonic;
    address internal validatorRegistrator;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();

        _createAndSelectForkSonic();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        oSonic = IOToken(resolver.resolve("OSONIC_PROXY"));
        oSonicVault = IVault(resolver.resolve("OSONIC_VAULT_PROXY"));
        sonicStakingStrategy = ISonicStakingStrategy(resolver.resolve("SONIC_STAKING_STRATEGY"));

        sfc = ISFC(Sonic.SFC);
        wrappedSonic = IWrappedSonic(Sonic.wS);
    }

    function _resolveActors() internal {
        governor = sonicStakingStrategy.governor();
        strategist = oSonicVault.strategistAddr();
        validatorRegistrator = sonicStakingStrategy.validatorRegistrator();
    }

    function _labelContracts() internal {
        vm.label(address(sonicStakingStrategy), "SonicStakingStrategy");
        vm.label(address(oSonic), "OSonic");
        vm.label(address(oSonicVault), "OSonicVault");
        vm.label(address(sfc), "SFC");
        vm.label(address(wrappedSonic), "WrappedSonic");
        vm.label(Sonic.nodeDriveAuth, "NodeDriveAuth");
        vm.label(validatorRegistrator, "ValidatorRegistrator");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal wS to strategy and call deposit as vault
    function _depositToStrategy(uint256 amount) internal {
        deal(address(wrappedSonic), address(sonicStakingStrategy), amount);
        vm.prank(address(oSonicVault));
        sonicStakingStrategy.deposit(address(wrappedSonic), amount);
    }

    /// @dev Advance SFC epochs by sealing them
    function _advanceSfcEpoch(uint256 epochsToAdvance) internal {
        uint256 currentSealedEpoch = sfc.currentSealedEpoch();
        uint256[] memory epochValidators = sfc.getEpochValidatorIDs(currentSealedEpoch);
        uint256 validatorsLength = epochValidators.length;

        for (uint256 i = 0; i < epochsToAdvance; i++) {
            uint256[] memory offlineTimes = new uint256[](validatorsLength);
            uint256[] memory offlineBlocks = new uint256[](validatorsLength);
            uint256[] memory uptimes = new uint256[](validatorsLength);
            uint256[] memory originatedTxsFee = new uint256[](validatorsLength);

            for (uint256 j = 0; j < validatorsLength; j++) {
                uptimes[j] = 600;
                originatedTxsFee[j] = 2955644249909388016706;
            }

            vm.warp(block.timestamp + 10 minutes);

            vm.startPrank(Sonic.nodeDriveAuth);
            sfc.sealEpoch(offlineTimes, offlineBlocks, uptimes, originatedTxsFee);
            sfc.sealEpochValidators(epochValidators);
            vm.stopPrank();
        }
    }

    /// @dev Advance time by 1 week
    function _advanceWeek() internal {
        vm.warp(block.timestamp + 7 days);
    }
}
