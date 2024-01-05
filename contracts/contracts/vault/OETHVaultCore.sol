// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { StableMath } from "../utils/StableMath.sol";

import { VaultCore } from "./VaultCore.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";

/**
 * @title OETH VaultCore Contract
 * @author Origin Protocol Inc
 */
contract OETHVaultCore is VaultCore {
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    error NotSupported();

    constructor(address _mintRedeemOnlyAsset) VaultCore(_mintRedeemOnlyAsset) {}
}
