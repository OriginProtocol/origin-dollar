// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IAccessControlEnumerable } from "@openzeppelin/contracts/access/IAccessControlEnumerable.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IBridgedWOETH is IERC20Metadata, IAccessControlEnumerable {
    function DEFAULT_ADMIN_ROLE() external view returns (bytes32);

    function MINTER_ROLE() external view returns (bytes32);

    function BURNER_ROLE() external view returns (bytes32);

    function governor() external view returns (address);

    function initialize() external;

    function mint(address account, uint256 amount) external;

    function burn(address account, uint256 amount) external;

    function burn(uint256 amount) external;
}
