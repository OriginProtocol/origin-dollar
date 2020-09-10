pragma solidity 0.5.11;

import { OUSD } from "../token/OUSD.sol";

contract MockFrozen {
    OUSD oUSD;

    function setOUSD(address _oUSDAddress) public {
        oUSD = OUSD(_oUSDAddress);
    }

    function unfreeze() public {
        oUSD.addFrozenException();
    }

    function freeze() public {
        oUSD.removeFrozenException();
    }

    function transfer(address _to, uint256 _value) public {
        oUSD.transfer(_to, _value);
    }
}
