// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BridgedWOETHStrategy_Shared_Test} from "tests/unit/strategies/BridgedWOETHStrategy/shared/Shared.t.sol";
import {BridgedWOETHStrategy} from "contracts/strategies/BridgedWOETHStrategy.sol";

contract Unit_Concrete_BridgedWOETHStrategy_UpdateWOETHOraclePrice_Test is Unit_BridgedWOETHStrategy_Shared_Test {
    function test_updateWOETHOraclePrice_storesPrice() public {
        _mockOraclePrice(1.1e18);
        bridgedWOETHStrategy.updateWOETHOraclePrice();

        assertEq(bridgedWOETHStrategy.lastOraclePrice(), 1.1e18);
    }

    function test_updateWOETHOraclePrice_returnsPrice() public {
        _mockOraclePrice(1.1e18);
        uint256 price = bridgedWOETHStrategy.updateWOETHOraclePrice();

        assertEq(price, 1.1e18);
    }

    function test_updateWOETHOraclePrice_emitsWOETHPriceUpdated() public {
        _mockOraclePrice(1.1e18);

        vm.expectEmit(true, true, true, true);
        emit BridgedWOETHStrategy.WOETHPriceUpdated(0, 1.1e18);

        bridgedWOETHStrategy.updateWOETHOraclePrice();
    }

    function test_updateWOETHOraclePrice_firstCallSkipsBoundsCheck() public {
        // First call with any price > 1 ether should succeed regardless of magnitude
        _mockOraclePrice(5e18);
        bridgedWOETHStrategy.updateWOETHOraclePrice();

        assertEq(bridgedWOETHStrategy.lastOraclePrice(), 5e18);
    }

    function test_updateWOETHOraclePrice_acceptsPriceWithinThreshold() public {
        // Set initial price
        _setOraclePrice(1.1e18);

        // Price increase within 200 bps: 1.1e18 * (1 + 0.02) = 1.122e18
        _mockOraclePrice(1.122e18);
        bridgedWOETHStrategy.updateWOETHOraclePrice();

        assertEq(bridgedWOETHStrategy.lastOraclePrice(), 1.122e18);
    }

    function test_updateWOETHOraclePrice_RevertWhen_priceBelowOrEqualOneEther() public {
        _mockOraclePrice(1 ether);

        vm.expectRevert("Invalid wOETH value");
        bridgedWOETHStrategy.updateWOETHOraclePrice();
    }

    function test_updateWOETHOraclePrice_RevertWhen_priceDecrease() public {
        _setOraclePrice(1.1e18);

        _mockOraclePrice(1.09e18);

        vm.expectRevert("Negative wOETH yield");
        bridgedWOETHStrategy.updateWOETHOraclePrice();
    }

    function test_updateWOETHOraclePrice_RevertWhen_priceBeyondThreshold() public {
        _setOraclePrice(1.1e18);

        // Price increase beyond 200 bps: 1.1e18 * (1 + 0.02) = 1.122e18 is max
        _mockOraclePrice(1.123e18);

        vm.expectRevert("Price diff beyond threshold");
        bridgedWOETHStrategy.updateWOETHOraclePrice();
    }
}
