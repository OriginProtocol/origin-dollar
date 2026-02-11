// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IDistributor {
    event Claimed(address indexed user, address indexed token, uint256 amount);

    function claim(
        address[] calldata users,
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes32[][] calldata proofs
    ) external;
}
