// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {ICurvePoolBoosterFactory} from "contracts/interfaces/poolBooster/ICurvePoolBoosterFactory.sol";
import {ICurvePoolBooster} from "contracts/interfaces/poolBooster/ICurvePoolBooster.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

abstract contract Smoke_CurvePoolBoosterFactory_Shared_Test is BaseSmoke {
    ICurvePoolBoosterFactory internal curvePoolBoosterFactory;
    ICurvePoolBooster internal curvePoolBoosterPlain;

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        require(address(resolver).code.length > 0, "Resolver not initialized on fork");
        curvePoolBoosterFactory = ICurvePoolBoosterFactory(resolver.resolve("CURVE_POOL_BOOSTER_FACTORY"));
        curvePoolBoosterPlain = ICurvePoolBooster(payable(resolver.resolve("CURVE_POOL_BOOSTER_PLAIN_ARM_OETH")));

        vm.label(address(curvePoolBoosterFactory), "CurvePoolBoosterFactory");
        vm.label(address(curvePoolBoosterPlain), "CurvePoolBoosterPlain");
    }

    /// @notice Creates a new pool booster using the live factory, pranking as strategist
    function _createPoolBooster(uint256 salt) internal returns (address boosterAddr) {
        bytes32 encodedSalt = curvePoolBoosterFactory.encodeSaltForCreateX(salt);
        address expectedAddress = curvePoolBoosterFactory.computePoolBoosterAddress(
            Mainnet.OETHProxy, Mainnet.curve_OETH_WETH_gauge, encodedSalt
        );

        address feeCollector = curvePoolBoosterPlain.feeCollector();
        address campaignRemoteManager = curvePoolBoosterPlain.campaignRemoteManager();
        address votemarket = curvePoolBoosterPlain.votemarket();
        address factoryStrategist = curvePoolBoosterFactory.strategistAddr();

        vm.deal(factoryStrategist, 1 ether);
        vm.prank(factoryStrategist);
        boosterAddr = curvePoolBoosterFactory.createCurvePoolBoosterPlain(
            Mainnet.OETHProxy,
            Mainnet.curve_OETH_WETH_gauge,
            feeCollector,
            0,
            campaignRemoteManager,
            votemarket,
            encodedSalt,
            expectedAddress
        );
    }
}
