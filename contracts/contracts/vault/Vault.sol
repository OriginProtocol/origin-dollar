pragma solidity ^0.5.0;

/*

The Vault contract stores assets. On a deposit, OUSD will be minted and sent to
the depositor. On a withdrawal, OUSD will be burned and assets will be sent to
the withdrawer.

The Vault accepts deposits of interest form yield bearing strategies which will
modify the supply of OUSD.

*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { OUSD } from "../token/OUSD.sol";

import "../utils/Access.sol";

contract Vault is Access {

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

    function createMarket(address _contractAddress) external onlyGovernor {
        require(!markets[_contractAddress].supported, "Market already created");

        markets[_contractAddress] = Market({ totalBalance: 0, price: 1, supported: true });
        allMarkets.push(IERC20(_contractAddress));

        emit MarketSupported(_contractAddress);
    }

    /**
     *
     *
     */
    function deposit(address _contractAddress, uint256 _amount) public {
        require(markets[_contractAddress].supported, "Market is not supported");
        require(_amount > 0, "Amount must be greater than 0");

        IERC20(_contractAddress).transferFrom(msg.sender, address(this), _amount);

        oUsd.mint(msg.sender, _amount);
    }
}
