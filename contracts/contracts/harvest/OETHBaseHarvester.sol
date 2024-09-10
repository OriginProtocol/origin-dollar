// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Governable } from "../governance/Governable.sol";

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IVault } from "../interfaces/IVault.sol";
import { IStrategy } from "../interfaces/IStrategy.sol";
import { ISwapRouter } from "../interfaces/aerodrome/ISwapRouter.sol";

contract OETHBaseHarvester is Governable {
    using SafeERC20 for IERC20;

    IVault public immutable vault;
    IStrategy public immutable amoStrategy;
    IERC20 public immutable aero;
    IERC20 public immutable weth;
    ISwapRouter public immutable swapRouter;

    // Similar sig to `AbstractHarvester.RewardTokenSwapped` for
    // future compatibility with monitoring
    event RewardTokenSwapped(
        address indexed rewardToken,
        address indexed swappedInto,
        uint8 swapPlatform,
        uint256 amountIn,
        uint256 amountOut
    );

    /**
     * @notice Verifies that the caller is either Governor or Strategist.
     */
    modifier onlyGovernorOrStrategist() {
        require(
            msg.sender == vault.strategistAddr() || isGovernor(),
            "Caller is not the Strategist or Governor"
        );
        _;
    }

    constructor(
        address _vault,
        address _amoStrategy,
        address _aero,
        address _weth,
        address _swapRouter
    ) {
        vault = IVault(_vault);
        amoStrategy = IStrategy(_amoStrategy);
        aero = IERC20(_aero);
        weth = IERC20(_weth);
        swapRouter = ISwapRouter(_swapRouter);
    }

    /**
     * @notice Collects AERO from AMO strategy and
     *      sends it to the Strategist multisig.
     *      Anyone can call it.
     */
    function harvest() external {
        address strategistAddr = vault.strategistAddr();
        require(strategistAddr != address(0), "Guardian address not set");

        // Collect all AERO
        amoStrategy.collectRewardTokens();

        uint256 aeroBalance = aero.balanceOf(address(this));
        if (aeroBalance == 0) {
            // Do nothing if there's no AERO to transfer
            return;
        }

        // Transfer everything to Strategist
        aero.safeTransfer(strategistAddr, aeroBalance);
    }

    /**
     * @notice Harvests AERO from AMO strategy and then swaps some (or all)
     *          of it into WETH to distribute yield and fee.
     *         When `feeBps` is set to 10000 (100%), all WETH received is
     *          sent to strategist.
     *
     * @param aeroToSwap Amount of AERO to swap
     * @param minWETHExpected Min. amount of WETH to expect
     * @param feeBps Performance fee bps (Sent to strategist)
     * @param yieldRecipient Yield recipient (must be Vault or Dripper)
     */
    function harvestAndSwap(
        uint256 aeroToSwap,
        uint256 minWETHExpected,
        uint256 feeBps,
        address yieldRecipient
    ) external onlyGovernorOrStrategist {
        address strategistAddr = vault.strategistAddr();
        require(strategistAddr != address(0), "Guardian address not set");

        require(feeBps <= 10000, "Invalid Fee Bps");

        // Collect all AERO
        amoStrategy.collectRewardTokens();

        uint256 aeroBalance = aero.balanceOf(address(this));
        if (aeroBalance == 0) {
            // Do nothing if there's no AERO to transfer/swap
            return;
        }

        if (aeroToSwap > 0) {
            require(aeroBalance >= aeroToSwap, "Insufficient balance for swap");
            _doSwap(aeroToSwap, minWETHExpected);

            // Figure out AERO left in contract after swap
            aeroBalance = aero.balanceOf(address(this));
        }

        // Transfer out any leftover AERO after swap
        if (aeroBalance > 0) {
            aero.safeTransfer(strategistAddr, aeroBalance);
        }

        // Computes using all balance the contract holds,
        // not just the WETH received from swap. Use `transferToken`
        // if there's any WETH left that needs to be taken out
        uint256 availableWETHBalance = weth.balanceOf(address(this));
        // Computation rounds in favor of protocol
        uint256 fee = (availableWETHBalance * feeBps) / 10000;
        uint256 yield = availableWETHBalance - fee;

        // Transfer yield to yield recipient if any
        if (yield > 0) {
            // Yields can only be sent to the Vault or the Dripper.
            // There's no address(0) check since Vault will break if there's
            // no Dripper address set.
            require(
                yieldRecipient == address(vault) ||
                    yieldRecipient == vault.dripper(),
                "Invalid yield recipient"
            );
            weth.safeTransfer(yieldRecipient, yield);
        }

        // Transfer fee to Guardian if any
        if (fee > 0) {
            weth.safeTransfer(strategistAddr, fee);
        }
    }

    /**
     * @notice Swaps AERO to WETH on Aerodrome
     * @param aeroToSwap Amount of AERO to swap
     * @param minWETHExpected Min. amount of WETH to expect
     */
    function _doSwap(uint256 aeroToSwap, uint256 minWETHExpected) internal {
        // Let the swap router move funds
        aero.approve(address(swapRouter), aeroToSwap);

        // Do the swap
        uint256 wethReceived = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(aero),
                tokenOut: address(weth),
                tickSpacing: 200, // From AERO/WETH pool contract
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: aeroToSwap,
                amountOutMinimum: minWETHExpected,
                sqrtPriceLimitX96: 0
            })
        );

        emit RewardTokenSwapped(
            address(aero),
            address(weth),
            0,
            aeroToSwap,
            wethReceived
        );
    }

    /**
     * @notice Transfer token to governor. Intended for recovering tokens stuck in
     *      the contract, i.e. mistaken sends.
     *      Also, allows to transfer any AERO left in the contract.
     * @param _asset Address for the asset
     * @param _amount Amount of the asset to transfer
     */
    function transferToken(address _asset, uint256 _amount)
        external
        virtual
        onlyGovernor
    {
        IERC20(_asset).safeTransfer(governor(), _amount);
    }
}
