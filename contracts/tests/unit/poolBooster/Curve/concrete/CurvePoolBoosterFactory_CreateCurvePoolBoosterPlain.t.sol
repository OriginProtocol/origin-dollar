// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Curve_Shared_Test} from "tests/unit/poolBooster/Curve/shared/Shared.t.sol";
import {CurvePoolBoosterFactory} from "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {IPoolBoostCentralRegistry} from "contracts/interfaces/poolBooster/IPoolBoostCentralRegistry.sol";

contract Unit_Concrete_CurvePoolBoosterFactory_CreateCurvePoolBoosterPlain_Test is Unit_Curve_Shared_Test {
    bytes32 internal validSalt;

    function setUp() public override {
        super.setUp();
        validSalt = curvePoolBoosterFactory.encodeSaltForCreateX(1);
    }

    function test_createCurvePoolBoosterPlain() public {
        vm.prank(governor);
        curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            validSalt,
            address(0)
        );

        assertEq(curvePoolBoosterFactory.poolBoosterLength(), 1);
    }

    function test_createCurvePoolBoosterPlain_storesEntry() public {
        address expectedAddr = curvePoolBoosterFactory.computePoolBoosterAddress(address(oeth), mockGauge, validSalt);

        vm.prank(governor);
        curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            validSalt,
            address(0)
        );

        // Verify poolBoosters array entry
        (address boosterAddr, address ammPoolAddr, IPoolBoostCentralRegistry.PoolBoosterType boosterType) =
            curvePoolBoosterFactory.poolBoosters(0);
        assertEq(boosterAddr, expectedAddr);
        assertEq(ammPoolAddr, mockGauge);
        assertEq(uint256(boosterType), uint256(IPoolBoostCentralRegistry.PoolBoosterType.CurvePoolBoosterPlain));

        // Verify poolBoosterFromPool mapping
        (address mappedAddr,,) = curvePoolBoosterFactory.poolBoosterFromPool(mockGauge);
        assertEq(mappedAddr, expectedAddr);
    }

    function test_createCurvePoolBoosterPlain_emitsOnRegistry() public {
        address expectedAddr = curvePoolBoosterFactory.computePoolBoosterAddress(address(oeth), mockGauge, validSalt);

        vm.expectEmit(true, true, true, true, address(centralRegistry));
        emit IPoolBoostCentralRegistry.PoolBoosterCreated(
            expectedAddr,
            mockGauge,
            IPoolBoostCentralRegistry.PoolBoosterType.CurvePoolBoosterPlain,
            address(curvePoolBoosterFactory)
        );

        vm.prank(governor);
        curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            validSalt,
            address(0)
        );
    }

    function test_createCurvePoolBoosterPlain_expectedAddressMatch() public {
        address expectedAddr = curvePoolBoosterFactory.computePoolBoosterAddress(address(oeth), mockGauge, validSalt);

        // Pass expectedAddress equal to the computed address -- should succeed
        vm.prank(governor);
        curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            validSalt,
            expectedAddr
        );

        assertEq(curvePoolBoosterFactory.poolBoosterLength(), 1);
    }

    function test_createCurvePoolBoosterPlain_expectedAddressZero() public {
        // Pass address(0) for expectedAddress -- should succeed (verification is skipped)
        vm.prank(governor);
        curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            validSalt,
            address(0)
        );

        assertEq(curvePoolBoosterFactory.poolBoosterLength(), 1);
    }

    function test_createCurvePoolBoosterPlain_strategistCanCall() public {
        vm.prank(strategist);
        curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            validSalt,
            address(0)
        );

        assertEq(curvePoolBoosterFactory.poolBoosterLength(), 1);
    }

    function test_createCurvePoolBoosterPlain_RevertWhen_notAuthorized() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            validSalt,
            address(0)
        );
    }

    function test_createCurvePoolBoosterPlain_RevertWhen_governorNotSet() public {
        CurvePoolBoosterFactory freshFactory = new CurvePoolBoosterFactory();
        freshFactory.initialize(governor, strategist, address(centralRegistry));

        vm.store(address(freshFactory), GOVERNOR_SLOT, bytes32(0));

        bytes32 salt = freshFactory.encodeSaltForCreateX(1);
        vm.prank(strategist);
        vm.expectRevert("Governor not set");
        freshFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            salt,
            address(0)
        );
    }

    function test_createCurvePoolBoosterPlain_RevertWhen_strategistNotSet() public {
        CurvePoolBoosterFactory freshFactory = new CurvePoolBoosterFactory();
        freshFactory.initialize(governor, address(0), address(centralRegistry));

        bytes32 salt = freshFactory.encodeSaltForCreateX(1);

        vm.prank(governor);
        vm.expectRevert("Strategist not set");
        freshFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            salt,
            address(0)
        );
    }

    function test_createCurvePoolBoosterPlain_RevertWhen_frontRunProtection() public {
        bytes32 badSalt = bytes32(uint256(uint160(alice)) << 96);

        vm.prank(governor);
        vm.expectRevert("Front-run protection failed");
        curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            badSalt,
            address(0)
        );
    }

    function test_createCurvePoolBoosterPlain_RevertWhen_unexpectedAddress() public {
        address wrongAddress = makeAddr("WrongAddress");

        vm.prank(governor);
        vm.expectRevert("Pool booster deployed at unexpected address");
        curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            address(oeth),
            mockGauge,
            mockFeeCollector,
            DEFAULT_FEE,
            mockCampaignRemoteManager,
            mockVotemarket,
            validSalt,
            wrongAddress
        );
    }
}
