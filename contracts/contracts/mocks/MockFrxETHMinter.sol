// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MintableERC20.sol";

contract MockFrxETHMinter {
    address public immutable frxETH;
    address public immutable sfrxETH;

    constructor(address _frxETH, address _sfrxETH) {
        frxETH = _frxETH;
        sfrxETH = _sfrxETH;
    }

    function submitAndDeposit(address recipient)
        external
        payable
        returns (uint256 shares)
    {
        IMintableERC20(frxETH).mintTo(sfrxETH, msg.value);
        IMintableERC20(sfrxETH).mintTo(recipient, msg.value);
        shares = msg.value;
    }
}
