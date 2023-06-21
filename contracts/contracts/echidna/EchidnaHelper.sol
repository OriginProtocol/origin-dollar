// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./EchidnaSetup.sol";
import "./Debugger.sol";

contract EchidnaHelper is EchidnaSetup {
    function mint(uint8 toAcc, uint256 amount) public returns (uint256) {
        address to = getAccount(toAcc);

        if (TOGGLE_MINT_LIMIT) {
            amount = amount % MINT_MODULO;
        }

        hevm.prank(ADDRESS_VAULT);
        ousd.mint(to, amount);

        return amount;
    }

    function burn(uint8 fromAcc, uint256 amount) public {
        address from = getAccount(fromAcc);
        hevm.prank(ADDRESS_VAULT);
        ousd.burn(from, amount);
    }

    function changeSupply(uint256 amount) public {
        if (TOGGLE_CHANGESUPPLY_LIMIT) {
            amount =
                ousd.totalSupply() +
                (amount % (ousd.totalSupply() / CHANGESUPPLY_DIVISOR));
        }

        hevm.prank(ADDRESS_VAULT);
        ousd.changeSupply(amount);
    }

    function transfer(
        uint8 fromAcc,
        uint8 toAcc,
        uint256 amount
    ) public {
        address from = getAccount(fromAcc);
        address to = getAccount(toAcc);
        hevm.prank(from);
        ousd.transfer(to, amount);
    }

    function optIn(uint8 targetAcc) public {
        address target = getAccount(targetAcc);
        hevm.prank(target);
        ousd.rebaseOptIn();
    }

    function optOut(uint8 targetAcc) public {
        address target = getAccount(targetAcc);
        hevm.prank(target);
        ousd.rebaseOptOut();
    }

    function getTotalBalance() public view returns (uint256 total) {
        total += ousd.balanceOf(ADDRESS_VAULT);
        total += ousd.balanceOf(ADDRESS_OUTSIDER_USER);
        total += ousd.balanceOf(ADDRESS_OUTSIDER_CONTRACT);
        total += ousd.balanceOf(ADDRESS_USER0);
        total += ousd.balanceOf(ADDRESS_USER1);
        total += ousd.balanceOf(ADDRESS_CONTRACT0);
        total += ousd.balanceOf(ADDRESS_CONTRACT1);
    }

    function getTotalNonRebasingBalance() public  returns (uint256 total) {
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
