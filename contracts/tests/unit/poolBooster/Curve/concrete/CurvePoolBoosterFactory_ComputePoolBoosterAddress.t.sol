// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";

contract Unit_Concrete_CurvePoolBoosterFactory_ComputePoolBoosterAddress_Test is Unit_Curve_Shared_Test {
    function test_computePoolBoosterAddress() public view {
        bytes32 salt = curvePoolBoosterFactory.encodeSaltForCreateX(1);

        address computed = curvePoolBoosterFactory.computePoolBoosterAddress(address(oeth), mockGauge, salt);

        assertTrue(computed != address(0));
    }

    function test_computePoolBoosterAddress_matchesDeploy() public {
        bytes32 salt = curvePoolBoosterFactory.encodeSaltForCreateX(1);
        address computed = curvePoolBoosterFactory.computePoolBoosterAddress(address(oeth), mockGauge, salt);

        vm.prank(governor);
        address deployed = curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            salt,
            address(0)
        );

        assertEq(computed, deployed);
    }

    function test_computePoolBoosterAddress_differentSalt() public view {
        bytes32 salt1 = curvePoolBoosterFactory.encodeSaltForCreateX(1);
        bytes32 salt2 = curvePoolBoosterFactory.encodeSaltForCreateX(2);

        address addr1 = curvePoolBoosterFactory.computePoolBoosterAddress(address(oeth), mockGauge, salt1);
        address addr2 = curvePoolBoosterFactory.computePoolBoosterAddress(address(oeth), mockGauge, salt2);

        assertTrue(addr1 != addr2);
    }
}
