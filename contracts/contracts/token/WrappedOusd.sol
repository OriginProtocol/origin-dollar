// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ERC20 } from "../../lib/solmate/src/tokens/ERC20.sol";
import { ERC4626 } from "../../lib/solmate/src/mixins/ERC4626.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { Governable } from "../governance/Governable.sol";
import { Initializable } from "../utils/Initializable.sol";
import { OUSD } from "./OUSD.sol";

contract WrappedOusd is ERC4626, Governable, Initializable {
    using SafeERC20 for IERC20;

    constructor(
        ERC20 _underlying,
        string memory _name,
        string memory _symbol
    ) ERC4626(_underlying, _name, _symbol) Governable() {}

    /**
     * @notice Enable OUSD rebasing for this contract
     */
    function initialize() external onlyGovernor initializer {
        OUSD(address(asset)).rebaseOptIn();
    }

    /**
     * @notice Show the total amount of OUSD held by the wrapper
     */
    function totalAssets() public view override returns (uint256) {
        return ERC20(asset).balanceOf(address(this));
    }

    /**
     * @notice Transfer token to governor. Intended for recovering tokens stuck in
     *      contract, i.e. mistaken sends. Cannot transfer OUSD
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        external
        onlyGovernor
    {
        require(_asset != address(asset), "Cannot collect OUSD");
        IERC20(_asset).safeTransfer(governor(), _amount);
    }
}
