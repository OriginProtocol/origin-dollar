// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract MockVeNFT {
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256[]) internal _ownerTokens;

    function setOwner(uint256 tokenId, address owner) external {
        ownerOf[tokenId] = owner;
    }

    function setOwnerTokens(address owner, uint256[] memory tokenIds) external {
        _ownerTokens[owner] = tokenIds;
    }

    function ownerToNFTokenIdList(address owner, uint256 index) external view returns (uint256) {
        if (index >= _ownerTokens[owner].length) return 0;
        return _ownerTokens[owner][index];
    }
}
