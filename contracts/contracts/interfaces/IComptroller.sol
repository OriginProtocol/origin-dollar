// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IComptroller {
    /**
     * @notice Claim all the comp accrued by holder in all markets
     * @param holder The address to claim COMP for
     */
    function claimComp(address holder) external;
}
