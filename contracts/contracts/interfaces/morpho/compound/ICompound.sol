// SPDX-License-Identifier: GNU AGPLv3
pragma solidity ^0.8.0;

interface ICompoundOracle {
    function getUnderlyingPrice(address) external view returns (uint256);
}
