pragma solidity 0.5.11;

interface ICRVGauge {
    function balanceOf(address account) external view returns (uint256);

    function claimable_tokens(address account) external;

    function deposit(uint256 value, address account) external;

    function withdraw(uint256 value) external;
}
