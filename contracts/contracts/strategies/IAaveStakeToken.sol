pragma solidity 0.5.11;

interface IAaveStakedToken {
    function COOLDOWN_SECONDS() external returns (uint256);

    function UNSTAKE_WINDOW() external returns (uint256);

    function balanceOf(address addr) external returns (uint256);

    function redeem(address to, uint256 amount) external;

    function stakersCooldowns(address addr) external returns (uint256);

    function cooldown() external;
}
