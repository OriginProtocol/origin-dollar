// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IWrappedSonic {
    event Deposit(address indexed account, uint256 value);
    event Withdrawal(address indexed account, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function balanceOf(address account) external view returns (uint256);

    function decimals() external view returns (uint8);

    function deposit() external payable;

    function depositFor(address account) external payable returns (bool);

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
