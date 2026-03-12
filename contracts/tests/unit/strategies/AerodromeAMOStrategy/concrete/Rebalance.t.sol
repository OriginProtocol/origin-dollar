// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_AerodromeAMOStrategy_Shared_Test} from "tests/unit/strategies/AerodromeAMOStrategy/shared/Shared.t.sol";
import {AerodromeAMOStrategy} from "contracts/strategies/aerodrome/AerodromeAMOStrategy.sol";
import {InitializableAbstractStrategy} from "contracts/utils/InitializableAbstractStrategy.sol";

contract Unit_Concrete_AerodromeAMOStrategy_Rebalance_Test is Unit_AerodromeAMOStrategy_Shared_Test {
    function test_rebalance_noSwap() public {
        // Deposit WETH to strategy first
        deal(address(weth), address(aerodromeAMOStrategy), 10 ether);

        // Rebalance with no swap (amountToSwap=0)
        vm.prank(governor);
        aerodromeAMOStrategy.rebalance(0, false, 0);

        // Should have created a position
        assertGt(aerodromeAMOStrategy.tokenId(), 0);
    }

    function test_rebalance_withSwap() public {
        // First create a position via deposit
        _depositAsVault(10 ether);
        mockSugarHelper.setPrincipal(5 ether, 5 ether);

        // Deal some extra WETH for the swap
        deal(address(weth), address(aerodromeAMOStrategy), 2 ether);

        // Pre-fund swap router with OETHb so it can return tokens for the swap
        vm.prank(address(oethBaseVault));
        oethBase.mint(address(mockSwapRouter), 10 ether);

        // Rebalance with swap (WETH -> OETHb)
        vm.prank(governor);
        aerodromeAMOStrategy.rebalance(1 ether, true, 0);
    }

    function test_rebalance_oethbSwap_mintsFromVault() public {
        // Strategy has no OETHb; vault must mint to fund an OETHb→WETH swap.
        // This exercises the `mintForStrategy` branch in _swapToDesiredPosition
        // (lines 546-547 of the strategy).

        // Pre-fund swap router with WETH to return after consuming OETHb
        deal(address(weth), address(mockSwapRouter), 5 ether);

        // Rebalance: swap 1 ether OETHb → WETH (strategy has 0 OETHb → vault mints 1 ether)
        vm.prank(governor);
        aerodromeAMOStrategy.rebalance(1 ether, false, 0);

        // A position must have been created with the WETH received from the swap
        assertGt(aerodromeAMOStrategy.tokenId(), 0);
    }

    function test_rebalance_emitsPoolRebalanced() public {
        deal(address(weth), address(aerodromeAMOStrategy), 10 ether);

        vm.expectEmit(false, false, false, false);
        emit AerodromeAMOStrategy.PoolRebalanced(0);

        vm.prank(governor);
        aerodromeAMOStrategy.rebalance(0, false, 0);
    }

    function test_rebalance_RevertWhen_notGovernorOrStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist or Governor");
        aerodromeAMOStrategy.rebalance(0, false, 0);
    }

    function test_rebalance_calledByStrategist() public {
        deal(address(weth), address(aerodromeAMOStrategy), 10 ether);

        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(0, false, 0);

        assertGt(aerodromeAMOStrategy.tokenId(), 0);
    }

    function test_rebalance_RevertWhen_poolOutOfBounds() public {
        deal(address(weth), address(aerodromeAMOStrategy), 10 ether);

        // Set WETH share to return something outside the allowed range
        // by adjusting the sugar helper to return a large amount for estimateAmount1
        // This will make _getWethShare very small (below allowedWethShareStart)
        mockSugarHelper.setEstimateAmount1(100 ether);

        vm.prank(governor);
        vm.expectRevert(
            abi.encodeWithSelector(
                AerodromeAMOStrategy.PoolRebalanceOutOfBounds.selector,
                0.0099009900990099 ether, // ~1% WETH share (1/(1+100))
                0.02 ether,
                0.5 ether
            )
        );
        aerodromeAMOStrategy.rebalance(0, false, 0);
    }

    function test_rebalance_RevertWhen_outsideExpectedTickRange() public {
        deal(address(weth), address(aerodromeAMOStrategy), 10 ether);

        // Set pool price outside tick range
        _setPoolPriceOutOfRange();

        vm.prank(governor);
        vm.expectRevert(abi.encodeWithSelector(AerodromeAMOStrategy.OutsideExpectedTickRange.selector, int24(-2)));
        aerodromeAMOStrategy.rebalance(0, false, 0);
    }

    function test_rebalance_RevertWhen_protocolInsolvent() public {
        deal(address(weth), address(aerodromeAMOStrategy), 10 ether);

        // Inflate OETHb supply via vault to create insolvency
        // totalValue / totalSupply < 0.998
        vm.prank(address(oethBaseVault));
        oethBase.mint(alice, 1000 ether);

        vm.prank(governor);
        vm.expectRevert("Protocol insolvent");
        aerodromeAMOStrategy.rebalance(0, false, 0);
    }

    function test_rebalance_RevertWhen_unexpectedTokenOwner() public {
        // Create a position – NFT is staked in gauge
        _depositAsVault(10 ether);
        uint256 tid = aerodromeAMOStrategy.tokenId();

        // Transfer the NFT from gauge to an unexpected address (alice)
        // MockCLGauge owns the NFT; as the owner it can transfer it freely
        vm.prank(address(mockCLGauge));
        mockPositionManager.transferFrom(address(mockCLGauge), alice, tid);

        // Any call using the gaugeUnstakeAndRestake modifier now hits
        // _isLpTokenStakedInGauge() which checks ownerOf == gauge || strategy
        vm.prank(governor);
        vm.expectRevert("Unexpected token owner");
        aerodromeAMOStrategy.rebalance(0, false, 0);
    }

    function test_rebalance_RevertWhen_wethShareIntervalNotSet() public {
        // Deploy a fresh strategy without setting the interval
        AerodromeAMOStrategy freshStrategy = new AerodromeAMOStrategy(
            InitializableAbstractStrategy.BaseStrategyConfig({
                platformAddress: address(mockCLPool), vaultAddress: address(oethBaseVault)
            }),
            address(mockWeth),
            address(oethBase),
            address(mockSwapRouter),
            address(mockPositionManager),
            address(mockCLPool),
            address(mockCLGauge),
            address(mockSugarHelper),
            int24(-1),
            int24(0),
            int24(0)
        );

        // Reset initialization state (constructor uses `initializer` modifier)
        vm.store(address(freshStrategy), bytes32(0), bytes32(0));
        vm.store(address(freshStrategy), GOVERNOR_SLOT, bytes32(uint256(uint160(governor))));

        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(aeroToken);
        vm.prank(governor);
        freshStrategy.initialize(rewardTokens);

        deal(address(weth), address(freshStrategy), 10 ether);

        vm.prank(governor);
        vm.expectRevert("Weth share interval not set");
        freshStrategy.rebalance(0, false, 0);
    }
}
