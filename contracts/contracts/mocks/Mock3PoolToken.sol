pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract Mock3PoolToken is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "hCRV";
    string public constant name = "hCRV";

    function mint(address to, uint256 value) public returns (bool) {
        _mint(to, value);
        return true;
    }

    function burnFrom(address from, uint256 value) public returns (bool) {
        _burn(from, value);
        return true;
    }
}
