pragma solidity 0.5.16;

/*

The Vault contract stores assets. On a deposit, OUSD will be minted and sent to
the depositor. On a withdrawal, OUSD will be burned and assets will be sent to
the withdrawer.

The Vault accepts deposits of interest form yield bearing strategies which will
modify the supply of OUSD.

*/

import { IERC20 }     from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 }  from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import { OUSD } from "../token/OUSD.sol";
import "../utils/Access.sol";

contract Vault {

    using SafeERC20 for IERC20;

    event MarketSupported(address __contractAddress);

    struct Market {
      uint totalBalance;
      uint price;
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

        markets[_contractAddress] = Market({ totalBalance: 0, price: 1, supported: true });
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

        return oUsd.mint(msg.sender, _amount);
    }

    function depositYield(address _contractAddress, uint256 _amount) public returns (uint256) {
        require(markets[_contractAddress].supported, "Market is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20 asset = IERC20(_contractAddress);
        require(
            asset.transferFrom(msg.sender, address(this), _amount),
            "Could not transfer yield"
        );

        return oUsd.increaseSupply(int256(_amount));
    }
}
