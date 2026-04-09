// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Test utilities
import {Strategies} from "tests/utils/artifacts/Strategies.sol";

import {Unit_SonicSwapXAMOStrategy_Shared_Test} from "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {ISonicSwapXAMOStrategy} from "contracts/interfaces/strategies/ISonicSwapXAMOStrategy.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_Initialize_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_initialize_setsMaxDepeg() public view {
        assertEq(sonicSwapXAMOStrategy.maxDepeg(), DEFAULT_MAX_DEPEG);
    }

    function test_initialize_approvesGauge() public view {
        uint256 allowance =
            IERC20(address(mockSwapXPair)).allowance(address(sonicSwapXAMOStrategy), address(mockSwapXGauge));
        assertEq(allowance, type(uint256).max);
    }

    function test_initialize_setsRewardTokens() public view {
        assertEq(sonicSwapXAMOStrategy.rewardTokenAddresses(0), address(swpxToken));
    }

    function test_initialize_RevertWhen_doubleInit() public {
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(swpxToken);

        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        sonicSwapXAMOStrategy.initialize(rewardTokens, DEFAULT_MAX_DEPEG);
    }

    function test_initialize_RevertWhen_nonGovernor() public {
        ISonicSwapXAMOStrategy freshStrategy = ISonicSwapXAMOStrategy(
            vm.deployCode(
                Strategies.SONIC_SWAPX_AMO_STRATEGY,
                abi.encode(address(mockSwapXPair), address(oSonicVault), address(mockSwapXGauge))
            )
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(swpxToken);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        freshStrategy.initialize(rewardTokens, DEFAULT_MAX_DEPEG);
    }
}
