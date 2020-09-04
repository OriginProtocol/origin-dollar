pragma solidity 0.5.11;

interface IMinMaxOracle {
  //Assuming 6 decimals for Eth -> Usd
  function priceEthMinMax() external returns (uint256, uint256);
  //Assuming 8 decimals for Tok -> Eth since most of the tokens will be stable coins which is a high multiplier
  function priceTokEthMinMax(string calldata symbol) external returns (uint256, uint256);
  function priceMinMax(string calldata symbol) external view returns (uint256, uint256);
}

interface IViewMinMaxOracle {
  function priceEthMinMax() external view returns (uint256, uint256);
  function priceTokEthMinMax(string calldata symbol) external view returns (uint256, uint256);
  function priceMinMax(string calldata symbol) external view returns (uint256, uint256);
}
