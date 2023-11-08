// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title OETH FraxETH Strategy
 * @notice Investment WETH and FraxETH into the sFraxETH staking contract
 * @author Origin Protocol Inc
 */
import { IERC4626 } from "../../lib/openzeppelin/interfaces/IERC4626.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IWETH9 } from "../interfaces/IWETH9.sol";
import { IFraxETHMinter } from "../interfaces/IFraxETHMinter.sol";
import { Generalized4626Strategy, IERC20, InitializableAbstractStrategy } from "./Generalized4626Strategy.sol";

contract FraxETHStrategy is Generalized4626Strategy {
    using SafeERC20 for IERC20;

    address public constant weth = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    IFraxETHMinter public constant fraxETHMinter =
        IFraxETHMinter(0xbAFA44EFE7901E04E39Dad13167D089C559c1138);

    /**
     * @param _baseConfig Base strategy config with platformAddress (sfrxETH) and vaultAddress (OETHVaultProxy)
     * @param _assetToken Address of the ERC-4626 asset token (frxETH)
     */
    constructor(BaseStrategyConfig memory _baseConfig, address _assetToken)
        Generalized4626Strategy(_baseConfig, _assetToken)
    {}

    function initialize() external override onlyGovernor initializer {
        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](2);
        address[] memory pTokens = new address[](2);

        assets[0] = address(assetToken);
        assets[1] = address(weth);
        pTokens[0] = address(platformAddress);
        pTokens[1] = address(platformAddress);

        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    function _deposit(address _asset, uint256 _amount) internal override {
        require(_amount > 0, "Must deposit something");

        if (_asset == weth) {
            // Unwrap WETH
            IWETH9(weth).withdraw(_amount);

            // Deposit ETH for frxETH and stake it
            // slither-disable-next-line unused-return
            fraxETHMinter.submitAndDeposit{ value: _amount }(address(this));
        } else if (_asset == address(assetToken)) {
            // Stake frxETH
            // slither-disable-next-line unused-return
            IERC4626(platformAddress).deposit(_amount, address(this));
        } else {
            revert("Unexpected asset address");
        }

        emit Deposit(_asset, address(shareToken), _amount);
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == address(assetToken) || _asset == weth;
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
        if (_asset == weth) {
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
        return IERC4626(platformAddress).maxWithdraw(address(this));
    }

    /**
     * @dev Deposit the entire balance of assetToken to gain shareToken
     */
    function depositAll() external virtual override onlyVault nonReentrant {
        uint256 balance = assetToken.balanceOf(address(this));
        if (balance > 0) {
            _deposit(address(assetToken), balance);
        }

        uint256 wethBalance = IWETH9(weth).balanceOf(address(this));
        if (wethBalance > 0) {
            _deposit(weth, wethBalance);
        }
    }

    /**
     * @dev Accept ETH
     */
    receive() external payable {}
}
