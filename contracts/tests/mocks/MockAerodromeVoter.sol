// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract MockAerodromeVoter {
    event BribesClaimed(
        address[] bribes,
        address[][] tokens,
        uint256 tokenId
    );

    bool public shouldFail;

    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }

    function claimBribes(
        address[] memory _bribes,
        address[][] memory _tokens,
        uint256 _tokenId
    ) external {
        require(!shouldFail, "MockAerodromeVoter: claimBribes failed");
        emit BribesClaimed(_bribes, _tokens, _tokenId);
    }
}
