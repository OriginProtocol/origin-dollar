// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// --- Test base
import {Smoke_AerodromeAMOStrategy_Shared_Test} from "../shared/Shared.t.sol";

// --- Test utilities
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

// --- External libraries
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// --- Project imports
import {INonfungiblePositionManager} from "contracts/interfaces/aerodrome/INonfungiblePositionManager.sol";

contract Smoke_Concrete_AerodromeAMOStrategy_Rebalance_Test is Smoke_AerodromeAMOStrategy_Shared_Test {
    function setUp() public override {
        super.setUp();
        _pushPoolPriceIntoRange();
        _widenAllowedWethShareInterval();
    }

    function test_rebalance_noSwap() public {
        _depositToStrategy(1 ether);

        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(address(weth));
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);
        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(address(weth));

        // Rebalance without swap just adds liquidity — checkBalance should be approximately the same
        assertApproxEqRel(
            balanceAfter, balanceBefore, 0.01 ether, "checkBalance should be stable after no-swap rebalance"
        );
    }

    function test_rebalance_withQuotedAmount() public {
        _depositToStrategy(5 ether);

        _quoteAndRebalance(type(uint256).max, type(uint256).max);

        uint256 share = aerodromeAMOStrategy.getWETHShare();
        uint256 start = aerodromeAMOStrategy.allowedWethShareStart();
        uint256 end = aerodromeAMOStrategy.allowedWethShareEnd();
        assertGe(share, start, "WETH share should be within allowed range (start)");
        assertLe(share, end, "WETH share should be within allowed range (end)");
    }

    function test_rebalance_lpRestakedInGauge() public {
        _depositToStrategy(1 ether);
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        uint256 _tokenId = aerodromeAMOStrategy.tokenId();
        INonfungiblePositionManager pm = INonfungiblePositionManager(BaseAddresses.nonFungiblePositionManager);
        assertEq(pm.ownerOf(_tokenId), BaseAddresses.aerodromeOETHbWETHClGauge, "LP should be staked in gauge");
    }

    function test_rebalance_noResidualTokens() public {
        _depositToStrategy(5 ether);
        _quoteAndRebalance(type(uint256).max, type(uint256).max);

        assertLe(weth.balanceOf(address(aerodromeAMOStrategy)), 0.00001 ether, "Residual WETH on strategy");
        assertEq(IERC20(address(oethBase)).balanceOf(address(aerodromeAMOStrategy)), 0, "Residual OETHb on strategy");
    }

    function test_rebalance_checkBalanceIncreases() public {
        uint256 balanceBefore = aerodromeAMOStrategy.checkBalance(address(weth));
        _depositToStrategy(5 ether);
        _quoteAndRebalance(type(uint256).max, type(uint256).max);
        uint256 balanceAfter = aerodromeAMOStrategy.checkBalance(address(weth));
        assertGt(balanceAfter, balanceBefore, "checkBalance should increase after deposit+rebalance");
    }

    function test_rebalance_multipleDepositsAndRebalances() public {
        // First cycle: deposit triggers auto-rebalance (pool is in range from setUp)
        _depositToStrategy(2 ether);
        uint256 balanceAfterFirst = aerodromeAMOStrategy.checkBalance(address(weth));
        assertGt(balanceAfterFirst, 0, "checkBalance should be > 0 after first deposit");

        // Second cycle: deposit triggers another auto-rebalance
        _depositToStrategy(2 ether);
        uint256 balanceAfterSecond = aerodromeAMOStrategy.checkBalance(address(weth));

        // Second deposit should increase checkBalance
        assertGt(balanceAfterSecond, balanceAfterFirst, "checkBalance should increase after second deposit");
    }

    function test_rebalance_succeeds() public {
        _depositToStrategy(1 ether);

        // Rebalance should succeed without reverting when pool is in range
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, true, 0);

        // Verify state is consistent after rebalance
        assertGt(aerodromeAMOStrategy.checkBalance(address(weth)), 0, "checkBalance should be > 0 after rebalance");
    }
}
