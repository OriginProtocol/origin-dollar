// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./EchidnaTestMintBurn.sol";
import "./Debugger.sol";

/**
 * @title Mixin for testing approval related functions
 * @author Rappie
 */
contract EchidnaTestApproval is EchidnaTestMintBurn {
    /**
     * @notice Performing `transferFrom` with an amount inside the allowance should not revert
     * @param authorizedAcc The account that is authorized to transfer
     * @param fromAcc The account that is transferring
     * @param toAcc The account that is receiving
     * @param amount The amount to transfer
     */
    function testTransferFromShouldNotRevert(
        uint8 authorizedAcc,
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address authorized = getAccount(authorizedAcc);
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        require(amount <= ousd.balanceOf(from));
        require(amount <= ousd.allowance(from, authorized));

        hevm.prank(authorized);
        // slither-disable-next-line unchecked-transfer
        try ousd.transferFrom(from, to, amount) {
            // pass
        } catch {
            assert(false);
        }
    }

    /**
     * @notice Performing `transferFrom` with an amount outside the allowance should revert
     * @param authorizedAcc The account that is authorized to transfer
     * @param fromAcc The account that is transferring
     * @param toAcc The account that is receiving
     * @param amount The amount to transfer
     */
    function testTransferFromShouldRevert(
        uint8 authorizedAcc,
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address authorized = getAccount(authorizedAcc);
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);

        require(amount > 0);
        require(
            !(amount <= ousd.balanceOf(from) &&
                amount <= ousd.allowance(from, authorized))
        );

        hevm.prank(authorized);
        // slither-disable-next-line unchecked-transfer
        try ousd.transferFrom(from, to, amount) {
            assert(false);
        } catch {
            // pass
        }
    }

    /**
     * @notice Approving an amount should update the allowance and overwrite any previous allowance
     * @param ownerAcc The account that is approving
     * @param spenderAcc The account that is being approved
     * @param amount The amount to approve
     */
    function testApprove(
        uint8 ownerAcc,
        uint8 spenderAcc,
        uint256 amount
    ) public {
        address owner = getAccount(ownerAcc);
        address spender = getAccount(spenderAcc);

        approve(ownerAcc, spenderAcc, amount);
        uint256 allowanceAfter1 = ousd.allowance(owner, spender);

        assert(allowanceAfter1 == amount);

        approve(ownerAcc, spenderAcc, amount / 2);
        uint256 allowanceAfter2 = ousd.allowance(owner, spender);

        assert(allowanceAfter2 == amount / 2);
    }
}
