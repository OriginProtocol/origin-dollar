// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// IERC20Metadata is used in the resolveAsset function in contracts/utils/assets.js
// We just need to import it here to make its ABI available to Hardhat
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
