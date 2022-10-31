// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "./AbstractLockupDistributor.sol";

interface IOGVStaking {
    function stake(
        uint256 amount,
        uint256 end,
        address _account
    ) external;
}

contract OptionalLockupDistributor is AbstractLockupDistributor {

    constructor(
        address _token,
        bytes32 _merkleRoot,
        address _stakingContract,
        uint256 _endBlock
    ) AbstractLockupDistributor(_token, _merkleRoot, _stakingContract, _endBlock) {}

    /**
     * @dev Execute a claim using a merkle proof with optional stake in the staking contract.
     * @param _index Index in the tree
     * @param _amount Amount eligiblle to claim
     * @param _merkleProof The proof
     * @param _stakeDuration Duration of the stake to create
     */
    function claim(
        uint256 _index,
        uint256 _amount,
        bytes32[] calldata _merkleProof,
        uint256 _stakeDuration
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
        if (_stakeDuration > 0) {
            IERC20(token).approve(stakingContract, _amount);
            // stakingContract.stake(_amount, _stakeDuration, msg.sender),
            IOGVStaking(stakingContract).stake(
                _amount,
                _stakeDuration,
                msg.sender
            );
        } else {
            require(
                IERC20(token).transfer(msg.sender, _amount),
                "MerkleDistributor: Transfer failed."
            );
        }

        emit Claimed(_index, msg.sender, _amount);
    }
}
