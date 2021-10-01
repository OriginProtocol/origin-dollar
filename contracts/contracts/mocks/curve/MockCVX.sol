// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import "../MintableERC20.sol";

contract MockCVX is MintableERC20 {
    uint256 public constant decimals = 18;
    string public constant symbol = "CVX";
    string public constant name = "CVX DAO Token";
}
