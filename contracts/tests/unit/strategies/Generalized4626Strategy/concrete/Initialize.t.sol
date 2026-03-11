// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_Generalized4626Strategy_Shared_Test
} from "tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol";
import {Generalized4626Strategy} from "contracts/strategies/Generalized4626Strategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_Generalized4626Strategy_Initialize_Test is Unit_Generalized4626Strategy_Shared_Test {
    function test_initialize_setsAssetAndShareToken() public view {
        assertEq(address(strategy.assetToken()), address(asset));
        assertEq(address(strategy.shareToken()), address(shareVault));
    }

    function test_initialize_setsPTokenMapping() public view {
        assertEq(strategy.assetToPToken(address(asset)), address(shareVault));
    }

    function test_initialize_RevertWhen_calledTwice() public {
        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        strategy.initialize();
    }

    function test_initialize_RevertWhen_calledByNonGovernor() public {
        Generalized4626Strategy freshStrategy = new Generalized4626Strategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(shareVault), vaultAddress: address(ousdVault)
            }),
            address(asset)
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        freshStrategy.initialize();
    }
}
