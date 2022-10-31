// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "openzeppelin-upgradeable-4.6.0/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "openzeppelin-4.6.0/utils/cryptography/MerkleProof.sol";
import "openzeppelin-4.6.0/token/ERC20/IERC20.sol";

abstract contract AbstractLockupDistributor {
    //@notice This event is triggered whenever a call to #claim succeeds.
    event Claimed(
        uint256 indexed index,
        address indexed account,
        uint256 amount
    );

    event OGVBurned(uint256 amount);

    address public immutable token;
    bytes32 public immutable merkleRoot;
    address public immutable stakingContract;
    uint256 public immutable endBlock;

    // This is a packed array of booleans.
    mapping(uint256 => uint256) private claimedBitMap;

    constructor(
        address _token,
        bytes32 _merkleRoot,
        address _stakingContract,
        uint256 _endBlock
    ) {
        token = _token;
        merkleRoot = _merkleRoot;
        stakingContract = _stakingContract;
        endBlock = _endBlock;
    }

    /**
     * @dev
     * @param _index Index in the tree
     */
    function isClaimed(uint256 _index) public view returns (bool) {
        uint256 claimedWordIndex = _index / 256;
        uint256 claimedBitIndex = _index % 256;
        uint256 claimedWord = claimedBitMap[claimedWordIndex];
        uint256 mask = (1 << claimedBitIndex);
        return claimedWord & mask == mask;
    }

    /**
     * @dev
     * @param _index Index in the tree
     */
    function setClaimed(uint256 _index) internal {
        uint256 claimedWordIndex = _index / 256;
        uint256 claimedBitIndex = _index % 256;
        claimedBitMap[claimedWordIndex] =
            claimedBitMap[claimedWordIndex] |
            (1 << claimedBitIndex);
    }

    function isProofValid(
        uint256 _index,
        uint256 _amount,
        address _account,
        bytes32[] calldata _merkleProof
    ) external view returns (bool) {
        // Verify the Merkle proof.
        bytes32 node = keccak256(abi.encodePacked(_index, _account, _amount));
        return MerkleProof.verify(_merkleProof, merkleRoot, node);
    }

    /**
     * @dev burn all the remaining OGV balance
     */
    function burnRemainingOGV() external {
        require(block.number >= endBlock, "Can not yet burn the remaining OGV");
        uint256 burnAmount = IERC20(token).balanceOf(address(this));

        ERC20BurnableUpgradeable(token).burn(burnAmount);
        emit OGVBurned(burnAmount);
    }
}
