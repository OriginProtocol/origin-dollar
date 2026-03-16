// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Vm} from "forge-std/Vm.sol";

import {Fork_SwapXPoolBooster_Shared_Test} from
    "tests/fork/poolBooster/SwapXPoolBooster/shared/Shared.t.sol";
import {PoolBoosterSwapxSingle} from "contracts/poolBooster/PoolBoosterSwapxSingle.sol";
import {Sonic} from "tests/utils/Addresses.sol";

contract Fork_Concrete_SwapXPoolBooster_ShadowBribe_Test is Fork_SwapXPoolBooster_Shared_Test {
    // Shadow gauge event: NotifyReward(address from, address reward, uint256 epoch, uint256 amount)
    bytes32 internal constant NOTIFY_REWARD_TOPIC = keccak256("NotifyReward(address,address,uint256,uint256)");

    // Shadow voter address (used by Shadow gauge for token whitelisting)
    address internal constant SHADOW_VOTER = 0x9F59398D0a397b2EEB8a6123a6c7295cB0b0062D;

    function test_bribe() public {
        // Create single booster using Shadow gauge as bribe target
        PoolBoosterSwapxSingle booster =
            _createSingleBooster(Sonic.Shadow_SWETH_gaugeV2, Sonic.Shadow_SWETH_pool, 12345e18);

        // Verify computed address matches
        address computedAddr = factorySwapxSingle.computePoolBoosterAddress(
            Sonic.Shadow_SWETH_gaugeV2, Sonic.Shadow_SWETH_pool, 12345e18
        );
        assertEq(address(booster), computedAddr);

        // Whitelist mock token on Shadow voter (gauge checks voter.isWhitelisted)
        vm.mockCall(
            SHADOW_VOTER,
            abi.encodeWithSignature("isWhitelisted(address)", address(oSonic)),
            abi.encode(true)
        );

        // Fund the booster
        _dealOSToken(address(booster), 10e18);
        uint256 bribeBalance = oSonic.balanceOf(address(booster));

        vm.recordLogs();
        booster.bribe();
        Vm.Log[] memory entries = vm.getRecordedLogs();

        // Find NotifyReward event from Shadow gauge
        // Event: NotifyReward(address from, address reward, uint256 amount, uint256 period)
        uint256 notifyCount;
        for (uint256 i; i < entries.length; i++) {
            if (entries[i].topics[0] == NOTIFY_REWARD_TOPIC && entries[i].emitter == Sonic.Shadow_SWETH_gaugeV2) {
                address from = address(uint160(uint256(entries[i].topics[1])));
                address reward = address(uint160(uint256(entries[i].topics[2])));
                (uint256 amount,) = abi.decode(entries[i].data, (uint256, uint256));

                assertEq(from, address(booster));
                assertEq(reward, address(oSonic));
                assertEq(amount, bribeBalance);
                notifyCount++;
            }
        }
        assertEq(notifyCount, 1, "Expected 1 NotifyReward event");
        assertEq(oSonic.balanceOf(address(booster)), 0);
    }
}
