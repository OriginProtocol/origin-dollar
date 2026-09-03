// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {
    Unit_SetXOGNRewardRateModule_Shared_Test
} from "tests/unit/automation/SetXOGNRewardRateModule/shared/Shared.t.sol";

// --- Test utilities
import {Automation} from "tests/utils/artifacts/Automation.sol";

contract Unit_Concrete_SetXOGNRewardRateModule_Constructor_Test is Unit_SetXOGNRewardRateModule_Shared_Test {
    function test_constructor_setsImmutables() public view {
        assertEq(module.rewardsSource(), address(rewardsSource));
        assertEq(module.ogn(), address(ognToken));
        assertEq(module.xogn(), address(xognMock));
        assertEq(module.safeContract(), address(mockSafe));
    }

    function test_constructor_grantsRoles() public view {
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), operator));
        assertTrue(module.hasRole(module.OPERATOR_ROLE(), address(mockSafe)));
        assertTrue(module.hasRole(module.DEFAULT_ADMIN_ROLE(), address(mockSafe)));
    }

    function test_constructor_boundsStartUnset() public {
        // A freshly deployed module has zeroed bounds, so setRewardRate is
        // unusable until the Safe calls setBounds. That is deliberate: there is
        // no safe default for these.
        address fresh = vm.deployCode(
            Automation.SET_XOGN_REWARD_RATE_MODULE,
            abi.encode(address(mockSafe), operator, address(rewardsSource), address(ognToken), address(xognMock))
        );

        assertEq(uint256(ISetXOGNRewardRateModuleView(fresh).minRate()), 0);
        assertEq(uint256(ISetXOGNRewardRateModuleView(fresh).maxRate()), 0);
        assertEq(uint256(ISetXOGNRewardRateModuleView(fresh).maxStepBps()), 0);
        assertEq(ISetXOGNRewardRateModuleView(fresh).minRunway(), 0);
        assertEq(uint256(ISetXOGNRewardRateModuleView(fresh).stepPeriod()), 0);

        // The step checkpoint self-initialises on the first setRewardRate, so it
        // must start zeroed rather than be seeded by the constructor.
        assertEq(uint256(ISetXOGNRewardRateModuleView(fresh).checkpointRate()), 0);
        assertEq(uint256(ISetXOGNRewardRateModuleView(fresh).checkpointTime()), 0);
    }

    function test_constructor_RevertWhen_zeroRewardsSource() public {
        vm.expectRevert("Invalid rewards source");
        vm.deployCode(
            Automation.SET_XOGN_REWARD_RATE_MODULE,
            abi.encode(address(mockSafe), operator, address(0), address(ognToken), address(xognMock))
        );
    }

    function test_constructor_RevertWhen_zeroOgn() public {
        vm.expectRevert("Invalid OGN");
        vm.deployCode(
            Automation.SET_XOGN_REWARD_RATE_MODULE,
            abi.encode(address(mockSafe), operator, address(rewardsSource), address(0), address(xognMock))
        );
    }

    function test_constructor_RevertWhen_zeroXogn() public {
        vm.expectRevert("Invalid xOGN");
        vm.deployCode(
            Automation.SET_XOGN_REWARD_RATE_MODULE,
            abi.encode(address(mockSafe), operator, address(rewardsSource), address(ognToken), address(0))
        );
    }
}

interface ISetXOGNRewardRateModuleView {
    function minRate() external view returns (uint192);
    function maxRate() external view returns (uint192);
    function maxStepBps() external view returns (uint16);
    function minRunway() external view returns (uint256);
    function checkpointRate() external view returns (uint192);
    function checkpointTime() external view returns (uint64);
    function stepPeriod() external view returns (uint32);
}
