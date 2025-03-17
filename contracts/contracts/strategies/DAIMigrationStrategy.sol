// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDaiUsdsMigrationContract {
    function daiToUsds(address usr, uint256 wad) external;

    function usdsToDai(address usr, uint256 wad) external;
}

contract DAIMigrationStrategy is InitializableAbstractStrategy {
    address public immutable dai;
    address public immutable usds;

    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _dai,
        address _usds
    ) InitializableAbstractStrategy(_baseConfig) {
        dai = _dai;
        usds = _usds;
    }

    function initialize(address _governorAddr)
        external
        onlyGovernor
        initializer
    {
        _setGovernor(_governorAddr);

        address[] memory rewardTokens = new address[](0);
        address[] memory assets = new address[](2);
        address[] memory pTokens = new address[](2);

        assets[0] = address(dai);
        assets[1] = address(usds);
        pTokens[0] = address(dai);
        pTokens[1] = address(usds);

        InitializableAbstractStrategy._initialize(
            rewardTokens,
            assets,
            pTokens
        );
    }

    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    function depositAll() external override onlyVault nonReentrant {
        _deposit(dai, IERC20(dai).balanceOf(address(this)));
    }

    function _deposit(address _asset, uint256 _amount) internal {
        // You can only deposit DAI
        require(_asset == dai, "Only DAI can be deposited");
        require(_amount > 0, "Must deposit something");

        IERC20(dai).approve(platformAddress, _amount);
        IDaiUsdsMigrationContract(platformAddress).daiToUsds(
            address(this),
            _amount
        );
    }

    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        _withdraw(_recipient, _asset, _amount);
    }

    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        _withdraw(vaultAddress, usds, IERC20(usds).balanceOf(address(this)));
    }

    function _withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) internal {
        // You can only withdraw USDS
        require(_asset == usds, "Unsupported asset");
        require(_amount > 0, "Must withdraw something");
        require(_recipient == vaultAddress, "Only the vault can withdraw");
        // slither-disable-next-line unchecked-transfer unused-return
        IERC20(usds).transfer(_recipient, _amount);
    }

    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        if (_asset == dai) {
            // Contract should not have any DAI at any point of time.
            return 0;
        } else if (_asset == usds) {
            balance = IERC20(usds).balanceOf(address(this));
        } else {
            revert("Unsupported asset");
        }
    }

    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == dai || _asset == usds;
    }

    function collectRewardTokens() external override {}

    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {}

    function safeApproveAllTokens() external override {}
}
