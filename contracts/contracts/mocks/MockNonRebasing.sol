// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IVault } from "../interfaces/IVault.sol";

import { OUSD } from "../token/OUSD.sol";

contract MockNonRebasing {
    OUSD oUSD;

    function setOUSD(address _oUSDAddress) public {
        oUSD = OUSD(_oUSDAddress);
    }

    function rebaseOptIn() public {
        oUSD.rebaseOptIn();
    }

    function rebaseOptOut() public {
        oUSD.rebaseOptOut();
    }

    function transfer(address _to, uint256 _value) public {
        oUSD.transfer(_to, _value);
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public {
        oUSD.transferFrom(_from, _to, _value);
    }

    function approve(address _spender, uint256 _addedValue) public {
        oUSD.approve(_spender, _addedValue);
    }

    function mintOusd(
        address _vaultContract,
        address _asset,
        uint256 _amount
    ) public {
        IVault(_vaultContract).mint(_amount);
    }

    function redeemOusd(address _vaultContract, uint256 _amount) public {
        IVault(_vaultContract).requestWithdrawal(_amount);
    }

    function approveFor(
        address _contract,
        address _spender,
        uint256 _addedValue
    ) public {
        IERC20(_contract).approve(_spender, _addedValue);
    }
}
