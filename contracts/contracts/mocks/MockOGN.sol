pragma solidity 0.5.11;

import "./MintableERC20.sol";

contract MockOGN is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "OGN";
    string public constant name = "OriginToken";
}
