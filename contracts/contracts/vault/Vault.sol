pragma solidity ^0.5.0;

/*

The Vault contract stores assets. On a deposit, OUSD will be minted and sent to
the depositor. On a withdrawal, OUSD will be burned and assets will be sent to
the withdrawer.

The Vault accepts deposits of interest form yield bearing
strategies which will modify the supply of OUSD.

*/

contract Vault {

    event InterestDeposited(uint256 amount);

    function depositInterest(uint256 amount) public {
        OUSD.increaseSupply();
    }

    /**
     *
     *
     */
    function deposit(address _contractAddress, uint256 _amount) public {
        return _deposit(_contractAddress, _amount, msg.sender);
    }

    /**
     *
     *
     */
    function _deposit(address, _contractAddress, uint256 _amount, address _recipient) internal {
        require(_recipient != address(0), "Must be a valid recipient");
        require(_amount > 0, "Amount must be greater than 0");

        OUSD oUsd = OUSD();
        oUsd.mint(msg.sender, _amount);
    }
}
