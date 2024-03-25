// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EchidnaSetup.sol";
import "./Debugger.sol";

/**
 * @title Mixin containing helper functions
 * @author Rappie
 */
contract EchidnaHelper is EchidnaSetup {
    /**
     * @notice Mint tokens to an account
     * @param toAcc Account to mint to
     * @param amount Amount to mint
     * @return Amount minted (in case of capped mint with modulo)
     */
    function mint(uint8 toAcc, uint256 amount) public returns (uint256) {
        address to = getAccount(toAcc);

        if (TOGGLE_MINT_LIMIT) {
            amount = amount % MINT_MODULO;
        }

        hevm.prank(ADDRESS_VAULT);
        ousd.mint(to, amount);

        return amount;
    }

    /**
     * @notice Burn tokens from an account
     * @param fromAcc Account to burn from
     * @param amount Amount to burn
     */
    function burn(uint8 fromAcc, uint256 amount) public {
        address from = getAccount(fromAcc);
        hevm.prank(ADDRESS_VAULT);
        ousd.burn(from, amount);
    }

    /**
     * @notice Change the total supply of OUSD (rebase)
     * @param amount New total supply
     */
    function changeSupply(uint256 amount) public {
        if (TOGGLE_CHANGESUPPLY_LIMIT) {
            amount =
                ousd.totalSupply() +
                (amount % (ousd.totalSupply() / CHANGESUPPLY_DIVISOR));
        }

        hevm.prank(ADDRESS_VAULT);
        ousd.changeSupply(amount);
    }

    /**
     * @notice Transfer tokens between accounts
     * @param fromAcc Account to transfer from
     * @param toAcc Account to transfer to
     * @param amount Amount to transfer
     */
    function transfer(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);
        hevm.prank(from);
        // slither-disable-next-line unchecked-transfer
        ousd.transfer(to, amount);
    }

    /**
     * @notice Transfer approved tokens between accounts
     * @param authorizedAcc Account that is authorized to transfer
     * @param fromAcc Account to transfer from
     * @param toAcc Account to transfer to
     * @param amount Amount to transfer
     */
    function transferFrom(
        uint8 authorizedAcc,
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address authorized = getAccount(authorizedAcc);
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);
        hevm.prank(authorized);
        // slither-disable-next-line unchecked-transfer
        ousd.transferFrom(from, to, amount);
    }

    /**
     * @notice Opt in to rebasing
     * @param targetAcc Account to opt in
     */
    function optIn(uint8 targetAcc) public {
        address target = getAccount(targetAcc);
        hevm.prank(target);
        ousd.rebaseOptIn();
    }

    /**
     * @notice Opt out of rebasing
     * @param targetAcc Account to opt out
     */
    function optOut(uint8 targetAcc) public {
        address target = getAccount(targetAcc);
        hevm.prank(target);
        ousd.rebaseOptOut();
    }

    /**
     * @notice Approve an account to spend OUSD
     * @param ownerAcc Account that owns the OUSD
     * @param spenderAcc Account that is approved to spend the OUSD
     * @param amount Amount to approve
     */
    function approve(
        uint8 ownerAcc,
        uint8 spenderAcc,
        uint256 amount
    ) public {
        address owner = getAccount(ownerAcc);
        address spender = getAccount(spenderAcc);
        hevm.prank(owner);
        // slither-disable-next-line unused-return
        ousd.approve(spender, amount);
    }

    /**
     * @notice Increase the allowance of an account to spend OUSD
     * @param ownerAcc Account that owns the OUSD
     * @param spenderAcc Account that is approved to spend the OUSD
     * @param amount Amount to increase the allowance by
     */
    function increaseAllowance(
        uint8 ownerAcc,
        uint8 spenderAcc,
        uint256 amount
    ) public {
        address owner = getAccount(ownerAcc);
        address spender = getAccount(spenderAcc);
        hevm.prank(owner);
        // slither-disable-next-line unused-return
        ousd.increaseAllowance(spender, amount);
    }

    /**
     * @notice Decrease the allowance of an account to spend OUSD
     * @param ownerAcc Account that owns the OUSD
     * @param spenderAcc Account that is approved to spend the OUSD
     * @param amount Amount to decrease the allowance by
     */
    function decreaseAllowance(
        uint8 ownerAcc,
        uint8 spenderAcc,
        uint256 amount
    ) public {
        address owner = getAccount(ownerAcc);
        address spender = getAccount(spenderAcc);
        hevm.prank(owner);
        // slither-disable-next-line unused-return
        ousd.decreaseAllowance(spender, amount);
    }

    /**
     * @notice Get the sum of all OUSD balances
     * @return total Total balance
     */
    function getTotalBalance() public view returns (uint256 total) {
        total += ousd.balanceOf(ADDRESS_VAULT);
        total += ousd.balanceOf(ADDRESS_OUTSIDER_USER);
        total += ousd.balanceOf(ADDRESS_OUTSIDER_CONTRACT);
        total += ousd.balanceOf(ADDRESS_USER0);
        total += ousd.balanceOf(ADDRESS_USER1);
        total += ousd.balanceOf(ADDRESS_CONTRACT0);
        total += ousd.balanceOf(ADDRESS_CONTRACT1);
    }

    /**
     * @notice Get the sum of all non-rebasing OUSD balances
     * @return total Total balance
     */
    function getTotalNonRebasingBalance() public returns (uint256 total) {
        total += ousd._isNonRebasingAccountEchidna(ADDRESS_VAULT)
            ? ousd.balanceOf(ADDRESS_VAULT)
            : 0;
        total += ousd._isNonRebasingAccountEchidna(ADDRESS_OUTSIDER_USER)
            ? ousd.balanceOf(ADDRESS_OUTSIDER_USER)
            : 0;
        total += ousd._isNonRebasingAccountEchidna(ADDRESS_OUTSIDER_CONTRACT)
            ? ousd.balanceOf(ADDRESS_OUTSIDER_CONTRACT)
            : 0;
        total += ousd._isNonRebasingAccountEchidna(ADDRESS_USER0)
            ? ousd.balanceOf(ADDRESS_USER0)
            : 0;
        total += ousd._isNonRebasingAccountEchidna(ADDRESS_USER1)
            ? ousd.balanceOf(ADDRESS_USER1)
            : 0;
        total += ousd._isNonRebasingAccountEchidna(ADDRESS_CONTRACT0)
            ? ousd.balanceOf(ADDRESS_CONTRACT0)
            : 0;
        total += ousd._isNonRebasingAccountEchidna(ADDRESS_CONTRACT1)
            ? ousd.balanceOf(ADDRESS_CONTRACT1)
            : 0;
    }
}
