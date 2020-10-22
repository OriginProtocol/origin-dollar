pragma solidity 0.5.11;

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

    function increaseAllowance(address _spender, uint256 _addedValue) public {
        oUSD.increaseAllowance(_spender, _addedValue);
    }
}
