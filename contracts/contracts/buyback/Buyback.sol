pragma solidity 0.5.11;
pragma experimental ABIEncoderV2;

import { Governable } from "../governance/Governable.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract Buyback is Governable {
    using SafeERC20 for IERC20;

    event UniswapUpdated(address _address);

    // Address of Uniswap
    address public uniswapAddr = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

    // Address of OUSD Vault
    address
        public constant vaultAddr = 0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70;

    // Swap from OUSD
    IERC20 constant ousd = IERC20(0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86);

    // Swap to OGN
    IERC20 constant ogn = IERC20(0x8207c1FfC5B6804F6024322CcF34F29c3541Ae26);

    // USDT for Uniswap path
    IERC20 constant usdt = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);

    IERC20 constant weth9 = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    /**
     * @dev Verifies that the caller is the OUSD Vault.
     */
    modifier onlyVault() {
        require(vaultAddr == msg.sender, "Caller is not the Vault");
        _;
    }

    /**
     * @dev Set address of Uniswap for performing liquidation of strategy reward
     * tokens. Setting to 0x0 will pause swaps.
     * @param _address Address of Uniswap
     */
    function setUniswapAddr(address _address) external onlyGovernor {
        uniswapAddr = _address;
        // Give Uniswap unlimited OUSD allowance
        ousd.safeApprove(uniswapAddr, 0);
        ousd.safeApprove(uniswapAddr, uint256(-1));
        emit UniswapUpdated(_address);
    }

    /**
     * @dev Execute a swap of OGN for OUSD via Uniswap or Uniswap compatible
     * protocol (e.g. Sushiswap)
     **/
    function swap() external onlyVault {
        if (uniswapAddr == address(0)) return;

        uint256 sourceAmount = ousd.balanceOf(address(this));
        if (sourceAmount < 1000 * 1e18) return;

        UniswapV3Router.ExactInputParams memory params = UniswapV3Router
            .ExactInputParams({
            path: abi.encodePacked(
                ousd,
                uint24(500), // Pool fee, ousd -> usdt
                usdt,
                uint24(3000), // Pool fee, usdt -> weth9
                weth9,
                uint24(3000), // Pool fee, weth9 -> ogn
                ogn
            ),
            recipient: address(this),
            deadline: uint256(block.timestamp + 1000),
            amountIn: uint256(1 ether),
            amountOutMinimum: uint256(0)
        });

        UniswapV3Router(uniswapAddr).exactInput(params);
    }

    /**
     * @notice Owner function to withdraw a specific amount of a token
     */
    function transferToken(address token, uint256 amount)
        external
        onlyGovernor
        nonReentrant
    {
        IERC20(token).safeTransfer(_governor(), amount);
    }
}

// -- Solididy v0.5.x compatible interface
interface UniswapV3Router {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    /// @notice Swaps `amountIn` of one token for as much as possible of another along the specified path
    /// @param params The parameters necessary for the multi-hop swap, encoded as `ExactInputParams` in calldata
    /// @return amountOut The amount of the received token
    function exactInput(ExactInputParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}
