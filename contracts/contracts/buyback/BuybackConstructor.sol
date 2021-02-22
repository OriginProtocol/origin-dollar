pragma solidity 0.5.11;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { Buyback } from "./Buyback.sol";

contract BuybackConstructor is Buyback {
    constructor(
        address _uniswapAddr,
        address _vaultAddr,
        address _ousd,
        address _ogn,
        address _usdt
    ) public {
        uniswapAddr = _uniswapAddr;
        vaultAddr = _vaultAddr;
        ousd = IERC20(_ousd);
        ogn = IERC20(_ogn);
        usdt = IERC20(_usdt);
        // Give approval to Uniswap router for OUSD, this is handled
        // by setUniswapAddr in the production contract
        ousd.safeApprove(uniswapAddr, 0);
        ousd.safeApprove(uniswapAddr, uint256(-1));
    }
}
