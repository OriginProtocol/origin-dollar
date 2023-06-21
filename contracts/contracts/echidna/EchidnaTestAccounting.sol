// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EchidnaDebug.sol";
import "./EchidnaTestSupply.sol";

contract EchidnaTestAccounting is EchidnaTestSupply {
    // After opting in, balance should not increase. (Ok to lose rounding funds doing this)
    function testOptInBalance(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        optIn(targetAcc);
        uint256 balanceAfter = ousd.balanceOf(target);

        assert(balanceAfter <= balanceBefore);
    }

    // After opting out, balance should remain the same
    function testOptOutBalance(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        optOut(targetAcc);
        uint256 balanceAfter = ousd.balanceOf(target);

        assert(balanceAfter == balanceBefore);
    }

    // Account balance should remain the same after opting in minus rounding error
    function testOptInBalanceRounding(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        optIn(targetAcc);
        uint256 balanceAfter = ousd.balanceOf(target);

        int256 delta = int256(balanceAfter) - int256(balanceBefore);
        Debugger.log("delta", delta);

        assert(-1 * delta >= 0);
        assert(-1 * delta <= int256(OPT_IN_ROUNDING_ERROR));
    }

    // After opting in, total supply should remain the same
    function testOptInTotalSupply(uint8 targetAcc) public {
        uint256 totalSupplyBefore = ousd.totalSupply();
        optIn(targetAcc);
        uint256 totalSupplyAfter = ousd.totalSupply();

        assert(totalSupplyAfter == totalSupplyBefore);
    }

    // After opting out, total supply should remain the same
    function testOptOutTotalSupply(uint8 targetAcc) public {
        uint256 totalSupplyBefore = ousd.totalSupply();
        optOut(targetAcc);
        uint256 totalSupplyAfter = ousd.totalSupply();

        assert(totalSupplyAfter == totalSupplyBefore);
    }

    // Account balance should remain the same when a smart contract auto converts
    function testAutoConvertBalance(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        uint256 balanceBefore = ousd.balanceOf(target);
        ousd._isNonRebasingAccountEchidna(target);
        uint256 balanceAfter = ousd.balanceOf(target);

        assert(balanceAfter == balanceBefore);
    }

    // The `balanceOf` function should never revert
    function testBalanceOfShouldNotRevert(uint8 targetAcc) public {
        address target = getAccount(targetAcc);

        try ousd.balanceOf(target) {
            assert(true);
        } catch {
            assert(false);
        }
    }
}
