// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

contract MockOTokenVaultOracleVault {
    uint256 public totalValue;
    address public oToken;

    function setTotalValue(uint256 _totalValue) external {
        totalValue = _totalValue;
    }

    function setOToken(address _oToken) external {
        oToken = _oToken;
    }
}

contract MockOTokenVaultOracleToken {
    uint256 public totalSupply;

    function setTotalSupply(uint256 _totalSupply) external {
        totalSupply = _totalSupply;
    }
}
