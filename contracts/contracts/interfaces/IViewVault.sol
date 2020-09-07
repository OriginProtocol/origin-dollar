pragma solidity 0.5.11;

contract IViewVault {
    function totalValue() public view returns (uint256 value);

    function getAPR() public view returns (uint256);
}
