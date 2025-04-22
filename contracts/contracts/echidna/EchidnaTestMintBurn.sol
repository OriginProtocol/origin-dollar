// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./EchidnaDebug.sol";
import "./EchidnaTestAccounting.sol";

/**
 * @title Mixin for testing Mint and Burn functions
 * @author Rappie
 */
contract EchidnaTestMintBurn is EchidnaTestAccounting {
    /**
     * @notice Minting 0 tokens should not affect account balance
     * @param targetAcc Account to mint to
     */
    function testMintZeroBalance(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        mint(targetAcc, 0);
        uint256 balanceAfter = ousd.balanceOf(target);

        assert(balanceAfter == balanceBefore);
    }

    /**
     * @notice Burning 0 tokens should not affect account balance
     * @param targetAcc Account to burn from
     */
    function testBurnZeroBalance(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        burn(targetAcc, 0);
        uint256 balanceAfter = ousd.balanceOf(target);

        assert(balanceAfter == balanceBefore);
    }

    /**
     * @notice Minting tokens must increase the account balance by at least amount
     * @param targetAcc Account to mint to
     * @param amount Amount to mint
     * @custom:error testMintBalance(uint8,uint256): failed!💥
     *   Call sequence:
     *       changeSupply(1)
     *       testMintBalance(0,1)
     *   Event sequence:
     *       Debug(«balanceBefore», 0)
     *       Debug(«balanceAfter», 0)
     */
    function testMintBalance(uint8 targetAcc, uint256 amount)
        public
        hasKnownIssue
        hasKnownIssueWithinLimits
    {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        uint256 amountMinted = mint(targetAcc, amount);
        uint256 balanceAfter = ousd.balanceOf(target);

        Debugger.log("amountMinted", amountMinted);
        Debugger.log("balanceBefore", balanceBefore);
        Debugger.log("balanceAfter", balanceAfter);

        assert(balanceAfter >= balanceBefore + amountMinted);
    }

    /**
     * @notice Burning tokens must decrease the account balance by at least amount
     * @param targetAcc Account to burn from
     * @param amount Amount to burn
     * @custom:error testBurnBalance(uint8,uint256): failed!💥
     *   Call sequence:
     *       changeSupply(1)
     *       mint(0,3)
     *       testBurnBalance(0,1)
     *   Event sequence:
     *       Debug(«balanceBefore», 2)
     *       Debug(«balanceAfter», 2)
     */
    function testBurnBalance(uint8 targetAcc, uint256 amount)
        public
        hasKnownIssue
        hasKnownIssueWithinLimits
    {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        burn(targetAcc, amount);
        uint256 balanceAfter = ousd.balanceOf(target);

        Debugger.log("balanceBefore", balanceBefore);
        Debugger.log("balanceAfter", balanceAfter);

        assert(balanceAfter <= balanceBefore - amount);
    }

    /**
     * @notice Minting tokens should not increase the account balance by less than rounding error above amount
     * @param targetAcc Account to mint to
     * @param amount Amount to mint
     */
    function testMintBalanceRounding(uint8 targetAcc, uint256 amount) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        uint256 amountMinted = mint(targetAcc, amount);
        uint256 balanceAfter = ousd.balanceOf(target);

        int256 delta = int256(balanceAfter) - int256(balanceBefore);

        // delta == amount, if no error
        // delta < amount,  if too little is minted
        // delta > amount,  if too much is minted
        int256 error = int256(amountMinted) - delta;

        assert(error >= 0);
        assert(error <= int256(MINT_ROUNDING_ERROR));
    }

    /**
     * @notice A burn of an account balance must result in a zero balance
     * @param targetAcc Account to burn from
     */
    function testBurnAllBalanceToZero(uint8 targetAcc) public hasKnownIssue {
        address target = getAccount(targetAcc);

        burn(targetAcc, ousd.balanceOf(target));
        assert(ousd.balanceOf(target) == 0);
    }

    /**
     * @notice You should always be able to burn an account's balance
     * @param targetAcc Account to burn from
     */
    function testBurnAllBalanceShouldNotRevert(uint8 targetAcc)
        public
        hasKnownIssue
    {
        address target = getAccount(targetAcc);
        uint256 balance = ousd.balanceOf(target);

        hevm.prank(ADDRESS_VAULT);
        try ousd.burn(target, balance) {
            assert(true);
        } catch {
            assert(false);
        }
    }
}
