pragma solidity 0.5.11;

import "../governance/Governable.sol";
import "../token/OUSD.sol";
import "../interfaces/Tether.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

// Contract to exchange usdt, usdc, dai from and to ousd.
//   - 1 to 1. No slippage
//   - Optimized for low gas usage
//   - No guarantee of availability

contract FlipperDev is Governable {
    using SafeERC20 for IERC20;

    uint256 constant MAXIMUM_PER_TRADE = (25000 * 1e18);

    // Settable coin addresses allow easy testing and use of mock currencies.
    IERC20 dai = IERC20(0);
    OUSD ousd = OUSD(0);
    IERC20 usdc = IERC20(0);
    Tether usdt = Tether(0);

    // ---------------------
    // Dev constructor
    // ---------------------
    constructor(
        address dai_,
        address ousd_,
        address usdc_,
        address usdt_
    ) public {
        dai = IERC20(dai_);
        ousd = OUSD(ousd_);
        usdc = IERC20(usdc_);
        usdt = Tether(usdt_);
        require(address(ousd) != address(0));
        require(address(dai) != address(0));
        require(address(usdc) != address(0));
        require(address(usdt) != address(0));
    }

    // -----------------
    // Trading functions
    // -----------------

    /// @notice Purchase OUSD with Dai
    /// @param amount Amount of OUSD to purchase, in 18 fixed decimals.
    function buyOusdWithDai(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        require(
            dai.transferFrom(msg.sender, address(this), amount),
            "DAI transfer failed"
        );
        require(ousd.transfer(msg.sender, amount), "OUSD transfer failed");
    }

    /// @notice Sell OUSD for Dai
    /// @param amount Amount of OUSD to sell, in 18 fixed decimals.
    function sellOusdForDai(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        require(dai.transfer(msg.sender, amount), "DAI transfer failed");
        require(
            ousd.transferFrom(msg.sender, address(this), amount),
            "OUSD transfer failed"
        );
    }

    /// @notice Purchase OUSD with USDC
    /// @param amount Amount of OUSD to purchase, in 18 fixed decimals.
    function buyOusdWithUsdc(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        // Potential rounding error is an intentional trade off
        require(
            usdc.transferFrom(msg.sender, address(this), amount / 1e12),
            "USDC transfer failed"
        );
        require(ousd.transfer(msg.sender, amount), "OUSD transfer failed");
    }

    /// @notice Sell OUSD for USDC
    /// @param amount Amount of OUSD to sell, in 18 fixed decimals.
    function sellOusdForUsdc(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        require(
            usdc.transfer(msg.sender, amount / 1e12),
            "USDC transfer failed"
        );
        require(
            ousd.transferFrom(msg.sender, address(this), amount),
            "OUSD transfer failed"
        );
    }

    /// @notice Purchase OUSD with USDT
    /// @param amount Amount of OUSD to purchase, in 18 fixed decimals.
    function buyOusdWithUsdt(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        // Potential rounding error is an intentional trade off
        // USDT does not return a boolean and reverts,
        // so no need for a require.
        usdt.transferFrom(msg.sender, address(this), amount / 1e12);
        require(ousd.transfer(msg.sender, amount), "OUSD transfer failed");
    }

    /// @notice Sell OUSD for USDT
    /// @param amount Amount of OUSD to sell, in 18 fixed decimals.
    function sellOusdForUsdt(uint256 amount) external {
        require(amount <= MAXIMUM_PER_TRADE, "Amount too large");
        // USDT does not return a boolean and reverts,
        // so no need for a require.
        usdt.transfer(msg.sender, amount / 1e12);
        require(
            ousd.transferFrom(msg.sender, address(this), amount),
            "OUSD transfer failed"
        );
    }

    // --------------------
    // Governance functions
    // --------------------

    /// @dev Opting into yield reduces the gas cost per transfer by about 4K, since
    /// ousd needs to do less accounting and one less storage write.
    function rebaseOptIn() external onlyGovernor nonReentrant {
        ousd.rebaseOptIn();
    }

    /// @notice Owner function to withdraw a specific amount of a token
    function withdraw(address token, uint256 amount)
        external
        onlyGovernor
        nonReentrant
    {
        IERC20(token).safeTransfer(_governor(), amount);
    }

    /// @notice Owner function to withdraw all tradable tokens
    /// @dev Contract will not perform any swaps until liquidity is provided
    /// again by transferring assets to the contract.
    function withdrawAll() external onlyGovernor nonReentrant {
        IERC20(dai).safeTransfer(_governor(), dai.balanceOf(address(this)));
        IERC20(ousd).safeTransfer(_governor(), ousd.balanceOf(address(this)));
        IERC20(address(usdt)).safeTransfer(
            _governor(),
            usdt.balanceOf(address(this))
        );
        IERC20(usdc).safeTransfer(_governor(), usdc.balanceOf(address(this)));
    }
}
