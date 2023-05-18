pragma solidity ^0.8.19;

import {PTest, console} from "@narya-ai/contracts/PTest.sol";
import {IERC20} from "../../lib/forge-std/src/interfaces/IERC20.sol";

import {OUSD} from "../../contracts/token/OUSD.sol";
import {VaultCore} from "../../contracts/vault/VaultCore.sol";

interface IUNISWAP_V2_ROUTER {
    function swapETHForExactTokens(
        uint amountOut, 
        address[] calldata path, 
        address to, 
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function swapTokensForExactTokens(
        uint amountOut,
        uint amountInMax,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract Base is PTest {
    OUSD ousd;
    VaultCore vault;

    address ousdAddress;
    address vaultAddress;

    address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    string rpc_url;

    function setUp() public virtual {
        vm.createSelectFork(rpc_url);

        ousd = OUSD(ousdAddress);
        vault = VaultCore(payable(vaultAddress));

        vm.label(ousdAddress, "ousd");
        vm.label(vaultAddress, "vault");

        // We want to fuzz these LIVE contracts
        // Make sure to adapt the invariants to support them
        targetContract(ousdAddress);
        targetContract(vaultAddress);
    }
}