// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";

// --- Test utilities
import {Strategies} from "tests/utils/artifacts/Strategies.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {IBaseCurveAMOStrategy} from "contracts/interfaces/strategies/IBaseCurveAMOStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_Initialize_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_initialize_setsRewardTokens() public view {
        assertEq(baseCurveAMOStrategy.rewardTokenAddresses(0), address(crvToken));
    }

    function test_initialize_setsMaxSlippage() public view {
        assertEq(baseCurveAMOStrategy.maxSlippage(), DEFAULT_MAX_SLIPPAGE);
    }

    function test_initialize_setsApprovals() public view {
        // oeth approved for pool
        assertEq(IERC20(address(oeth)).allowance(address(baseCurveAMOStrategy), address(curvePool)), type(uint256).max);
        // weth approved for pool
        assertEq(weth.allowance(address(baseCurveAMOStrategy), address(curvePool)), type(uint256).max);
        // lpToken approved for gauge
        assertEq(
            IERC20(address(curvePool)).allowance(address(baseCurveAMOStrategy), address(curveGauge)), type(uint256).max
        );
    }

    function test_initialize_RevertWhen_calledByNonGovernor() public {
        IBaseCurveAMOStrategy freshStrategy = IBaseCurveAMOStrategy(
            vm.deployCode(
                Strategies.BASE_CURVE_AMO_STRATEGY,
                abi.encode(
                    address(curvePool),
                    address(oethVault),
                    address(oeth),
                    address(mockWeth),
                    address(curveGauge),
                    address(curveGaugeFactory),
                    uint128(1),
                    uint128(0)
                )
            )
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
        baseCurveAMOStrategy.initialize(rewardTokens, 1e16);
    }
}
