pragma solidity 0.5.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IMintableERC20 } from "../MintableERC20.sol";

contract MockCRVMinter {
    address crv;

    constructor(address _crv) public {
        crv = _crv;
    }

    function mint(address _address) external {
        uint256 amount = 2e18;
        IMintableERC20(crv).mint(amount);
        IERC20(crv).transfer(_address, amount);
    }
}
