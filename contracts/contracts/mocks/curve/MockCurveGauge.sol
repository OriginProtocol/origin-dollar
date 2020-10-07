pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCurveGauge is ICurveGauge, ERC20 {
    address lpToken;

    constructor(address _lpToken) public {
        lpToken = _lpToken;
    }

    function deposit(uint256 _value, address _account) external {
        IERC20(lpToken).transferFrom(msg.sender, _value);
        _balances[msg.sender] += _value;
    }

    function withdraw(uint256 _value) external {
        IERC20(lpToken).transfer(msg.sender, _value);
        _balances[msg.sender] -= _value;
    }
}
