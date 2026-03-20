// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {CurvePoolBoosterFactory} from "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_CurvePoolBoosterFactory_RemovePoolBooster_Test is Unit_Curve_Shared_Test {
    /// @dev Helper that creates a booster via the factory using real CREATE2.
    function _createBoosterViaFactory(bytes32 _salt) internal returns (address) {
        vm.prank(governor);
        address deployed = curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            _salt,
            address(0)
        );
        return deployed;
    }

    function test_removePoolBooster() public {
        bytes32 salt = curvePoolBoosterFactory.encodeSaltForCreateX(1);
        address booster = _createBoosterViaFactory(salt);

        assertEq(curvePoolBoosterFactory.poolBoosterLength(), 1);

        vm.prank(governor);
        curvePoolBoosterFactory.removePoolBooster(booster);

        assertEq(curvePoolBoosterFactory.poolBoosterLength(), 0);
    }

    function test_removePoolBooster_clearsMapping() public {
        bytes32 salt = curvePoolBoosterFactory.encodeSaltForCreateX(1);
        address booster = _createBoosterViaFactory(salt);

        (address mappedAddr,,) = curvePoolBoosterFactory.poolBoosterFromPool(mockGauge);
        assertEq(mappedAddr, booster);

        vm.prank(governor);
        curvePoolBoosterFactory.removePoolBooster(booster);

        (address clearedAddr,,) = curvePoolBoosterFactory.poolBoosterFromPool(mockGauge);
        assertEq(clearedAddr, address(0));
    }

    function test_removePoolBooster_emitsOnRegistry() public {
        bytes32 salt = curvePoolBoosterFactory.encodeSaltForCreateX(1);
        address booster = _createBoosterViaFactory(salt);

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterRemoved(booster);

        vm.prank(governor);
        curvePoolBoosterFactory.removePoolBooster(booster);
    }

    function test_removePoolBooster_nonExistent() public {
        address nonExistent = makeAddr("NonExistentBooster");

        vm.prank(governor);
        curvePoolBoosterFactory.removePoolBooster(nonExistent);

        assertEq(curvePoolBoosterFactory.poolBoosterLength(), 0);
    }

    function test_removePoolBooster_RevertWhen_notGovernor() public {
        bytes32 salt = curvePoolBoosterFactory.encodeSaltForCreateX(1);
        address booster = _createBoosterViaFactory(salt);

        vm.prank(alice);
        vm.expectRevert("Caller is not the Governor");
        curvePoolBoosterFactory.removePoolBooster(booster);
    }
}
