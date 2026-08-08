// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { Unit_OTokenVaultOracle_Shared_Test } from "../shared/Shared.t.sol";

contract Unit_Concrete_OTokenVaultOracle_ViewFunctions_Test is
    Unit_OTokenVaultOracle_Shared_Test
{
    function test_constructor_setsConfiguration() public view {
        assertEq(address(oracle.vault()), address(mockVault));
        assertEq(address(oracle.oToken()), address(mockOToken));
        assertEq(oracle.decimals(), 18);
        assertEq(oracle.description(), "OToken / underlying asset");
        assertEq(oracle.version(), 1);
    }

    function test_price_isOneAtRebase() public view {
        assertEq(oracle.price(), 1e18);
    }

    function test_price_increasesWithUnrebasedYield() public {
        mockVault.setTotalValue(105e18);
        assertEq(oracle.price(), 1.05e18);
    }

    function test_price_returnsFractionalPrice() public {
        mockVault.setTotalValue(101e18);
        mockOToken.setTotalSupply(100e18);
        assertEq(oracle.price(), 1.01e18);
    }

    function test_price_RevertWhen_supplyIsZero() public {
        mockOToken.setTotalSupply(0);
        vm.expectRevert("No data present");
        oracle.price();
    }

    function test_latestAnswer_returnsPrice() public view {
        assertEq(oracle.latestAnswer(), int256(1e18));
    }

    function test_latestRoundData_returnsCurrentPrice() public view {
        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = oracle.latestRoundData();

        assertEq(roundId, 1);
        assertEq(answer, int256(1e18));
        assertEq(startedAt, block.timestamp);
        assertEq(updatedAt, block.timestamp);
        assertEq(answeredInRound, 1);
    }

    function test_getRoundData_returnsCurrentPriceForSyntheticRound()
        public
        view
    {
        (uint80 roundId, int256 answer, , , uint80 answeredInRound) = oracle
            .getRoundData(1);

        assertEq(roundId, 1);
        assertEq(answer, int256(1e18));
        assertEq(answeredInRound, 1);
    }

    function test_getRoundData_RevertWhen_roundDoesNotExist() public {
        vm.expectRevert("No data present");
        oracle.getRoundData(2);
    }
}
