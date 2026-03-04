// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_Merkl_Shared_Test} from "tests/unit/poolBooster/Merkl/shared/Shared.sol";
import {IPoolBooster} from "contracts/interfaces/poolBooster/IPoolBooster.sol";
import {IMerklDistributor} from "contracts/interfaces/poolBooster/IMerklDistributor.sol";

contract Unit_Concrete_PoolBoosterMerkl_Bribe_Test is Unit_Merkl_Shared_Test {
    function test_bribe() public {
        _dealOETH(address(boosterMerkl), 1e18);
        _mockMerklDistributor(1e10);

        vm.expectCall(
            mockMerklDistributor,
            abi.encodeWithSelector(IMerklDistributor.signAndCreateCampaign.selector)
        );

        boosterMerkl.bribe();
    }

    function test_bribe_event() public {
        _dealOETH(address(boosterMerkl), 1e18);
        _mockMerklDistributor(1e10);

        vm.expectEmit(true, true, true, true);
        emit IPoolBooster.BribeExecuted(1e18);

        boosterMerkl.bribe();
    }

    function test_bribe_approval() public {
        _dealOETH(address(boosterMerkl), 1e18);
        _mockMerklDistributor(1e10);

        boosterMerkl.bribe();

        uint256 allowance = oeth.allowance(address(boosterMerkl), mockMerklDistributor);
        assertEq(allowance, 1e18);
    }

    function test_bribe_skipBelowMin() public {
        uint256 amount = 1e10 - 1;
        _dealOETH(address(boosterMerkl), amount);
        _mockMerklDistributor(1e10);

        boosterMerkl.bribe();

        assertEq(oeth.balanceOf(address(boosterMerkl)), amount);
    }

    function test_bribe_skipBelowThreshold() public {
        // minAmount=1e18, duration=7200 (DEFAULT_CAMPAIGN_DURATION)
        // balance=1e18, balance*3600 = 1e18*3600, minAmount*duration = 1e18*7200
        // Since 3600 < 7200, balance*1hours < minAmount*duration, so it skips
        _dealOETH(address(boosterMerkl), 1e18);
        _mockMerklDistributor(1e18);

        boosterMerkl.bribe();

        assertEq(oeth.balanceOf(address(boosterMerkl)), 1e18);
    }

    function test_bribe_RevertWhen_minAmountZero() public {
        _dealOETH(address(boosterMerkl), 1e18);
        _mockMerklDistributor(0);

        vm.expectRevert("Min reward amount must be > 0");
        boosterMerkl.bribe();
    }

    function test_bribe_anyoneCanCall() public {
        _dealOETH(address(boosterMerkl), 1e18);
        _mockMerklDistributor(1e10);

        vm.prank(alice);
        boosterMerkl.bribe();

        // Verify bribe executed by checking approval was set
        uint256 allowance = oeth.allowance(address(boosterMerkl), mockMerklDistributor);
        assertEq(allowance, 1e18);
    }
}
