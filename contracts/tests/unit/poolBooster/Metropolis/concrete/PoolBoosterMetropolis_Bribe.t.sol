// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Metropolis_Shared_Test} from "tests/unit/poolBooster/Metropolis/shared/Shared.t.sol";
import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";

contract Unit_Concrete_PoolBoosterMetropolis_Bribe_Test is Unit_Metropolis_Shared_Test {
    function test_bribe() public {
        _dealOSonic(address(boosterMetropolis), 1e18);

        vm.expectCall(
            mockRewarder,
            abi.encodeWithSelector(
                bytes4(keccak256("fundAndBribe(uint256,uint256,uint256)")),
                uint256(6),
                uint256(6),
                uint256(1e18)
            )
        );

        boosterMetropolis.bribe();
    }

    function test_bribe_event() public {
        _dealOSonic(address(boosterMetropolis), 1e18);

        vm.expectEmit(true, true, true, true);
        emit IPoolBooster.BribeExecuted(1e18);

        boosterMetropolis.bribe();
    }

    function test_bribe_correctPeriod() public {
        _dealOSonic(address(boosterMetropolis), 1e18);

        // getCurrentVotingPeriod returns 5, so id = 5 + 1 = 6
        // Expect fundAndBribe called with (6, 6, 1e18)
        vm.expectCall(
            mockRewarder,
            abi.encodeWithSelector(
                bytes4(keccak256("fundAndBribe(uint256,uint256,uint256)")),
                uint256(6),
                uint256(6),
                uint256(1e18)
            )
        );

        boosterMetropolis.bribe();
    }

    function test_bribe_approval() public {
        _dealOSonic(address(boosterMetropolis), 1e18);

        boosterMetropolis.bribe();

        uint256 allowance = oSonic.allowance(address(boosterMetropolis), mockRewarder);
        assertEq(allowance, 1e18);
    }

    function test_bribe_skipBelowMin() public {
        uint256 amount = 1e10 - 1;
        _dealOSonic(address(boosterMetropolis), amount);

        boosterMetropolis.bribe();

        assertEq(oSonic.balanceOf(address(boosterMetropolis)), amount);
    }

    function test_bribe_skipBelowWhitelistedMin() public {
        // Mock getWhitelistedTokenInfo with minBribeAmount=2e18
        vm.mockCall(
            mockRewardFactory,
            abi.encodeWithSelector(bytes4(keccak256("getWhitelistedTokenInfo(address)"))),
            abi.encode(true, uint256(2e18))
        );

        _dealOSonic(address(boosterMetropolis), 1e18);

        boosterMetropolis.bribe();

        assertEq(oSonic.balanceOf(address(boosterMetropolis)), 1e18);
    }

    function test_bribe_anyoneCanCall() public {
        _dealOSonic(address(boosterMetropolis), 1e18);

        vm.prank(alice);
        boosterMetropolis.bribe();

        // Verify bribe executed by checking approval was set
        uint256 allowance = oSonic.allowance(address(boosterMetropolis), mockRewarder);
        assertEq(allowance, 1e18);
    }
}
