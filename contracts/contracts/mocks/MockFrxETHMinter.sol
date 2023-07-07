// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockFrxETHMinter {
    address public sfrxETH;

    constructor(address _sfrxETH) {
        sfrxETH = _sfrxETH;
    }

    function setAssetAddress(address _sfrxETH) external {
        sfrxETH = _sfrxETH;
    }

    function submitAndDeposit(address recipient)
        external
        payable
        returns (uint256 shares)
    {
        IMintableERC20(sfrxETH).mintTo(recipient, msg.value);
        shares = msg.value;
    }
}
