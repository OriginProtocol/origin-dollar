pragma solidity 0.5.11;

import { Governable } from "../governance/Governable.sol";

import { IUniswapV2Router } from "../interfaces/uniswap/IUniswapV2Router02.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract BuybackConstructor is Governable {
    using SafeERC20 for IERC20;

    event UniswapUpdated(address _address);

    // Address of Uniswap
    address public uniswapAddr = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    // Address of OUSD Vault
    address public vaultAddr = 0xE75D77B1865Ae93c7eaa3040B038D7aA7BC02F70;

    // Swap from OUSD
    IERC20 ousd = IERC20(0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86);

    // Swap to OGN
    IERC20 ogn = IERC20(0x8207c1FfC5B6804F6024322CcF34F29c3541Ae26);

    // USDT for Uniswap path
    IERC20 usdt = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);


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

        // Uniswap redemption path
        address[] memory path = new address[](4);
        path[0] = address(ousd);
        path[1] = address(usdt);
        path[2] = IUniswapV2Router(uniswapAddr).WETH();
        path[3] = address(ogn);
        IUniswapV2Router(uniswapAddr).swapExactTokensForTokens(
            sourceAmount,
            uint256(0),
            path,
            address(this),
            now
        );
    }

    /**
     * @notice Owner function to withdraw a specific amount of a token
     * @param token token to be transferered
     * @param amount amount of the token to be transferred
     */
    function transferToken(address token, uint256 amount)
        external
        onlyGovernor
        nonReentrant
    {
        IERC20(token).safeTransfer(_governor(), amount);
    }
}
