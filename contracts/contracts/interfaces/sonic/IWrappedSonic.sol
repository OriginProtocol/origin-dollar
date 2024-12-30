// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWrappedSonic {
    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function balanceOf(address account) external view returns (uint256);

    function decimals() external view returns (uint8);

    function deposit() external;

    function depositFor(address account) external returns (bool);

    function totalSupply() external view returns (uint256);

    function transfer(address to, uint256 value) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);

    function withdraw(uint256 value) external;

    function withdrawTo(address account, uint256 value) external returns (bool);
}
