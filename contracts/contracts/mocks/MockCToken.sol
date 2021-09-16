// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20, ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { ICERC20 } from "../strategies/ICompound.sol";
import { StableMath } from "../utils/StableMath.sol";

contract MockCToken is ICERC20, ERC20 {
    using StableMath for uint256;

    IERC20 public underlyingToken;
    // underlying = cToken * exchangeRate
    // cToken = underlying / exchangeRate
    uint256 exchangeRate;
    address public override comptroller;

    constructor(ERC20 _underlyingToken, address _comptroller)
        ERC20("cMock", "cMK")
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
        comptroller = _comptroller;
    }

    function decimals() public pure override returns (uint8) {
        return 8;
    }

    function mint(uint256 mintAmount) public override returns (uint256) {
        // Credit them with cToken
        _mint(msg.sender, mintAmount.divPrecisely(exchangeRate));
        // Take their reserve
        underlyingToken.transferFrom(msg.sender, address(this), mintAmount);
        return 0;
    }

    function redeem(uint256 redeemAmount) external override returns (uint256) {
        uint256 tokenAmount = redeemAmount.mulTruncate(exchangeRate);
        // Burn the cToken
        _burn(msg.sender, redeemAmount);
        // Transfer underlying to caller
        underlyingToken.transfer(msg.sender, tokenAmount);
        return 0;
    }

    function redeemUnderlying(uint256 redeemAmount)
        external
        override
        returns (uint256)
    {
        uint256 cTokens = redeemAmount.divPrecisely(exchangeRate);
        // Burn the cToken
        _burn(msg.sender, cTokens);
        // Transfer underlying to caller
        underlyingToken.transfer(msg.sender, redeemAmount);
        return 0;
    }

    function balanceOfUnderlying(address owner)
        external
        view
        override
        returns (uint256)
    {
        uint256 cTokenBal = this.balanceOf(owner);
        return cTokenBal.mulTruncate(exchangeRate);
    }

    function balanceOf(address owner)
        public
        view
        override(ICERC20, ERC20)
        returns (uint256)
    {
        return ERC20.balanceOf(owner);
    }

    function updateExchangeRate()
        internal
        view
        returns (uint256 newExchangeRate)
    {
        uint256 factor = 100002 * (10**13); // 0.002%
        newExchangeRate = exchangeRate.mulTruncate(factor);
    }

    function exchangeRateStored() external view override returns (uint256) {
        return exchangeRate;
    }

    function supplyRatePerBlock() external pure override returns (uint256) {
        return 141 * (10**8);
    }
}
