// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

// https://github.com/ethereum/hevm/blob/main/doc/src/controlling-the-unit-testing-environment.md#cheat-codes

interface IHevm {
    function warp(uint256 x) external;

    function roll(uint256 x) external;

    function store(
        address c,
        bytes32 loc,
        bytes32 val
    ) external;

    function load(address c, bytes32 loc) external returns (bytes32 val);

    function sign(uint256 sk, bytes32 digest)
        external
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        );

    function addr(uint256 sk) external returns (address addr);

    function ffi(string[] calldata) external returns (bytes memory);

    function prank(address sender) external;
}
