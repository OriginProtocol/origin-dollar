// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./AbstractLockupDistributor.sol";

interface IOGVStaking {
    function stake(
        uint256 amount,
        uint256 end,
        address to
    ) external;
}

contract MandatoryLockupDistributor is AbstractLockupDistributor {

    constructor(
        address _token,
        bytes32 _merkleRoot,
        address _stakingContract,
        uint256 _endBlock
    ) AbstractLockupDistributor(_token, _merkleRoot, _stakingContract, _endBlock) {}

    /**
     * @dev Execute a claim using a merkle proof with optional lockup in the staking contract.
     * @param _index Index in the tree
     * @param _amount Amount eligible to claim
     * @param _merkleProof The proof
     */
    function claim(
        uint256 _index,
        uint256 _amount,
        bytes32[] calldata _merkleProof
    ) external {
        require(!isClaimed(_index), "MerkleDistributor: Drop already claimed.");
        require(block.number < endBlock, "Can no longer claim. Claim period expired");

        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(_index, msg.sender, _amount));
        require(
            MerkleProof.verify(_merkleProof, merkleRoot, node),
            "MerkleDistributor: Invalid proof."
        );

        // Mark it claimed and send the token.
        setClaimed(_index);

        IERC20(token).approve(stakingContract, _amount);

        // Create four lockups in 12 month increments (1 month = 2629800 seconds)
        IOGVStaking(stakingContract).stake(_amount / 4, 2629800 * 12, msg.sender);
        IOGVStaking(stakingContract).stake(_amount / 4, 2629800 * 24, msg.sender);
        IOGVStaking(stakingContract).stake(_amount / 4, 2629800 * 36, msg.sender);
        IOGVStaking(stakingContract).stake(_amount / 4, 2629800 * 48, msg.sender);

        emit Claimed(_index, msg.sender, _amount);
    }
}
