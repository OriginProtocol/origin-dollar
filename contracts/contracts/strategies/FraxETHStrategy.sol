// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH Generalized 4626 Strategy
 * @notice Investment strategy for vaults supporting ERC4626
 * @author Origin Protocol Inc
 */
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20 } from "../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IFraxETHMinter } from "../interfaces/IFraxETHMinter.sol";
import { Generalized4626Strategy } from "./Generalized4626Strategy.sol";

contract FraxETHStrategy is Generalized4626Strategy {
    using SafeERC20 for IERC20;

    IWETH9 public constant weth =
        IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    IFraxETHMinter public constant fraxETHMinter =
        IFraxETHMinter(0xbAFA44EFE7901E04E39Dad13167D089C559c1138);

    function _deposit(address _asset, uint256 _amount) internal override {
        require(_amount > 0, "Must deposit something");
        require(
            _asset == address(weth) || _asset == address(assetToken),
            "Unexpected asset address"
        );

        if (_asset == address(weth)) {
            // Unwrap WETH
            weth.withdraw(_amount);

            // Deposit ETH for frxETH
            // slither-disable-next-line unused-return
            fraxETHMinter.submitAndDeposit{ value: address(this).balance }(
                address(this)
            );
        } else {
            // Stake frxETH
            // slither-disable-next-line unused-return
            IERC4626(platformAddress).deposit(_amount, address(this));
        }

        emit Deposit(_asset, address(shareToken), _amount);
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset)
        external
        view
        override
        returns (bool)
    {
        return _asset == address(assetToken) || _asset == address(weth);
    }

    /**
     * @dev Get the total asset value held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        virtual
        override
        returns (uint256 balance)
    {
        if (_asset == address(weth)) {
            // For WETH, it's always 0
            return 0;
        }

        // If it's not WETH, it has to be frxETH
        require(_asset == address(assetToken), "Unexpected asset address");

        /* We are intentionally not counting the amount of assetToken parked on the
         * contract toward the checkBalance. The deposit and withdraw functions
         * should not result in assetToken being unused and owned by this strategy
         * contract.
         */
        return
            IERC4626(platformAddress).convertToAssets(
                shareToken.balanceOf(address(this))
            );
    }

    /**
     * @dev Deposit the entire balance of assetToken to gain shareToken
     */
    function depositAll() external virtual override onlyVault nonReentrant {
        uint256 balance = assetToken.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(assetToken), balance);
        }

        // ETH + WETH balance
        uint256 ethBalance = address(this).balance +
            weth.balanceOf(address(this));
        if (ethBalance > 0) {
            _deposit(address(weth), ethBalance);
        }
    }

    /**
     * @dev Accept ETH
     */
    receive() external payable {}
}
