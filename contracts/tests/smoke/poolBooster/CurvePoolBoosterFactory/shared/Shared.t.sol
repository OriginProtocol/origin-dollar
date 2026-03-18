// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {
    CurvePoolBoosterFactory as CurvePoolBoosterFactoryContract
} from "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol";
import {CurvePoolBoosterPlain} from "contracts/poolBooster/curve/CurvePoolBoosterPlain.sol";
import {Mainnet} from "tests/utils/Addresses.sol";
import {CrossChain} from "tests/utils/Addresses.sol";

abstract contract Smoke_CurvePoolBoosterFactory_Shared_Test is BaseSmoke {
    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkMainnet();
        _igniteDeployManager();

        curvePoolBoosterFactory = CurvePoolBoosterFactoryContract(Mainnet.CurvePoolBoosterFactory);
        curvePoolBoosterPlain = CurvePoolBoosterPlain(payable(Mainnet.CurvePoolBoosterPlainOETH));

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
