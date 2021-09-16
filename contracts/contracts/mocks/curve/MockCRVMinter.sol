// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IMintableERC20 } from "../MintableERC20.sol";

contract MockCRVMinter {
    address crv;

    constructor(address _crv) {
        crv = _crv;
    }

    function mint(address _address) external {
        uint256 amount = 2e18;
        IMintableERC20(crv).mint(amount);
        IERC20(crv).transfer(_address, amount);
    }
}
