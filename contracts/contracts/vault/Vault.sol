pragma solidity ^0.5.0;

contract Vault {

    function depositYield() {
        OUSD.increaseSupply()
    }

    /**
     *
     *
     */
    function deposit(address _contractAddress, uint256 _quantity) {
        return _deposit(_contractAddress, _quantity, msg.sender)
    }

    /**
     *
     *
     */
    function _deposit(address, _contractAddress, uint256 _quantity, address _recipient) internal {
        require(_recipient != address(0), "Must be a valid recipient");
        require(_quantity > 0, "Quantity must be greater than 0");
    }
}
