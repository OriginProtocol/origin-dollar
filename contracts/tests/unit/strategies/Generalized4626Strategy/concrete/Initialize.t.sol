// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Unit_Generalized4626Strategy_Shared_Test
} from "tests/unit/strategies/Generalized4626Strategy/shared/Shared.t.sol";
import {IGeneralized4626Strategy} from "contracts/interfaces/strategies/IGeneralized4626Strategy.sol";

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
        IGeneralized4626Strategy freshStrategy = IGeneralized4626Strategy(
            vm.deployCode(
                "contracts/strategies/Generalized4626Strategy.sol:Generalized4626Strategy",
                abi.encode(address(shareVault), address(ousdVault), address(asset))
            )
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        freshStrategy.initialize();
    }
}
