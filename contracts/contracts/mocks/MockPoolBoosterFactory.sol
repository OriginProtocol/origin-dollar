// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract MockPoolBoosterFactory {
    uint256 public callCount;
    address[] private _lastExclusionList;

    event BribeAllCalled(address[] exclusionList);

    function bribeAll(address[] memory exclusionList) external {
        callCount++;
        _lastExclusionList = exclusionList;
        emit BribeAllCalled(exclusionList);
    }

    function getLastExclusionList() external view returns (address[] memory) {
        return _lastExclusionList;
    }

    function poolBoosterLength() external pure returns (uint256) {
        return 0;
    }
}
