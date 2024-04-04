// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { FeeAccumulator } from "./FeeAccumulator.sol";

/**
 * @title Native Staking SSV Strategy
 * @notice Strategy to deploy funds into DVT validators powered by the SSV Network
 * @author Origin Protocol Inc
 */
contract NativeStakingSSVStrategy is InitializableAbstractStrategy {
    using SafeERC20 for IERC20;
    /// @dev The Wrapped ETH (WETH) contract address
    address public immutable WETH_TOKEN_ADDRESS;
    /// @dev SSV ERC20 token that serves as a payment for operating SSV validators
    address public immutable SSV_TOKEN_ADDRESS;
    /// @dev SSV Network contract used to interface with 
    address public immutable SSV_NETWORK_ADDRESS;
    /// @dev Fee collector address
    address public immutable FEE_ACCUMULATOR_ADDRESS;

    // For future use
    uint256[50] private __gap;

    error EmptyDeposit();
    error EmptyWithdrawal();
    error EmptyRecipient();

    /**
     * @param _baseConfig Base strategy config with platformAddress (ERC-4626 Vault contract), eg sfrxETH or sDAI,
     * and vaultAddress (OToken Vault contract), eg VaultProxy or OETHVaultProxy
     * @param _wethAddress Address of the Erc20 WETH Token contract
     * @param _ssvToken Address of the Erc20 SSV Token contract
     * @param _ssvNetwork Address of the SSV Network contract
     */
    constructor(BaseStrategyConfig memory _baseConfig, address _wethAddress, address _ssvToken, address _ssvNetwork, address _feeAccumulator)
        InitializableAbstractStrategy(_baseConfig)
    {
        WETH_TOKEN_ADDRESS = _wethAddress;
        SSV_TOKEN_ADDRESS = _ssvToken;
        SSV_NETWORK_ADDRESS = _ssvNetwork;
        FEE_ACCUMULATOR_ADDRESS = _feeAccumulator;
    }

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
     * @notice Collect accumulated WETH & SSV tokens and send to the Harvester.
     */
    function collectRewardTokens()
        external
        virtual
        override
        onlyHarvester
        nonReentrant
    {
        // collect ETH from fee collector and wrap it into WETH
        uint256 ethCollected = FeeAccumulator(FEE_ACCUMULATOR_ADDRESS).collect();
        IWETH9(WETH_TOKEN_ADDRESS).deposit{ value: ethCollected }();
        _collectRewardTokens();
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
     * @dev Deposit WETH to this contract to enable automated action to stake it
     * @param _asset Address of WETH
     * @param _amount Amount of WETH to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        if (_amount == 0) {
            revert EmptyDeposit();
        }
        /* 
         * We could do a check here that would revert when "_amount % 32 ether != 0". With the idea of
         * not allowing deposits that will result in WETH sitting on the strategy after all the possible batches
         * of 32ETH have been staked. But someone could DOS our strategy by sending some WETH dust to it. 
         * for that reason the check is left out. 
         *
         * WETH sitting on the strategy won't interfere with the accounting since accounting only operates on ETH.
         */
        emit Deposit(_asset, address(0), _amount);
    }

    /**
     * @notice Deposit the entire balance of WETH asset in the strategy into the underlying platform
     */
    function depositAll() external override onlyVault nonReentrant {
        uint256 wethBalance = IERC20(WETH_TOKEN_ADDRESS).balanceOf(address(this));
        if (wethBalance > 0) {
            _deposit(WETH_TOKEN_ADDRESS, wethBalance);
        }
    }

    /**
     * @notice Withdraw WETH from this contract. Used only if some WETH for is lingering on the contract. That
     * can happen when:
     *   - the deposit was not a multiple of 32 WETH
     *   - someone sent WETH directly to this contract
     * @param _recipient Address to receive withdrawn assets
     * @param _asset WETH to withdraw
     * @param _amount Amount of WETH to withdraw
     */
    function withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) external override onlyVault nonReentrant {
        _withdraw(_recipient, _asset, _amount);
    }

    function _withdraw(
        address _recipient,
        address _asset,
        uint256 _amount
    ) internal {
        if (_amount == 0) {
            revert EmptyWithdrawal();
        }
        if (_recipient == address(0)) {
            revert EmptyRecipient();
        }

        emit Withdrawal(_asset, address(0), _amount);
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }


    /**
     * @notice Remove all supported assets from the underlying platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 wethBalance = IERC20(WETH_TOKEN_ADDRESS).balanceOf(address(this));
        if (wethBalance > 0) {
            _withdraw(vaultAddress, WETH_TOKEN_ADDRESS, wethBalance);
        }
    }

    function _abstractSetPToken(address _asset, address) internal override {}

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
        balance = 0;
    }


    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == WETH_TOKEN_ADDRESS;
    }

    /**
     * @notice Approve the spending of all assets
     */
    function safeApproveAllTokens() external override {}
}
