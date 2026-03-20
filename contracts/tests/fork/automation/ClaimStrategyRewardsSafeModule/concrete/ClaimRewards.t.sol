// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {
    Fork_ClaimStrategyRewardsSafeModule_Shared_Test
} from "tests/fork/automation/ClaimStrategyRewardsSafeModule/shared/Shared.t.sol";

contract Fork_Concrete_ClaimStrategyRewardsSafeModule_ClaimRewards_Test is
    Fork_ClaimStrategyRewardsSafeModule_Shared_Test
{
    function test_claimCRVRewards() public {
        address[] memory strategies = new address[](2);
        strategies[0] = ousdCurveAMOProxy;
        strategies[1] = oethCurveAMOProxy;

        // Sum up CRV across strategies
        uint256 crvInStrategies;
        for (uint256 i = 0; i < strategies.length; i++) {
            crvInStrategies += crv.balanceOf(strategies[i]);
        }

        uint256 crvBalanceBefore = crv.balanceOf(safeSigner);

        vm.prank(safeSigner);
        claimStrategyRewardsModule.claimRewards(true);

        uint256 crvBalanceAfter = crv.balanceOf(safeSigner);

        assertGe(crvBalanceAfter, crvBalanceBefore + crvInStrategies, "CRV balance should increase");

        // All CRV should have been swept from strategies
        for (uint256 i = 0; i < strategies.length; i++) {
            assertEq(crv.balanceOf(strategies[i]), 0, "Strategy should have 0 CRV");
        }
    }

    function test_claimMorphoRewards() public {
        address[] memory strategies = new address[](3);
        strategies[0] = morphoGauntletUSDCProxy;
        strategies[1] = morphoGauntletUSDTProxy;
        strategies[2] = metaMorphoProxy;

        // Sum up Morpho across strategies
        uint256 morphoInStrategies;
        for (uint256 i = 0; i < strategies.length; i++) {
            morphoInStrategies += morphoToken.balanceOf(strategies[i]);
        }

        uint256 morphoBalanceBefore = morphoToken.balanceOf(safeSigner);

        vm.prank(safeSigner);
        claimStrategyRewardsModule.claimRewards(true);

        uint256 morphoBalanceAfter = morphoToken.balanceOf(safeSigner);

        assertGe(morphoBalanceAfter, morphoBalanceBefore + morphoInStrategies, "Morpho balance should increase");

        // All Morpho should have been swept from strategies
        for (uint256 i = 0; i < strategies.length; i++) {
            assertEq(morphoToken.balanceOf(strategies[i]), 0, "Strategy should have 0 Morpho");
        }
    }
}
