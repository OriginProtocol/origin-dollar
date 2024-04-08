// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockComptroller {
    // Claim all the COMP accrued by specific holders in specific markets for their supplies and/or borrows
    function claimComp(
        address[] memory holders,
        address[] memory cTokens,
        bool borrowers,
        bool suppliers
    ) external {}
}
