// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";

contract Unit_Concrete_BridgedWOETHStrategy_ViewFunctions_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    // --- checkBalance ---

    function test_checkBalance_returnsWETHValueOfBridgedWOETH() public {
        // Set oracle price and give strategy some bridgedWOETH
        _setOraclePrice(1.1e18);
        bridgedWOETH.mint(address(bridgedWOETHStrategy), 10e18);

        uint256 balance = bridgedWOETHStrategy.checkBalance(address(mockWeth));
        // 10e18 * 1.1e18 / 1e18 = 11e18
        assertEq(balance, 11e18);
    }

    function test_checkBalance_returnsZeroWhenNoOraclePrice() public view {
        // lastOraclePrice is 0 by default (initialize doesn't set it)
        uint256 balance = bridgedWOETHStrategy.checkBalance(address(mockWeth));
        assertEq(balance, 0);
    }

    function test_checkBalance_RevertWhen_unsupportedAsset() public {
        vm.expectRevert("Unsupported asset");
        bridgedWOETHStrategy.checkBalance(address(0xdead));
    }

    // --- supportsAsset ---

    function test_supportsAsset_returnsTrueForWeth() public view {
        assertTrue(bridgedWOETHStrategy.supportsAsset(address(mockWeth)));
    }

    function test_supportsAsset_returnsFalseForOtherAssets() public view {
        assertFalse(bridgedWOETHStrategy.supportsAsset(address(bridgedWOETH)));
        assertFalse(bridgedWOETHStrategy.supportsAsset(address(oeth)));
        assertFalse(bridgedWOETHStrategy.supportsAsset(address(0xdead)));
    }

    // --- getBridgedWOETHValue ---

    function test_getBridgedWOETHValue_returnsCorrectValue() public {
        _setOraclePrice(1.1e18);

        uint256 value = bridgedWOETHStrategy.getBridgedWOETHValue(10e18);
        // 10e18 * 1.1e18 / 1e18 = 11e18
        assertEq(value, 11e18);
    }
}
