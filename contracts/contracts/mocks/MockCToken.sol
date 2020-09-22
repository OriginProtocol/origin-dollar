pragma solidity 0.5.11;

import {
    IERC20,
    ERC20,
    ERC20Mintable
} from "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import {
    ERC20Detailed
} from "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";

import { ICERC20 } from "../strategies/ICompound.sol";
import { StableMath } from "../utils/StableMath.sol";

contract MockCToken is ICERC20, ERC20, ERC20Detailed, ERC20Mintable {
    using StableMath for uint256;

    IERC20 public underlyingToken;
    // underlying = cToken * exchangeRate
    // cToken = underlying / exchangeRate
    uint256 exchangeRate;

    constructor(ERC20Detailed _underlyingToken)
        public
        ERC20Detailed("cMock", "cMK", 8)
    {
        uint8 underlyingDecimals = _underlyingToken.decimals();
        // if has 18 dp, exchange rate should be 1e26
        // if has 8 dp, exchange rate should be 1e18
        if (underlyingDecimals > 8) {
            exchangeRate = 10**uint256(18 + underlyingDecimals - 10);
        } else if (underlyingDecimals < 8) {
            // e.g. 18-8+6 = 16
            exchangeRate = 10**uint256(18 - 8 + underlyingDecimals);
        } else {
            exchangeRate = 1e18;
        }
        underlyingToken = _underlyingToken;
    }

    function mint(uint256 mintAmount) external returns (uint256) {
        // Credit them with cToken
        _mint(msg.sender, mintAmount.divPrecisely(exchangeRate));
        // Take their reserve
        underlyingToken.transferFrom(msg.sender, address(this), mintAmount);
        return 0;
    }

    function redeem(uint256 redeemAmount) external returns (uint256) {
        uint256 tokenAmount = redeemAmount.mulTruncate(exchangeRate);
        // Burn the cToken
        _burn(msg.sender, redeemAmount);
        // Transfer underlying to caller
        underlyingToken.transfer(msg.sender, tokenAmount);
        return 0;
    }

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        uint256 cTokens = redeemAmount.divPrecisely(exchangeRate);
        // Burn the cToken
        _burn(msg.sender, cTokens);
        // Transfer underlying to caller
        underlyingToken.transfer(msg.sender, redeemAmount);
        return 0;
    }

    function balanceOfUnderlying(address owner) external returns (uint256) {
        uint256 cTokenBal = this.balanceOf(owner);
        return cTokenBal.mulTruncate(exchangeRate);
    }

    function updateExchangeRate() internal returns (uint256) {
        uint256 factor = 100002 * (10**13); // 0.002%
        exchangeRate = exchangeRate.mulTruncate(factor);
    }

    function exchangeRateStored() external view returns (uint256) {
        return exchangeRate;
    }

    function supplyRatePerBlock() external view returns (uint256) {
        return 141 * (10**8);
    }
}
