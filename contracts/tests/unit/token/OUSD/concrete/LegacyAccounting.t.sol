// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_OUSD_Shared_Test} from "tests/unit/token/OUSD/shared/Shared.t.sol";

contract Unit_Concrete_OUSD_LegacyAccounting_Test is Unit_OUSD_Shared_Test {
    function test_legacyHighResolutionAlternativeCPT_creditsBalanceOfReturnsTrueValues() public {
        vm.prank(matt);
        ousd.rebaseOptOut();

        bytes32 cptSlot = keccak256(abi.encode(uint256(uint160(matt)), uint256(161)));
        bytes32 creditsSlot = keccak256(abi.encode(uint256(uint160(matt)), uint256(157)));
        vm.store(address(ousd), cptSlot, bytes32(uint256(1e27)));
        vm.store(address(ousd), creditsSlot, bytes32(uint256(100e27)));

        assertEq(ousd.balanceOf(matt), 100e18);
        assertEq(ousd.nonRebasingCreditsPerToken(matt), 1e27);

        (uint256 credits, uint256 cpt) = ousd.creditsBalanceOf(matt);
        assertEq(credits, 100e27);
        assertEq(cpt, 1e27);

        (uint256 highresCredits, uint256 highresCpt, bool isUpgraded) = ousd.creditsBalanceOfHighres(matt);
        assertEq(highresCredits, 100e27);
        assertEq(highresCpt, 1e27);
        assertTrue(isUpgraded);
        _assertSupplyInvariant();
    }
}
