pragma solidity 0.5.11;

import "../MintableERC20.sol";

contract MockCRV is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "CRV";
    string public constant name = "Curve DAO Token";
}
