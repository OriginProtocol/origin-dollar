// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Unit_SonicSwapXAMOStrategy_Shared_Test} from
    "tests/unit/strategies/SonicSwapXAMOStrategy/shared/Shared.t.sol";
import {SonicSwapXAMOStrategy} from "contracts/strategies/sonic/SonicSwapXAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_SonicSwapXAMOStrategy_Initialize_Test is Unit_SonicSwapXAMOStrategy_Shared_Test {
    function test_initialize_setsMaxDepeg() public view {
        assertEq(sonicSwapXAMOStrategy.maxDepeg(), DEFAULT_MAX_DEPEG);
    }

    function test_initialize_approvesGauge() public view {
        uint256 allowance = IERC20(address(mockSwapXPair)).allowance(
            address(sonicSwapXAMOStrategy), address(mockSwapXGauge)
        );
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
        SonicSwapXAMOStrategy freshStrategy = new SonicSwapXAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(mockSwapXPair),
                vaultAddress: address(oSonicVault)
            }),
            address(oSonic),
            address(mockWrappedSonic),
            address(mockSwapXGauge)
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(swpxToken);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        freshStrategy.initialize(rewardTokens, DEFAULT_MAX_DEPEG);
    }
}
