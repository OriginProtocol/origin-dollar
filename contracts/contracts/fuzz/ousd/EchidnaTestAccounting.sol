// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EchidnaDebug.sol";
import "./EchidnaTestSupply.sol";

/**
 * @title Mixin for testing accounting functions
 * @author Rappie
 */
contract EchidnaTestAccounting is EchidnaTestSupply {
    /**
     * @notice After opting in, balance should not increase. (Ok to lose rounding funds doing this)
     * @param targetAcc Account to opt in
     */
    function testOptInBalance(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        optIn(targetAcc);
        uint256 balanceAfter = ousd.balanceOf(target);

        assert(balanceAfter <= balanceBefore);
    }

    /**
     * @notice After opting out, balance should remain the same
     * @param targetAcc Account to opt out
     */
    function testOptOutBalance(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        optOut(targetAcc);
        uint256 balanceAfter = ousd.balanceOf(target);

        assert(balanceAfter == balanceBefore);
    }

    /**
     * @notice Account balance should remain the same after opting in minus rounding error
     * @param targetAcc Account to opt in
     */
    function testOptInBalanceRounding(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        optIn(targetAcc);
        uint256 balanceAfter = ousd.balanceOf(target);

        int256 delta = int256(balanceAfter) - int256(balanceBefore);
        Debugger.log("delta", delta);

        // slither-disable-next-line tautology
        assert(-1 * delta >= 0);
        assert(-1 * delta <= int256(OPT_IN_ROUNDING_ERROR));
    }

    /**
     * @notice After opting in, total supply should remain the same
     * @param targetAcc Account to opt in
     */
    function testOptInTotalSupply(uint8 targetAcc) public {
        uint256 totalSupplyBefore = ousd.totalSupply();
        optIn(targetAcc);
        uint256 totalSupplyAfter = ousd.totalSupply();

        assert(totalSupplyAfter == totalSupplyBefore);
    }

    /**
     * @notice After opting out, total supply should remain the same
     * @param targetAcc Account to opt out
     */
    function testOptOutTotalSupply(uint8 targetAcc) public {
        uint256 totalSupplyBefore = ousd.totalSupply();
        optOut(targetAcc);
        uint256 totalSupplyAfter = ousd.totalSupply();

        assert(totalSupplyAfter == totalSupplyBefore);
    }

    /**
     * @notice Account balance should remain the same when a smart contract auto converts
     * @param targetAcc Account to auto convert
     */
    function testAutoConvertBalance(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        // slither-disable-next-line unused-return
        ousd._isNonRebasingAccountEchidna(target);
        uint256 balanceAfter = ousd.balanceOf(target);

        assert(balanceAfter == balanceBefore);
    }

    /**
     * @notice The `balanceOf` function should never revert
     * @param targetAcc Account to check balance of
     */
    function testBalanceOfShouldNotRevert(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        // slither-disable-next-line unused-return
        try ousd.balanceOf(target) {
            assert(true);
        } catch {
            assert(false);
        }
    }
}
