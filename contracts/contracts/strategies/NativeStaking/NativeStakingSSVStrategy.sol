// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { ISSVNetwork, Cluster } from "../../interfaces/ISSVNetwork.sol";
import { FeeAccumulator } from "./FeeAccumulator.sol";
import { ValidatorAccountant } from "./ValidatorAccountant.sol";

struct ValidatorStakeData {
    bytes pubkey;
    bytes signature;
    bytes32 depositDataRoot;
}

/// @title Native Staking SSV Strategy
/// @notice Strategy to deploy funds into DVT validators powered by the SSV Network
/// @author Origin Protocol Inc
contract NativeStakingSSVStrategy is
    ValidatorAccountant,
    InitializableAbstractStrategy
{
    using SafeERC20 for IERC20;

    /// @notice SSV ERC20 token that serves as a payment for operating SSV validators
    address public immutable SSV_TOKEN_ADDRESS;
    /// @notice SSV Network contract used to interface with
    address public immutable SSV_NETWORK_ADDRESS;
    /// @notice Fee collector address
    /// @dev this address will receive Execution layer rewards - These are rewards earned for
    /// executing transactions on the Ethereum network as part of block proposals. They include
    /// priority fees (fees paid by users for their transactions to be included) and MEV rewards
    /// (rewards for arranging transactions in a way that benefits the validator).
    address public immutable FEE_ACCUMULATOR_ADDRESS;

    // For future use
    uint256[50] private __gap;

    error EmptyRecipient();
    error NotWeth();
    error InsuffiscientWethBalance(
        uint256 requiredBalance,
        uint256 availableBalance
    );

    /// @param _baseConfig Base strategy config with platformAddress (ERC-4626 Vault contract), eg sfrxETH or sDAI,
    /// and vaultAddress (OToken Vault contract), eg VaultProxy or OETHVaultProxy
    /// @param _wethAddress Address of the Erc20 WETH Token contract
    /// @param _ssvToken Address of the Erc20 SSV Token contract
    /// @param _ssvNetwork Address of the SSV Network contract
    constructor(
        BaseStrategyConfig memory _baseConfig,
        address _wethAddress,
        address _ssvToken,
        address _ssvNetwork,
        address _feeAccumulator
    )
        InitializableAbstractStrategy(_baseConfig)
        ValidatorAccountant(_wethAddress, _baseConfig.vaultAddress)
    {
        SSV_TOKEN_ADDRESS = _ssvToken;
        SSV_NETWORK_ADDRESS = _ssvNetwork;
        FEE_ACCUMULATOR_ADDRESS = _feeAccumulator;
    }

    /// @notice initialize function, to set up initial internal state
    /// @param _rewardTokenAddresses Address of reward token for platform
    /// @param _assets Addresses of initial supported assets
    /// @param _pTokens Platform Token corresponding addresses
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

    /// @notice return the WETH balance on the contract that can be used to for beacon chain
    /// staking - staking on the validators. Because WETH on this contract can be present as
    /// a result of deposits and beacon chain rewards this function needs to return only WETH
    /// that is present due to deposits.
    function getWETHBalanceEligibleForStaking()
        public
        view
        override
        returns (uint256 _amount)
    {
        // if below amount results in a negative number there is a bug with accounting
        _amount =
            IWETH9(WETH_TOKEN_ADDRESS).balanceOf(address(this)) -
            beaconChainRewardWETH;
    }

    /// @notice Collect accumulated WETH & SSV tokens and send to the Harvester.
    function collectRewardTokens()
        external
        virtual
        override
        onlyHarvester
        nonReentrant
    {
        // collect WETH from fee collector and wrap it into WETH
        uint256 wethCollected = FeeAccumulator(FEE_ACCUMULATOR_ADDRESS)
            .collect();

        /* add up the WETH collected from the fee accumulator to beaconChainRewardWETH
         * so it can be sent to the harvester in one swoop in the "_collectRewardTokens"
         * step.
         */
        beaconChainRewardWETH += wethCollected;
        _collectRewardTokens();
    }

    /// @dev Need to override this function since the strategy doesn't allow for all the WETH
    /// to be collected. Some might be there as a result of deposit and is waiting for the Registrar
    /// to be deposited to the validators.
    function _collectRewardTokens() internal override {
        uint256 rewardTokenCount = rewardTokenAddresses.length;
        for (uint256 i = 0; i < rewardTokenCount; ++i) {
            IERC20 rewardToken = IERC20(rewardTokenAddresses[i]);
            uint256 balance = rewardToken.balanceOf(address(this));
            if (balance > 0) {
                if (address(rewardToken) == WETH_TOKEN_ADDRESS) {
                    if (beaconChainRewardWETH > balance) {
                        revert InsuffiscientWethBalance(
                            beaconChainRewardWETH,
                            balance
                        );
                    }

                    // only allow for the WETH that is part of beacon chain rewards to be harvested
                    balance = beaconChainRewardWETH;
                    // reset the counter keeping track of beacon chain WETH rewards
                    beaconChainRewardWETH = 0;
                }

                emit RewardTokenCollected(
                    harvesterAddress,
                    address(rewardToken),
                    balance
                );
                rewardToken.safeTransfer(harvesterAddress, balance);
            }
        }
    }

    /// @notice Deposit asset into the underlying platform
    /// @param _asset Address of asset to deposit
    /// @param _amount Amount of assets to deposit
    function deposit(address _asset, uint256 _amount)
        external
        override
        onlyVault
        nonReentrant
    {
        _deposit(_asset, _amount);
    }

    /// @dev Deposit WETH to this contract to enable automated action to stake it
    /// @param _asset Address of WETH
    /// @param _amount Amount of WETH to deposit
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");
        /*
         * We could do a check here that would revert when "_amount % 32 ether != 0". With the idea of
         * not allowing deposits that will result in WETH sitting on the strategy after all the possible batches
         * of 32ETH have been staked.
         * But someone could mess with our strategy by sending some WETH to it. And we might want to deposit just
         * enough WETH to add it up to 32 so it can be staked. For that reason the check is left out.
         *
         * WETH sitting on the strategy won't interfere with the accounting since accounting only operates on ETH.
         */
        emit Deposit(_asset, address(0), _amount);
    }

    /// @notice Deposit the entire balance of WETH asset in the strategy into the underlying platform
    function depositAll() external override onlyVault nonReentrant {
        uint256 wethBalance = IERC20(WETH_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        if (wethBalance > 0) {
            _deposit(WETH_TOKEN_ADDRESS, wethBalance);
        }
    }

    /// @notice Withdraw WETH from this contract. Used only if some WETH for is lingering on the contract. That
    /// can happen when:
    ///   - the deposit was not a multiple of 32 WETH
    ///   - someone sent WETH directly to this contract
    /// @param _recipient Address to receive withdrawn assets
    /// @param _asset WETH to withdraw
    /// @param _amount Amount of WETH to withdraw
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
        require(_amount > 0, "Must withdraw something");
        if (_recipient == address(0)) {
            revert EmptyRecipient();
        }

        emit Withdrawal(_asset, address(0), _amount);
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /// @notice Remove all supported assets from the underlying platform and send them to Vault contract.
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        uint256 wethBalance = IERC20(WETH_TOKEN_ADDRESS).balanceOf(
            address(this)
        );
        if (wethBalance > 0) {
            _withdraw(vaultAddress, WETH_TOKEN_ADDRESS, wethBalance);
        }
    }

    function _abstractSetPToken(address _asset, address) internal override {}

    /// @notice Returns the total value of (W)ETH that is staked to the validators
    /// and also present on the native staking and fee accumulator contracts
    /// @param _asset      Address of weth asset
    /// @return balance    Total value of (W)ETH 
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        if (_asset != WETH_TOKEN_ADDRESS) {
            revert NotWeth();
        }

        balance = activeDepositedValidators * 32 ether;
        balance += beaconChainRewardWETH;
        balance += FEE_ACCUMULATOR_ADDRESS.balance;
    }

    function pause() external onlyStrategist {
        _pause();
    }

    /// @dev Retuns bool indicating whether asset is supported by strategy
    /// @param _asset Address of the asset
    function supportsAsset(address _asset) public view override returns (bool) {
        return _asset == WETH_TOKEN_ADDRESS;
    }

    /// @notice Approve the spending of all assets
    /// @dev Approves the SSV Network contract to transfer SSV tokens for deposits
    function safeApproveAllTokens() external override {
        /// @dev Approves the SSV Network contract to transfer SSV tokens for deposits
        IERC20(SSV_TOKEN_ADDRESS).approve(
            SSV_NETWORK_ADDRESS,
            type(uint256).max
        );
    }

    /// @dev Deposits more SSV Tokens to the SSV Network contract which is used to pay the SSV Operators
    /// A SSV cluster is defined by the SSVOwnerAddress and the set of operatorIds
    function depositSSV(
        uint64[] memory operatorIds,
        uint256 amount,
        Cluster memory cluster
    ) external {
        // address SSV_NETWORK_ADDRESS = lrtConfig.getContract(LRTConstants.SSV_NETWORK);
        // ISSVNetwork(SSV_NETWORK_ADDRESS).deposit(address(this), operatorIds, amount, cluster);
    }
}
