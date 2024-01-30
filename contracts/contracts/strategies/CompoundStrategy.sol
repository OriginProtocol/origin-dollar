// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Compound Strategy
 * @notice Investment strategy for Compound like lending platforms. eg Compound and Flux
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { ICERC20 } from "./ICompound.sol";
import { BaseCompoundStrategy, InitializableAbstractStrategy } from "./BaseCompoundStrategy.sol";
import { IComptroller } from "../interfaces/IComptroller.sol";
import { IERC20 } from "../utils/InitializableAbstractStrategy.sol";

contract CompoundStrategy is BaseCompoundStrategy {
    using SafeERC20 for IERC20;
    event SkippedWithdrawal(address asset, uint256 amount);

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

    /**
     * @notice initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address[] memory _rewardTokenAddresses,
        address[] memory _assets,
        address[] memory _pTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }

    /**
     * @notice Collect accumulated COMP and send to Harvester.
     */
    function collectRewardTokens()
        external
        virtual
        override
        onlyHarvester
        nonReentrant
    {
        // Claim COMP from Comptroller
        ICERC20 cToken = _getCTokenFor(assetsMapped[0]);
        IComptroller comptroller = IComptroller(cToken.comptroller());
        // Only collect from active cTokens, saves gas
        address[] memory ctokensToCollect = new address[](assetsMapped.length);
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            ctokensToCollect[i] = address(_getCTokenFor(assetsMapped[i]));
        }
        // Claim only for this strategy
        address[] memory claimers = new address[](1);
        claimers[0] = address(this);
        // Claim COMP from Comptroller. Only collect for supply, saves gas
        comptroller.claimComp(claimers, ctokensToCollect, false, true);
        // Transfer COMP to Harvester
        IERC20 rewardToken = IERC20(rewardTokenAddresses[0]);
        uint256 balance = rewardToken.balanceOf(address(this));
        emit RewardTokenCollected(
            harvesterAddress,
            rewardTokenAddresses[0],
            balance
        );
        rewardToken.safeTransfer(harvesterAddress, balance);
    }

    /**
     * @notice Deposit asset into the underlying platform
     * @param _asset Address of asset to deposit
     * @param _amount Amount of assets to deposit
     */
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /**
     * @dev Deposit an asset into the underlying platform
     * @param _asset Address of the asset to deposit
     * @param _amount Amount of assets to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");
        ICERC20 cToken = _getCTokenFor(_asset);
        emit Deposit(_asset, address(cToken), _amount);
        require(cToken.mint(_amount) == 0, "cToken mint failed");
    }

    /**
     * @notice Deposit the entire balance of any supported asset in the strategy into the underlying platform
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            IERC20 asset = IERC20(assetsMapped[i]);
            uint256 assetBalance = asset.balanceOf(address(this));
            if (assetBalance > 0) {
                _deposit(address(asset), assetBalance);
            }
        }
    }

    /**
     * @notice Withdraw an asset from the underlying platform
     * @param _recipient Address to receive withdrawn assets
     * @param _asset Address of the asset to withdraw
     * @param _amount Amount of assets to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        require(_amount > 0, "Must withdraw something");
        require(_recipient != address(0), "Must specify recipient");

        ICERC20 cToken = _getCTokenFor(_asset);
        // If redeeming 0 cTokens, just skip, else COMP will revert
        uint256 cTokensToRedeem = _convertUnderlyingToCToken(cToken, _amount);
        if (cTokensToRedeem == 0) {
            emit SkippedWithdrawal(_asset, _amount);
            return;
        }

        emit Withdrawal(_asset, address(cToken), _amount);
        require(cToken.redeemUnderlying(_amount) == 0, "Redeem failed");
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Internal method to respond to the addition of new asset / cTokens
     *      We need to approve the cToken and give it permission to spend the asset
     * @param _asset Address of the asset to approve. eg DAI
     * @param _pToken The pToken for the approval. eg cDAI or fDAI
     */
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        // Safe approval
        IERC20(_asset).safeApprove(_pToken, 0);
        IERC20(_asset).safeApprove(_pToken, type(uint256).max);
    }

    /**
     * @notice Remove all supported assets from the underlying platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            IERC20 asset = IERC20(assetsMapped[i]);
            // Redeem entire balance of cToken
            ICERC20 cToken = _getCTokenFor(address(asset));
            uint256 cTokenBalance = cToken.balanceOf(address(this));
            if (cTokenBalance > 0) {
                require(cToken.redeem(cTokenBalance) == 0, "Redeem failed");
                uint256 assetBalance = asset.balanceOf(address(this));
                // Transfer entire balance to Vault
                asset.safeTransfer(vaultAddress, assetBalance);

                emit Withdrawal(address(asset), address(cToken), assetBalance);
            }
        }
    }

    /**
     * @notice Get the total asset value held in the underlying platform
     *      This includes any interest that was generated since depositing.
     *      The exchange rate between the cToken and asset gradually increases,
     *      causing the cToken to be worth more corresponding asset.
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        // Balance is always with token cToken decimals
        ICERC20 cToken = _getCTokenFor(_asset);
        balance = _checkBalance(cToken);
    }

    /**
     * @dev Get the total asset value held in the platform
     *      underlying = (cTokenAmt * exchangeRate) / 1e18
     * @param _cToken     cToken for which to check balance
     * @return balance    Total value of the asset in the platform
     */
    function _checkBalance(ICERC20 _cToken)
        internal
        view
        returns (uint256 balance)
    {
        // e.g. 50e8*205316390724364402565641705 / 1e18 = 1.0265..e18
        balance =
            (_cToken.balanceOf(address(this)) * _cToken.exchangeRateStored()) /
            1e18;
    }

    /**
     * @notice Approve the spending of all assets by their corresponding cToken,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens() external override {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; ++i) {
            IERC20 asset = IERC20(assetsMapped[i]);
            address cToken = assetToPToken[address(asset)];
            // Safe approval
            asset.safeApprove(cToken, 0);
            asset.safeApprove(cToken, type(uint256).max);
        }
    }
}
