// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import {MockERC20} from "@solmate/test/utils/mocks/MockERC20.sol";

/// @title MockERC4626Rate
/// @notice ERC20 with a settable ERC4626 `convertToShares` rate, for modules that only read the NAV.
contract MockERC4626Rate is MockERC20 {
    /// @dev Shares per 1e18 assets.
    uint256 public sharesPerAsset = 1e18;

    constructor(string memory _name, string memory _symbol) MockERC20(_name, _symbol, 18) {}

    function setSharesPerAsset(uint256 _sharesPerAsset) external {
        sharesPerAsset = _sharesPerAsset;
    }

    function convertToShares(uint256 assets) external view returns (uint256) {
        return (assets * sharesPerAsset) / 1e18;
    }
}
