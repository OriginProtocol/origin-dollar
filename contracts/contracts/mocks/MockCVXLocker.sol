// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCVXLocker {
    address public immutable cvx;
    mapping(address => uint256) public lockedBalanceOf;

    constructor(address _cvx) {
        cvx = _cvx;
    }

    function lock(
        address _account,
        uint256 _amount,
        uint256
    ) external {
        lockedBalanceOf[_account] += _amount;
        ERC20(cvx).transferFrom(msg.sender, address(this), _amount);
    }

    function unlockAllTokens(address _account) external {
        lockedBalanceOf[_account] = 0;
        ERC20(cvx).transfer(_account, lockedBalanceOf[_account]);
    }
}
