// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {Unit_BaseCurveAMOStrategy_Shared_Test} from "tests/unit/strategies/BaseCurveAMOStrategy/shared/Shared.t.sol";
import {IBaseCurveAMOStrategy} from "contracts/interfaces/strategies/IBaseCurveAMOStrategy.sol";

contract Unit_Concrete_BaseCurveAMOStrategy_MintAndAddOTokens_Test is Unit_BaseCurveAMOStrategy_Shared_Test {
    function test_mintAndAddOTokens_mintsAndAddsToPool() public {
        uint256 oTokenAmount = 10 ether;
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(200 ether, 100 ether);

        uint256 supplyBefore = oeth.totalSupply();

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(oTokenAmount);

        assertGt(oeth.totalSupply(), supplyBefore);
        assertGt(curveGauge.balanceOf(address(baseCurveAMOStrategy)), 0);
    }

    function test_mintAndAddOTokens_improvesBalance_poolTiltedToWeth() public {
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(200 ether, 100 ether);

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(50 ether);
    }

    function test_mintAndAddOTokens_emitsDeposit() public {
        uint256 oTokenAmount = 10 ether;
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(200 ether, 100 ether);

        vm.expectEmit(true, true, true, true);
        emit IBaseCurveAMOStrategy.Deposit(address(oeth), address(curvePool), oTokenAmount);

        vm.prank(strategist);
        baseCurveAMOStrategy.mintAndAddOTokens(oTokenAmount);
    }

    function test_mintAndAddOTokens_RevertWhen_calledByNonStrategist() public {
        vm.prank(alice);
        vm.expectRevert("Caller is not the Strategist");
        baseCurveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_poolBalanced() public {
        _seedVaultForSolvency(100 ether);
        _setupPoolBalances(100 ether, 100 ether);

        vm.prank(strategist);
        vm.expectRevert("Position balance is worsened");
        baseCurveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_poolTiltedToOeth() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(100 ether, 200 ether);

        vm.prank(strategist);
        vm.expectRevert("OTokens balance worse");
        baseCurveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_overshoots() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(110 ether, 100 ether);

        vm.prank(strategist);
        vm.expectRevert("Assets overshot peg");
        baseCurveAMOStrategy.mintAndAddOTokens(50 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_protocolInsolvent() public {
        vm.prank(address(oethVault));
        oeth.mint(alice, 1000 ether);

        _setupPoolBalances(200 ether, 100 ether);

        vm.prank(strategist);
        vm.expectRevert("Protocol insolvent");
        baseCurveAMOStrategy.mintAndAddOTokens(10 ether);
    }

    function test_mintAndAddOTokens_RevertWhen_minLpAmountError() public {
        _seedVaultForSolvency(1000 ether);
        _setupPoolBalances(200 ether, 100 ether);

        curvePool.setSlippageBps(500);

        vm.prank(strategist);
        vm.expectRevert("Min LP amount error");
        baseCurveAMOStrategy.mintAndAddOTokens(10 ether);
    }
}
