pragma solidity 0.5.11;

interface IMinMaxOracle {
    //Assuming 8 decimals
    function priceMin(string calldata symbol) external returns (uint256);

    function priceMax(string calldata symbol) external returns (uint256);
}

interface IViewMinMaxOracle {
    function priceMin(string calldata symbol) external view returns (uint256);

    function priceMax(string calldata symbol) external view returns (uint256);
}
