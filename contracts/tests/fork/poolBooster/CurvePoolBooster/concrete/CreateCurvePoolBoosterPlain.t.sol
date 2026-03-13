// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Fork_CurvePoolBooster_Shared_Test} from
    "tests/fork/poolBooster/CurvePoolBooster/shared/Shared.t.sol";

import {Mainnet} from "tests/utils/Addresses.sol";
import {CrossChain} from "tests/utils/Addresses.sol";

contract Fork_Concrete_CurvePoolBooster_CreateCurvePoolBoosterPlain_Test is Fork_CurvePoolBooster_Shared_Test {
    function test_createPoolBoosterInstance() public {
        bytes32 encodedSalt = curvePoolBoosterFactory.encodeSaltForCreateX(12345);

        vm.prank(CrossChain.multichainStrategist);
        address boosterAddr = curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(ousdToken),
            Mainnet.CurveOUSDUSDTGauge,
            CrossChain.multichainStrategist,
            0,
            Mainnet.CampaignRemoteManager,
            CrossChain.votemarket,
            encodedSalt,
            address(0) // no expected address check
        );

        assertTrue(boosterAddr != address(0));
    }

    function test_createPoolBoosterInstance_withExpectedAddress() public {
        bytes32 encodedSalt = curvePoolBoosterFactory.encodeSaltForCreateX(12345);

        address expectedAddress = curvePoolBoosterFactory.computePoolBoosterAddress(
            address(ousdToken),
            Mainnet.CurveOUSDUSDTGauge,
            encodedSalt
        );

        vm.prank(CrossChain.multichainStrategist);
        address boosterAddr = curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(ousdToken),
            Mainnet.CurveOUSDUSDTGauge,
            CrossChain.multichainStrategist,
            0,
            Mainnet.CampaignRemoteManager,
            CrossChain.votemarket,
            encodedSalt,
            expectedAddress
        );

        assertEq(boosterAddr, expectedAddress);
    }
}
