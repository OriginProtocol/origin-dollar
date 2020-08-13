pragma solidity 0.5.17;

/*

The Vault contract stores assets. On a deposit, OUSD will be minted and sent to
the depositor. On a withdrawal, OUSD will be burned and assets will be sent to
the withdrawer.

The Vault accepts deposits of interest form yield bearing strategies which will
modify the supply of OUSD.

*/

import { IERC20 }     from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 }  from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import { OUSD } from "../token/OUSD.sol";
import "../utils/Access.sol";
import "../utils/Helpers.sol";
import "../utils/StableMath.sol";

contract Vault {

    using SafeMath for uint256;
    using StableMath for uint256;
    using SafeERC20 for IERC20;

    event MarketSupported(address __contractAddress);

    struct Market {
      uint totalBalance;
      uint price;
      uint ratio;
      bool supported;
    }

    mapping(address => Market) markets;
    IERC20 [] allMarkets;

    OUSD oUsd;

    constructor (address oUsdAddress) public {
        oUsd = OUSD(oUsdAddress);
    }

    function createMarket(address _contractAddress) external {
        require(!markets[_contractAddress].supported, "Market already created");

        uint256 assetDecimals = Helpers.getDecimals(_contractAddress);
        uint256 delta = uint256(18).sub(assetDecimals);
        uint256 ratio = uint256(StableMath.getRatioScale()).mul(10 ** delta);

        markets[_contractAddress] = Market({
            totalBalance: 0,
            price: 1,
            ratio: ratio,
            supported: true
        });

        allMarkets.push(IERC20(_contractAddress));

        emit MarketSupported(_contractAddress);
    }

    /**
     *
     *
     */
    function depositAndMint(address _contractAddress, uint256 _amount) public {
        require(markets[_contractAddress].supported, "Market is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20 asset = IERC20(_contractAddress);
        require(
            asset.transferFrom(msg.sender, address(this), _amount),
            "Could not transfer asset to mint OUSD"
        );

        uint256 ratioedDeposit = _amount.mulRatioTruncate(markets[_contractAddress].ratio);

        return oUsd.mint(msg.sender, ratioedDeposit);
    }

    function depositYield(address _contractAddress, uint256 _amount) public returns (uint256) {
        require(markets[_contractAddress].supported, "Market is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20 asset = IERC20(_contractAddress);
        require(
            asset.transferFrom(msg.sender, address(this), _amount),
            "Could not transfer yield"
        );

        uint256 ratioedDeposit = _amount.mulRatioTruncate(markets[_contractAddress].ratio);

        return oUsd.increaseSupply(int256(ratioedDeposit));
    }
}
