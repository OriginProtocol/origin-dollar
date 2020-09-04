pragma solidity 0.5.11;
import "./AggregatorV3Interface.sol";
import { IEthUsdOracle } from "../interfaces/IEthUsdOracle.sol";


contract ChainlinkOracle is IEthUsdOracle {

  address ethFeed;

  struct FeedConfig {
    address feed;
    uint8 decimals;
    bool directToUsd;
  }

  mapping (bytes32 => FeedConfig) feeds;
   
  uint8 ethDecimals;

  string constant ethSymbol = "ETH";
  bytes32 constant ethHash = keccak256(abi.encodePacked(ethSymbol));

  address public admin;

  constructor(address ethFeed_) public {
    ethFeed = ethFeed_;
    admin = msg.sender;
    ethDecimals = AggregatorV3Interface(ethFeed_).decimals();
  }

  function registerFeed(address feed, string memory symbol, bool directToUsd) public {
    require(admin == msg.sender, "Only the admin can register a new pair");

    FeedConfig storage config = feeds[keccak256(abi.encodePacked(symbol))];

    config.feed = feed;
    config.decimals = AggregatorV3Interface(feed).decimals();
    config.directToUsd = directToUsd;
  }

  function getLatestPrice(address feed) internal view returns (int) {
    (
      uint80 roundID,
      int price,
      uint startedAt,
      uint timeStamp,
      uint80 answeredInRound
    ) = AggregatorV3Interface(feed).latestRoundData();
    // silence
    roundID; startedAt; timeStamp; answeredInRound;
    return price;
  }

  function ethUsdPrice() external view returns (uint256) {
    return (uint(getLatestPrice(ethFeed)) / (uint(10)**(ethDecimals - 6)));
  }

  function tokUsdPrice(string calldata symbol) external view returns (uint256) {
    bytes32 tokenSymbolHash = keccak256(abi.encodePacked(symbol));
    FeedConfig storage config = feeds[tokenSymbolHash];
    int tPrice = getLatestPrice(config.feed);

    require(config.directToUsd, "Price is not direct to usd");
    require(tPrice > 0, "Price must be greater than zero");
    return uint(tPrice);
  }

  function tokEthPrice(string calldata symbol) external returns (uint256) {
    bytes32 tokenSymbolHash = keccak256(abi.encodePacked(symbol));
    FeedConfig storage config = feeds[tokenSymbolHash];
    int tPrice = getLatestPrice(config.feed);

    require(!config.directToUsd, "Price is not in terms of ETH");
    require(tPrice > 0, "Price must be greater than zero");
    //attempt to return 8 digit precision here
    return uint(tPrice) / (uint(10)**(config.decimals - 8));
  }

  // This actually calculate the latest price from outside oracles
  // It's a view but substantially more costly in terms of calculation
  function price(string calldata symbol) external view returns (uint256) {
    bytes32 tokenSymbolHash = keccak256(abi.encodePacked(symbol));

    if (ethHash == tokenSymbolHash) {
      return (uint(getLatestPrice(ethFeed)) / (uint(10)**(ethDecimals - 6)));
    } else {
      FeedConfig storage config = feeds[tokenSymbolHash];
      int tPrice = getLatestPrice(config.feed);
  
      if (config.directToUsd) {
        require(tPrice > 0, "Price must be greater than zero");
        return uint(tPrice);
      } else {
        int ethPrice = getLatestPrice(ethFeed); // grab the eth price from the open oracle
        require(tPrice > 0 && ethPrice > 0, "Both eth and price must be greater than zero");
        //not actually sure why it's 6 units here, this is just to match with openoracle for now
        return mul(uint(tPrice), uint(ethPrice)) / (uint(10)**(ethDecimals + config.decimals - 6));
      }
    }
  }

  /// @dev Overflow proof multiplication
  function mul(uint a, uint b) internal pure returns (uint) {
    if (a == 0) return 0;
    uint c = a * b;
    require(c / a == b, "multiplication overflow");
    return c;
  }

}
