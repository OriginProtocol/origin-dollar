pragma solidity 0.5.11;

interface Tether {
    function transfer(address to, uint256 value) external;

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external;

    function balanceOf(address) external returns (uint256);
}
