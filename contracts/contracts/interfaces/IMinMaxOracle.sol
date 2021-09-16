// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IMinMaxOracle {
    //Assuming 8 decimals
    function priceMin(string calldata symbol) external view returns (uint256);

    function priceMax(string calldata symbol) external view returns (uint256);
}
