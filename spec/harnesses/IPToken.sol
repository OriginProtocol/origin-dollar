pragma solidity 0.5.11;

import "./DummyERC20Impl.sol";

contract IPToken is DummyERC20Impl {

    function mint(address recipient, uint amt) public {
        b[recipient] = add(b[recipient], amt);
        t = add(t, amt);
    }

    function mint(uint256 value) external {
        mint(msg.sender, value);
    }

    function burn(uint amt) external {
        b[msg.sender] = sub(b[msg.sender], amt);
        t = sub(t, amt);
    }

}
