// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Unit_CurveAMOStrategy_Shared_Test} from "tests/unit/strategies/CurveAMOStrategy/shared/Shared.t.sol";
import {CurveAMOStrategy} from "contracts/strategies/CurveAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_CurveAMOStrategy_Initialize_Test is Unit_CurveAMOStrategy_Shared_Test {
    function test_initialize_setsRewardTokens() public view {
        assertEq(curveAMOStrategy.rewardTokenAddresses(0), address(crvToken));
    }

    function test_initialize_setsMaxSlippage() public view {
        assertEq(curveAMOStrategy.maxSlippage(), DEFAULT_MAX_SLIPPAGE);
    }

    function test_initialize_setsApprovals() public view {
        // oToken approved for pool
        assertEq(IERC20(address(oeth)).allowance(address(curveAMOStrategy), address(curvePool)), type(uint256).max);
        // hardAsset approved for pool
        assertEq(weth.allowance(address(curveAMOStrategy), address(curvePool)), type(uint256).max);
        // lpToken approved for gauge
        assertEq(
            IERC20(address(curvePool)).allowance(address(curveAMOStrategy), address(curveGauge)), type(uint256).max
        );
    }

    function test_initialize_RevertWhen_calledByNonGovernor() public {
        CurveAMOStrategy freshStrategy = new CurveAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(curvePool), vaultAddress: address(oethVault)
            }),
            address(oeth),
            address(mockWeth),
            address(curveGauge),
            address(curveMinter)
        );
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(crvToken);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        freshStrategy.initialize(rewardTokens, 1e16);
    }

    function test_initialize_RevertWhen_calledTwice() public {
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(crvToken);

        vm.prank(governor);
        vm.expectRevert("Initializable: contract is already initialized");
        curveAMOStrategy.initialize(rewardTokens, 1e16);
    }
}
