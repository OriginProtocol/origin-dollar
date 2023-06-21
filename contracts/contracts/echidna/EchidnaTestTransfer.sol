// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EchidnaDebug.sol";
import "./Debugger.sol";

contract EchidnaTestTransfer is EchidnaDebug {
    // The receiving account's balance after a transfer must not increase by less than the amount transferred
    //
    // testTransferBalanceReceivedLess(uint8,uint8,uint256): failed!💥
    //   Call sequence:
    //     changeSupply(1)
    //     mint(64,2)
    //     testTransferBalanceReceivedLess(64,0,1)
    //
    //   Event sequence:
    //     Debug(«totalSupply», 1000000000000000000500002)
    //     Debug(«toBalBefore», 0)
    //     Debug(«toBalAfter», 0)
    //
    function testTransferBalanceReceivedLess(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public hasKnownIssue hasKnownIssueWithinLimits {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        require(from != to);

        uint256 toBalBefore = ousd.balanceOf(to);
        transfer(fromAcc, toAcc, amount);
        uint256 toBalAfter = ousd.balanceOf(to);

        Debugger.log("totalSupply", ousd.totalSupply());
        Debugger.log("toBalBefore", toBalBefore);
        Debugger.log("toBalAfter", toBalAfter);

        assert(toBalAfter >= toBalBefore + amount);
    }

    // The receiving account's balance after a transfer must not increase by more than the amount transferred
    function testTransferBalanceReceivedMore(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        require(from != to);

        uint256 toBalBefore = ousd.balanceOf(to);
        transfer(fromAcc, toAcc, amount);
        uint256 toBalAfter = ousd.balanceOf(to);

        Debugger.log("totalSupply", ousd.totalSupply());
        Debugger.log("toBalBefore", toBalBefore);
        Debugger.log("toBalAfter", toBalAfter);

        assert(toBalAfter <= toBalBefore + amount);
    }

    // The sending account's balance after a transfer must not decrease by less than the amount transferred
    //
    // testTransferBalanceSentLess(uint8,uint8,uint256): failed!💥
    //   Call sequence:
    //     mint(0,1)
    //     changeSupply(1)
    //     testTransferBalanceSentLess(0,64,1)
    //
    //   Event sequence:
    //     Debug(«totalSupply», 1000000000000000000500001)
    //     Debug(«fromBalBefore», 1)
    //     Debug(«fromBalAfter», 1)
    //
    function testTransferBalanceSentLess(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public hasKnownIssue hasKnownIssueWithinLimits {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        require(from != to);

        uint256 fromBalBefore = ousd.balanceOf(from);
        transfer(fromAcc, toAcc, amount);
        uint256 fromBalAfter = ousd.balanceOf(from);

        Debugger.log("totalSupply", ousd.totalSupply());
        Debugger.log("fromBalBefore", fromBalBefore);
        Debugger.log("fromBalAfter", fromBalAfter);

        assert(fromBalAfter <= fromBalBefore - amount);
    }

    // The sending account's balance after a transfer must not decrease by more than the amount transferred
    function testTransferBalanceSentMore(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        require(from != to);

        uint256 fromBalBefore = ousd.balanceOf(from);
        transfer(fromAcc, toAcc, amount);
        uint256 fromBalAfter = ousd.balanceOf(from);

        Debugger.log("totalSupply", ousd.totalSupply());
        Debugger.log("fromBalBefore", fromBalBefore);
        Debugger.log("fromBalAfter", fromBalAfter);

        assert(fromBalAfter >= fromBalBefore - amount);
    }

    // The receiving account's balance after a transfer must not increase by less than the amount transferred (minus rounding error)
    function testTransferBalanceReceivedLessRounding(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        require(from != to);

        uint256 toBalBefore = ousd.balanceOf(to);
        transfer(fromAcc, toAcc, amount);
        uint256 toBalAfter = ousd.balanceOf(to);

        int256 toDelta = int256(toBalAfter) - int256(toBalBefore);

        // delta == amount, if no error
        // delta < amount,  if too little is sent
        // delta > amount,  if too much is sent
        int256 error = int256(amount) - toDelta;

        Debugger.log("totalSupply", ousd.totalSupply());
        Debugger.log("toBalBefore", toBalBefore);
        Debugger.log("toBalAfter", toBalAfter);
        Debugger.log("toDelta", toDelta);
        Debugger.log("error", error);

        assert(error >= 0);
        assert(error <= int256(TRANSFER_ROUNDING_ERROR));
    }

    // The sending account's balance after a transfer must not decrease by less than the amount transferred (minus rounding error)
    function testTransferBalanceSentLessRounding(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        require(from != to);

        uint256 fromBalBefore = ousd.balanceOf(from);
        transfer(fromAcc, toAcc, amount);
        uint256 fromBalAfter = ousd.balanceOf(from);

        int256 fromDelta = int256(fromBalAfter) - int256(fromBalBefore);

        // delta == -amount, if no error
        // delta < -amount,  if too much is sent
        // delta > -amount,  if too little is sent
        int256 error = int256(amount) + fromDelta;

        Debugger.log("totalSupply", ousd.totalSupply());
        Debugger.log("fromBalBefore", fromBalBefore);
        Debugger.log("fromBalAfter", fromBalAfter);
        Debugger.log("fromDelta", fromDelta);
        Debugger.log("error", error);

        assert(error >= 0);
        assert(error <= int256(TRANSFER_ROUNDING_ERROR));
    }

    // An account should always be able to successfully transfer an amount within its balance.
    //
    // testTransferWithinBalanceDoesNotRevert(uint8,uint8,uint8): failed!💥
    //   Call sequence:
    //       mint(0,1)
    //       changeSupply(3)
    //       optOut(0)
    //       testTransferWithinBalanceDoesNotRevert(0,128,2)
    //       optIn(0)
    //       testTransferWithinBalanceDoesNotRevert(128,0,1)
    //
    //   Event sequence:
    //       error Revert Panic(17): SafeMath over-/under-flows
    //
    function testTransferWithinBalanceDoesNotRevert(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public hasKnownIssue {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        require(amount > 0);
        amount = amount % ousd.balanceOf(from);

        Debugger.log("Total supply", ousd.totalSupply());

        hevm.prank(from);
        try ousd.transfer(to, amount) {
            assert(true);
        } catch {
            assert(false);
        }
    }

    // An account should never be able to successfully transfer an amount greater than their balance.
    function testTransferExceedingBalanceReverts(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        amount = ousd.balanceOf(from) + 1 + amount;

        hevm.prank(from);
        try ousd.transfer(to, amount) {
            assert(false);
        } catch {
            assert(true);
        }
    }

    // A transfer to the same account should not change that account's balance
    function testTransferSelf(uint8 targetAcc, uint256 amount) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        transfer(targetAcc, targetAcc, amount);
        uint256 balanceAfter = ousd.balanceOf(target);

        assert(balanceBefore == balanceAfter);
    }

    // Transfers to the zero account revert
    function testTransferToZeroAddress(uint8 fromAcc, uint256 amount) public {
        address from = getAccount(fromAcc);

        hevm.prank(from);
        try ousd.transfer(address(0), amount) {
            assert(false);
        } catch {
            assert(true);
        }
    }
}
