// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC4626 } from "../../lib/openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { OUSD } from "./OUSD.sol";

contract WrappedOusd is ERC4626, Governable, Initializable {
    using SafeERC20 for IERC20;

    constructor(
        ERC20 underlying_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) ERC4626(underlying_) Governable() {}

    /**
     * @notice Enable OUSD rebasing for this contract
     */
    function initialize() external onlyGovernor initializer {
        OUSD(address(asset())).rebaseOptIn();
    }

    function name() public view override returns (string memory) {
        return "Wrapped OUSD";
    }

    function symbol() public view override returns (string memory) {
        return "WOUSD";
    }

    /**
     * @notice Transfer token to governor. Intended for recovering tokens stuck in
     *      contract, i.e. mistaken sends. Cannot transfer OUSD
     * @param asset_ Address for the asset
     * @param amount_ Amount of the asset to transfer
     */
    function transferToken(address asset_, uint256 amount_)
        external
        onlyGovernor
    {
        require(asset_ != address(asset()), "Cannot collect OUSD");
        IERC20(asset_).safeTransfer(governor(), amount_);
    }
}
