// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {CurvePoolBoosterFactory} from "contracts/poolBooster/curve/CurvePoolBoosterFactory.sol";

import {
    Smoke_CurvePoolBoosterFactory_Shared_Test
} from "tests/smoke/poolBooster/CurvePoolBoosterFactory/shared/Shared.t.sol";
import {Mainnet} from "tests/utils/Addresses.sol";

contract Smoke_Concrete_CurvePoolBoosterFactory_Test is Smoke_CurvePoolBoosterFactory_Shared_Test {
    //////////////////////////////////////////////////////
    /// --- VIEW FUNCTIONS
    //////////////////////////////////////////////////////

    function test_governor() public view {
        assertNotEq(curvePoolBoosterFactory.governor(), address(0));
    }

    function test_strategist() public view {
        assertNotEq(curvePoolBoosterFactory.strategistAddr(), address(0));
    }

    function test_centralRegistry() public view {
        assertNotEq(address(curvePoolBoosterFactory.centralRegistry()), address(0));
    }

    function test_poolBoosterLength() public view {
        assertGt(curvePoolBoosterFactory.poolBoosterLength(), 0);
    }

    function test_getPoolBoosters() public view {
        CurvePoolBoosterFactory.PoolBoosterEntry[] memory boosters = curvePoolBoosterFactory.getPoolBoosters();
        assertGt(boosters.length, 0);
        for (uint256 i = 0; i < boosters.length; i++) {
            assertNotEq(boosters[i].boosterAddress, address(0));
            assertNotEq(boosters[i].ammPoolAddress, address(0));
        }
    }

    function test_poolBoosterFromPool() public view {
        CurvePoolBoosterFactory.PoolBoosterEntry[] memory boosters = curvePoolBoosterFactory.getPoolBoosters();
        address firstAmmPool = boosters[0].ammPoolAddress;
        (address boosterAddress,,) = curvePoolBoosterFactory.poolBoosterFromPool(firstAmmPool);
        assertNotEq(boosterAddress, address(0));
    }

    function test_plainBoosterIsRegistered() public view {
        CurvePoolBoosterFactory.PoolBoosterEntry[] memory boosters = curvePoolBoosterFactory.getPoolBoosters();
        bool found = false;
        for (uint256 i = 0; i < boosters.length; i++) {
            if (boosters[i].boosterAddress == address(curvePoolBoosterPlain)) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Known CurvePoolBoosterPlain not registered in factory");
    }

    function test_computePoolBoosterAddress() public view {
        bytes32 encodedSalt = curvePoolBoosterFactory.encodeSaltForCreateX(12345);
        address computed = curvePoolBoosterFactory.computePoolBoosterAddress(
            Mainnet.OETHProxy, Mainnet.curve_OETH_WETH_gauge, encodedSalt
        );
        assertNotEq(computed, address(0));
    }

    function test_encodeSaltForCreateX() public view {
        bytes32 encodedSalt = curvePoolBoosterFactory.encodeSaltForCreateX(12345);
        // First 20 bytes of the encoded salt should equal the factory address
        address encodedDeployer = address(bytes20(encodedSalt));
        assertEq(encodedDeployer, address(curvePoolBoosterFactory));
    }

    //////////////////////////////////////////////////////
    /// --- MUTATIVE FUNCTIONS
    //////////////////////////////////////////////////////

    function test_createCurvePoolBoosterPlain() public {
        uint256 lengthBefore = curvePoolBoosterFactory.poolBoosterLength();

        address boosterAddr = _createPoolBooster(block.timestamp);

        assertNotEq(boosterAddr, address(0));
        assertEq(curvePoolBoosterFactory.poolBoosterLength(), lengthBefore + 1);

        // Verify it's in getPoolBoosters
        CurvePoolBoosterFactory.PoolBoosterEntry[] memory boosters = curvePoolBoosterFactory.getPoolBoosters();
        bool found = false;
        for (uint256 i = 0; i < boosters.length; i++) {
            if (boosters[i].boosterAddress == boosterAddr) {
                found = true;
                break;
            }
        }
        assertTrue(found, "New booster not in getPoolBoosters()");

        // Verify poolBoosterFromPool mapping
        (address fromPoolBooster,,) = curvePoolBoosterFactory.poolBoosterFromPool(Mainnet.curve_OETH_WETH_gauge);
        assertEq(fromPoolBooster, boosterAddr);
    }

    function test_removePoolBooster() public {
        CurvePoolBoosterFactory.PoolBoosterEntry[] memory boosters = curvePoolBoosterFactory.getPoolBoosters();
        address firstBooster = boosters[0].boosterAddress;
        uint256 lengthBefore = curvePoolBoosterFactory.poolBoosterLength();

        vm.prank(curvePoolBoosterFactory.governor());
        curvePoolBoosterFactory.removePoolBooster(firstBooster);

        assertEq(curvePoolBoosterFactory.poolBoosterLength(), lengthBefore - 1);
    }
}
