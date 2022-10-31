// SPDX-License-Identifier: Unlicense
pragma solidity 0.8.10;

import "forge-std/Test.sol";
import "../../contracts/upgrades/RewardsSourceProxy.sol";
import "../../contracts/upgrades/OgvStakingProxy.sol";
import "../../contracts/OgvStaking.sol";
import "../../contracts/RewardsSource.sol";
import "../../contracts/tests/MockOgv.sol";

contract OgvStakingTest is Test {
    MockOgv ogv;
    OgvStaking staking;
    RewardsSource source;

    address alice = address(0x42);
    address bob = address(0x43);
    address team = address(0x44);

    uint256 constant EPOCH = 1 days;
    uint256 constant MIN_STAKE_DURATION = 7 days;

    function setUp() public {
        vm.startPrank(team);
        ogv = new MockOgv();
        source = new RewardsSource(address(ogv));

        RewardsSourceProxy rewardsProxy = new RewardsSourceProxy();
        rewardsProxy.initialize(address(source), team, '');
        source = RewardsSource(address(rewardsProxy));

        staking = new OgvStaking(address(ogv), EPOCH, MIN_STAKE_DURATION, address(source));
        OgvStakingProxy stakingProxy = new OgvStakingProxy();
        stakingProxy.initialize(address(staking), team, '');
        staking = OgvStaking(address(stakingProxy));

        source.setRewardsTarget(address(staking));
        vm.stopPrank();

        ogv.mint(alice, 1000 ether);
        ogv.mint(bob, 1000 ether);
        ogv.mint(team, 100000000 ether);

        vm.prank(alice);
        ogv.approve(address(staking), 1e70);
        vm.prank(bob);
        ogv.approve(address(staking), 1e70);
        vm.prank(team);
        ogv.approve(address(source), 1e70);
    }

    function testStakeUnstake() public {
        vm.startPrank(alice);
        (uint256 previewPoints, uint256 previewEnd) = staking.previewPoints(
            10 ether,
            10 days
        );

        uint256 beforeOgv = ogv.balanceOf(alice);
        uint256 beforeOgvStaking = ogv.balanceOf(address(staking));

        staking.stake(10 ether, 10 days);

        assertEq(ogv.balanceOf(alice), beforeOgv - 10 ether);
        assertEq(ogv.balanceOf(address(staking)), beforeOgvStaking + 10 ether);
        assertEq(staking.balanceOf(alice), previewPoints);
        (
            uint128 lockupAmount,
            uint128 lockupEnd,
            uint256 lockupPoints
        ) = staking.lockups(alice, 0);
        assertEq(lockupAmount, 10 ether);
        assertEq(lockupEnd, EPOCH + 10 days);
        assertEq(lockupEnd, previewEnd);
        assertEq(lockupPoints, previewPoints);
        assertEq(
            staking.accRewardPerShare(),
            staking.rewardDebtPerShare(alice)
        );

        vm.warp(31 days);
        staking.unstake(0);

        assertEq(ogv.balanceOf(alice), beforeOgv);
        assertEq(ogv.balanceOf(address(staking)), 0);
        (lockupAmount, lockupEnd, lockupPoints) = staking.lockups(alice, 0);
        assertEq(lockupAmount, 0);
        assertEq(lockupEnd, 0);
        assertEq(lockupPoints, 0);
        assertEq(
            staking.accRewardPerShare(),
            staking.rewardDebtPerShare(alice)
        );
    }

    function testMatchedDurations() public {
        vm.prank(alice);
        staking.stake(10 ether, 1000 days, alice);

        vm.warp(EPOCH + 900 days);
        vm.prank(bob);
        staking.stake(10 ether, 100 days, bob);

        // Now both have 10 OGV staked for 100 days remaining
        // which should mean that they have the same number of points
        assertEq(staking.balanceOf(alice), staking.balanceOf(bob));
    }

    function testPreStaking() public {
        vm.prank(alice);
        staking.stake(100 ether, 100 days, alice);

        vm.warp(EPOCH);
        vm.prank(bob);
        staking.stake(100 ether, 100 days, bob);

        // Both should have the same points
        assertEq(staking.balanceOf(alice), staking.balanceOf(bob));
    }

    function testZeroStake() public {
        vm.prank(alice);
        vm.expectRevert("Staking: Not enough");
        staking.stake(0 ether, 100 days, alice);
    }

    function testStakeTooMuch() public {
        vm.prank(alice);
        vm.expectRevert("Staking: Too much");
        staking.stake(1e70, 100 days, alice);
    }

    function testStakeTooLong() public {
        vm.prank(alice);
        vm.expectRevert("Staking: Too long");
        staking.stake(1 ether, 1700 days, alice);
    }

    function testStakeTooShort() public {
        vm.prank(alice);
        vm.expectRevert("Staking: Too short");
        staking.stake(1 ether, 6 days, alice);
    }

    function testExtend() public {
        vm.prank(alice);
        staking.stake(100 ether, 100 days, alice);

        vm.startPrank(bob);
        staking.stake(100 ether, 10 days, bob);
        staking.extend(0, 100 days);

        // Both are now locked up for the same amount of time,
        // and should have the same points.
        assertEq(staking.balanceOf(alice), staking.balanceOf(bob));

        (uint128 aliceAmount, uint128 aliceEnd, uint256 alicePoints) = staking
            .lockups(alice, 0);
        (uint128 bobAmount, uint128 bobEnd, uint256 bobPoints) = staking
            .lockups(bob, 0);
        assertEq(aliceAmount, bobAmount, "same amount");
        assertEq(aliceEnd, bobEnd, "same end");
        assertEq(alicePoints, bobPoints, "same points");
        assertEq(staking.accRewardPerShare(), staking.rewardDebtPerShare(bob));
    }

    function testDoubleExtend() public {
        vm.warp(EPOCH + 600 days);

        vm.prank(alice);
        staking.stake(100 ether, 100 days, alice);

        vm.startPrank(bob);
        staking.stake(100 ether, 10 days, bob);
        staking.extend(0, 50 days);
        staking.extend(0, 100 days);

        // Both are now locked up for the same amount of time,
        // and should have the same points.
        assertEq(staking.balanceOf(alice), staking.balanceOf(bob));

        (uint128 aliceAmount, uint128 aliceEnd, uint256 alicePoints) = staking
            .lockups(alice, 0);
        (uint128 bobAmount, uint128 bobEnd, uint256 bobPoints) = staking
            .lockups(bob, 0);
        assertEq(aliceAmount, bobAmount, "same amount");
        assertEq(aliceEnd, bobEnd, "same end");
        assertEq(alicePoints, bobPoints, "same points");
    }

    function testShortExtendFail() public {
        vm.prank(alice);
        staking.stake(100 ether, 100 days, alice);

        vm.startPrank(bob);
        staking.stake(100 ether, 11 days, bob);
        vm.expectRevert("Staking: New lockup must be longer");
        staking.extend(0, 10 days);
    }

    function testDoubleStake() external {
        vm.startPrank(alice);

        uint256 beforeOgv = ogv.balanceOf(alice);
        staking.stake(3 ether, 10 days, alice);
        uint256 midOgv = ogv.balanceOf(alice);
        uint256 midPoints = staking.balanceOf(alice);
        staking.stake(5 ether, 40 days, alice);

        vm.warp(EPOCH + 50 days);
        staking.unstake(1);

        assertEq(midPoints, staking.balanceOf(alice));
        assertEq(midOgv, ogv.balanceOf(alice));

        staking.unstake(0);
        assertEq(0, staking.balanceOf(alice)); // No points, since all unstaked
        assertEq(beforeOgv, ogv.balanceOf(alice)); // All OGV back
    }

    function testNoEarlyUnstake() public {
        vm.startPrank(alice);
        staking.stake(10 ether, 1000 days, alice);
        vm.warp(999 days);
        vm.expectRevert("Staking: End of lockup not reached");
        staking.unstake(0);
    }

    function testCollectRewards() public {
        RewardsSource.Slope[] memory slopes = new RewardsSource.Slope[](3);
        slopes[0].start = uint64(EPOCH);
        slopes[0].ratePerDay = 4 ether;
        slopes[1].start = uint64(EPOCH + 2 days);
        slopes[1].ratePerDay = 2 ether;
        slopes[2].start = uint64(EPOCH + 7 days);
        slopes[2].ratePerDay = 1 ether;
        vm.prank(team);
        source.setInflation(slopes); // Add from start

        vm.startPrank(alice);
        staking.stake(1 ether, 360 days, alice);

        vm.warp(EPOCH + 2 days);
        uint256 beforeOgv = ogv.balanceOf(alice);
        uint256 preview = staking.previewRewards(alice);
        staking.collectRewards();
        uint256 afterOgv = ogv.balanceOf(alice);

        uint256 collectedRewards = afterOgv - beforeOgv;
        assertApproxEqAbs(
            collectedRewards,
            8 ether,
            1e8,
            "actual amount should be correct"
        );
        assertEq(collectedRewards, preview, "preview should match actual");
        assertApproxEqAbs(
            preview,
            8 ether,
            1e8,
            "preview amount should be correct"
        );
    }

    function testCollectedRewardsJumpInOut() public {
        RewardsSource.Slope[] memory slopes = new RewardsSource.Slope[](1);
        slopes[0].start = uint64(EPOCH);
        slopes[0].ratePerDay = 2 ether;

        vm.prank(team);
        source.setInflation(slopes);

        vm.prank(alice);
        staking.stake(1 ether, 10 days, alice);

        // One day later
        vm.warp(EPOCH + 1 days);
        vm.prank(alice);
        staking.collectRewards(); // Alice collects

        vm.prank(bob);
        staking.stake(1 ether, 9 days, bob); // Bob stakes

        vm.warp(EPOCH + 2 days); // Alice and bob should split rewards evenly
        uint256 aliceBefore = ogv.balanceOf(alice);
        uint256 bobBefore = ogv.balanceOf(bob);
        vm.prank(alice);
        staking.collectRewards(); // Alice collects
        vm.prank(bob);
        staking.collectRewards(); // Bob collects
        assertEq(
            ogv.balanceOf(alice) - aliceBefore,
            ogv.balanceOf(bob) - bobBefore
        );
    }

    function testMultipleUnstake() public {
        RewardsSource.Slope[] memory slopes = new RewardsSource.Slope[](1);
        slopes[0].start = uint64(EPOCH);
        slopes[0].ratePerDay = 2 ether;

        vm.prank(team);
        source.setInflation(slopes);

        vm.startPrank(alice);
        staking.stake(1 ether, 10 days, alice);
        vm.warp(EPOCH + 11 days);
        staking.unstake(0);
        vm.expectRevert("Staking: Already unstaked this lockup");
        staking.unstake(0);
    }

    function testCollectRewardsOnExpand() public {
        RewardsSource.Slope[] memory slopes = new RewardsSource.Slope[](1);
        slopes[0].start = uint64(EPOCH);
        slopes[0].ratePerDay = 2 ether;

        vm.prank(team);
        source.setInflation(slopes);

        vm.prank(alice);
        staking.stake(1 ether, 10 days);
        vm.prank(bob);
        staking.stake(1 ether, 10 days);

        vm.warp(EPOCH + 6 days);

        vm.prank(bob);
        staking.collectRewards();
        vm.prank(alice);
        staking.extend(0, 10 days);

        assertEq(ogv.balanceOf(alice), ogv.balanceOf(bob));
    }

    function testNoSupplyShortCircuts() public {
        uint256 beforeAlice = ogv.balanceOf(alice);

        vm.prank(alice);
        staking.previewRewards(alice);
        assertEq(ogv.balanceOf(alice), beforeAlice);

        vm.prank(alice);
        staking.collectRewards();
        assertEq(ogv.balanceOf(alice), beforeAlice);

        vm.prank(bob);
        staking.stake(1 ether, 9 days, bob);

        vm.prank(alice);
        staking.previewRewards(alice);
        assertEq(ogv.balanceOf(alice), beforeAlice);

        vm.prank(alice);
        staking.collectRewards();
        assertEq(ogv.balanceOf(alice), beforeAlice);
    }

    function testMultipleStakesSameBlock() public {
        RewardsSource.Slope[] memory slopes = new RewardsSource.Slope[](3);
        slopes[0].start = uint64(EPOCH);
        slopes[0].ratePerDay = 4 ether;
        slopes[1].start = uint64(EPOCH + 2 days);
        slopes[1].ratePerDay = 2 ether;
        slopes[2].start = uint64(EPOCH + 7 days);
        slopes[2].ratePerDay = 1 ether;
        vm.prank(team);
        source.setInflation(slopes); // Add from start

        vm.prank(alice);
        staking.stake(1 ether, 360 days, alice);

        vm.warp(EPOCH + 9 days);

        vm.prank(alice);
        staking.stake(1 ether, 60 days, alice);
        vm.prank(bob);
        staking.stake(1 ether, 90 days, bob);
        vm.prank(alice);
        staking.stake(1 ether, 180 days, alice);
        vm.prank(bob);
        staking.stake(1 ether, 240 days, bob);
        vm.prank(alice);
        staking.stake(1 ether, 360 days, alice);
        vm.prank(alice);
        staking.collectRewards();
        vm.prank(alice);
        staking.collectRewards();
    }

    function testZeroSupplyRewardDebtPerShare() public {
        RewardsSource.Slope[] memory slopes = new RewardsSource.Slope[](1);
        slopes[0].start = uint64(EPOCH);
        slopes[0].ratePerDay = 2 ether;
        vm.prank(team);
        source.setInflation(slopes);

        vm.prank(alice);
        staking.stake(1 ether, 10 days);
        vm.prank(bob);
        staking.stake(1 ether, 10 days);

        // Alice will unstake, setting her rewardDebtPerShare
        vm.warp(EPOCH + 10 days);
        vm.prank(alice);
        staking.unstake(0);

        // Bob unstakes, setting the total supply to zero
        vm.warp(EPOCH + 20 days);
        vm.prank(bob);
        staking.unstake(0);

        // Alice stakes.
        //   Even with the total supply being zero, it is important that
        //   Alice's rewardDebtPerShare per share be set to match the accRewardPerShare
        vm.prank(alice);
        staking.stake(1 ether, 10 days);

        // Alice unstakes later.
        //   If rewardDebtPerShare was wrong, this will fail because she will
        //   try to collect more OGV than the contract has
        vm.warp(EPOCH + 30 days);
        vm.prank(alice);
        staking.unstake(1);
    }

    function testFuzzCanAlwaysWithdraw(
        uint96 amountA,
        uint96 amountB,
        uint64 durationA,
        uint64 durationB,
        uint64 start
    ) public {
        uint256 HUNDRED_YEARS = 100 * 366 days;
        uint256 LAST_START = HUNDRED_YEARS - 1461 days;
        vm.warp(start % LAST_START);

        durationA = durationA % uint64(1461 days);
        durationB = durationB % uint64(1461 days);
        if (durationA < 7 days) {
            durationA = 7 days;
        }
        if (durationB < 7 days) {
            durationB = 7 days;
        }
        if (amountA < 1) {
            amountA = 1;
        }
        if (amountB < 1) {
            amountB = 1;
        }

        RewardsSource.Slope[] memory slopes = new RewardsSource.Slope[](1);
        slopes[0].start = uint64(EPOCH);
        slopes[0].ratePerDay = 2 ether;
        vm.prank(team);
        source.setInflation(slopes);

        vm.prank(alice);
        ogv.mint(alice, amountA);
        vm.prank(alice);
        ogv.approve(address(staking), amountA);
        vm.prank(alice);
        staking.stake(amountA, durationA, alice);

        vm.prank(bob);
        ogv.mint(bob, amountB);
        vm.prank(bob);
        ogv.approve(address(staking), amountB);
        vm.prank(bob);
        staking.stake(amountB, durationB, bob);

        vm.warp(HUNDRED_YEARS);
        vm.prank(alice);
        staking.unstake(0);
        vm.prank(bob);
        staking.unstake(0);
    }

    function testFuzzSemiSanePowerFunction(uint256 start) public {
        uint256 HUNDRED_YEARS = 100 * 366 days;
        start = start % HUNDRED_YEARS;
        vm.warp(start);
        vm.prank(bob);
        staking.stake(1e18, 10 days, bob);
        uint256 y = (356 days + start + 10 days) / 365 days;
        uint256 maxPoints = 2**y * 1e18;
        assertLt(staking.balanceOf(bob), maxPoints);
    }
}
