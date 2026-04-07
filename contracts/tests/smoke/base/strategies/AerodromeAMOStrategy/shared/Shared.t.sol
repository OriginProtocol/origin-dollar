// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {BaseSmoke} from "tests/smoke/BaseSmoke.t.sol";
import {Base as BaseAddresses} from "tests/utils/Addresses.sol";

import {AerodromeAMOQuoter, QuoterHelper} from "contracts/utils/AerodromeAMOQuoter.sol";
import {ISwapRouter} from "contracts/interfaces/aerodrome/ISwapRouter.sol";
import {IOToken} from "contracts/interfaces/IOToken.sol";
import {IVault} from "contracts/interfaces/IVault.sol";
import {IAerodromeAMOStrategy} from "contracts/interfaces/strategies/IAerodromeAMOStrategy.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract Smoke_AerodromeAMOStrategy_Shared_Test is BaseSmoke {
    IOToken internal oethBase;
    IVault internal oethBaseVault;
    IAerodromeAMOStrategy internal aerodromeAMOStrategy;
    AerodromeAMOQuoter internal aerodromeAMOQuoter;

    //////////////////////////////////////////////////////
    /// --- SETUP
    //////////////////////////////////////////////////////

    function setUp() public virtual override {
        super.setUp();
        _createAndSelectForkBase();
        _igniteDeployManager();
        _fetchContracts();
        _resolveActors();
        _labelContracts();
    }

    function _fetchContracts() internal virtual {
        require(address(resolver).code.length > 0, "Resolver not initialized on fork");

        oethBase = IOToken(resolver.resolve("OETHBASE_PROXY"));
        oethBaseVault = IVault(resolver.resolve("OETHBASE_VAULT_PROXY"));
        aerodromeAMOStrategy = IAerodromeAMOStrategy(resolver.resolve("AERODROME_AMO_STRATEGY_PROXY"));
        weth = IERC20(BaseAddresses.WETH);

        // Deploy fresh quoter as test helper
        aerodromeAMOQuoter = new AerodromeAMOQuoter(address(aerodromeAMOStrategy), BaseAddresses.quoterV2);
    }

    function _resolveActors() internal virtual {
        governor = aerodromeAMOStrategy.governor();
        strategist = oethBaseVault.strategistAddr();
    }

    function _labelContracts() internal virtual {
        vm.label(address(oethBase), "OETHBase");
        vm.label(address(oethBaseVault), "OETHBaseVault");
        vm.label(address(aerodromeAMOStrategy), "AerodromeAMOStrategy");
        vm.label(address(weth), "WETH");
    }

    //////////////////////////////////////////////////////
    /// --- HELPERS
    //////////////////////////////////////////////////////

    /// @dev Deal WETH to strategy and call deposit as vault
    function _depositToStrategy(uint256 amount) internal {
        deal(address(weth), address(aerodromeAMOStrategy), amount);
        vm.prank(address(oethBaseVault));
        aerodromeAMOStrategy.deposit(address(weth), amount);
    }

    /// @dev Push the pool price into the strategy's tick range [-1, 0) by swapping through the pool.
    ///      If the price is already in range, this is a no-op.
    function _pushPoolPriceIntoRange() internal {
        uint160 currentPrice = aerodromeAMOStrategy.getPoolX96Price();
        uint160 lowerPrice = aerodromeAMOStrategy.sqrtRatioX96TickLower();
        uint160 higherPrice = aerodromeAMOStrategy.sqrtRatioX96TickHigher();

        // Target: midpoint of the strategy's tick range
        uint160 targetPrice = lowerPrice + (higherPrice - lowerPrice) / 2;

        if (currentPrice > higherPrice) {
            // Price is above range → swap WETH in (zeroForOne) to push price down
            uint256 amount = 10_000 ether;
            deal(address(weth), address(this), amount);
            IERC20(address(weth)).approve(BaseAddresses.swapRouter, amount);
            ISwapRouter(BaseAddresses.swapRouter)
                .exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: address(weth),
                        tokenOut: address(oethBase),
                        tickSpacing: int24(1),
                        recipient: address(this),
                        deadline: block.timestamp,
                        amountIn: amount,
                        amountOutMinimum: 0,
                        sqrtPriceLimitX96: targetPrice
                    })
                );
        } else if (currentPrice < lowerPrice) {
            // Price is below range → swap OETHb in to push price up
            // Mint OETHb by dealing WETH to vault and minting
            uint256 amount = 10_000 ether;
            deal(address(weth), address(this), amount);
            IERC20(address(weth)).approve(address(oethBaseVault), amount);
            oethBaseVault.mint(amount);
            IERC20(address(oethBase)).approve(BaseAddresses.swapRouter, amount);
            ISwapRouter(BaseAddresses.swapRouter)
                .exactInputSingle(
                    ISwapRouter.ExactInputSingleParams({
                        tokenIn: address(oethBase),
                        tokenOut: address(weth),
                        tickSpacing: int24(1),
                        recipient: address(this),
                        deadline: block.timestamp,
                        amountIn: amount,
                        amountOutMinimum: 0,
                        sqrtPriceLimitX96: targetPrice
                    })
                );
        }
        // If already in range, do nothing
    }

    /// @dev Widen the allowed WETH share interval to [1.1%, 94.9%] so rebalance works at any in-range price.
    function _widenAllowedWethShareInterval() internal {
        vm.prank(governor);
        aerodromeAMOStrategy.setAllowedPoolWethShareInterval(0.011 ether, 0.949 ether);
    }

    /// @dev Use the quoter to find swap amount for rebalance, then execute rebalance.
    ///      Handles governance transfer to quoterHelper for binary search.
    /// @param overrideBottom New allowedWethShareStart (type(uint256).max to keep current)
    /// @param overrideTop New allowedWethShareEnd (type(uint256).max to keep current)
    function _quoteAndRebalance(uint256 overrideBottom, uint256 overrideTop) internal {
        QuoterHelper quoterHelper = aerodromeAMOQuoter.quoterHelper();

        // Transfer governance to quoterHelper so it can call rebalance in try/catch
        vm.prank(governor);
        aerodromeAMOStrategy.transferGovernance(address(quoterHelper));
        aerodromeAMOQuoter.claimGovernance();

        // Quote the amount
        AerodromeAMOQuoter.Data memory data =
            aerodromeAMOQuoter.quoteAmountToSwapBeforeRebalance(overrideBottom, overrideTop);

        // Give back governance
        aerodromeAMOQuoter.giveBackGovernance();
        vm.prank(governor);
        aerodromeAMOStrategy.claimGovernance();

        // Execute rebalance with quoted amount
        bool swapWeth = quoterHelper.getSwapDirectionForRebalance();
        uint256 minAmount = (data.amount * 99) / 100;
        vm.prank(strategist);
        aerodromeAMOStrategy.rebalance(data.amount, swapWeth, minAmount);
    }
}
