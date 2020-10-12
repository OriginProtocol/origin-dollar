pragma solidity 0.5.11;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { ICurveGauge } from "../../strategies/ICurveGauge.sol";

contract MockCurveGauge is ICurveGauge {
    mapping(address => uint256) private _balances;
    address lpToken;

    constructor(address _lpToken) public {
        lpToken = _lpToken;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function deposit(uint256 _value, address _account) external {
        IERC20(lpToken).transferFrom(msg.sender, address(this), _value);
        _balances[_account] += _value;
    }

    function withdraw(uint256 _value) external {
        IERC20(lpToken).transfer(msg.sender, _value);
        _balances[msg.sender] -= _value;
    }
}
