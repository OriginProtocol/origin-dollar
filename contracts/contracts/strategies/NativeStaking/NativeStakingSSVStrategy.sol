// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { InitializableAbstractStrategy } from "../../utils/InitializableAbstractStrategy.sol";
import { IWETH9 } from "../../interfaces/IWETH9.sol";
import { ISSVNetwork, Cluster } from "../../interfaces/ISSVNetwork.sol";
import { FeeAccumulator } from "./FeeAccumulator.sol";
import { ValidatorRegistrator } from "./ValidatorRegistrator.sol";

struct ValidatorStakeData {
    bytes pubkey;
    bytes signature;
    bytes32 depositDataRoot;
}

/**
 * @title Native Staking SSV Strategy
 * @notice Strategy to deploy funds into DVT validators powered by the SSV Network
 * @author Origin Protocol Inc
 */
contract NativeStakingSSVStrategy is ValidatorRegistrator, InitializableAbstractStrategy {
    using SafeERC20 for IERC20;

    /// @notice The Wrapped ETH (WETH) contract address
    address public immutable WETH_TOKEN_ADDRESS;
    /// @notice SSV ERC20 token that serves as a payment for operating SSV validators
    address public immutable SSV_TOKEN_ADDRESS;
    /// @notice SSV Network contract used to interface with 
    address public immutable SSV_NETWORK_ADDRESS;
    /// @notice Fee collector address
    address public immutable FEE_ACCUMULATOR_ADDRESS;
    /// @dev The WETH present on this contract will come from 2 sources:
    ///  - as a result of deposits from the VaultAdmin
    ///  - accounting function converting beaconChain rewards from ETH to WETH
    /// 
    /// We need to be able to keep a separate accounting of the WETH so we understand how much we can pass oh to 
    /// the harvester as a consequence of rewards harvesting and how much registrator can pick up as a result of WETH 
    /// deposit into the strategy contract.
    /// To achieve this the beacon chain rewards are accounted for using below variable, all other WETH is assumed to be
    /// present as a result of a deposit.
    uint256 beaconChainRewardWETH = 0;

    /// This notion page offers a good explanation of the bottom and top intervals for fuses:
    /// https://www.notion.so/originprotocol/Limited-simplified-native-staking-accounting-67a217c8420d40678eb943b9da0ee77d
    /// In short after dividing by 32 if the ETH remaining on the contract falls between 0 and fuseIntervalStart the accounting
    /// function will treat that ETH as a Beacon Chain Reward ETH.
    /// On the contrary if after dividing by 32 the ETH remaining on the contract falls between fuseIntervalEnd and 32 the 
    /// accounting function will treat that as a validator slashing.
    /// 
    /// @dev start of fuse interval
    uint256 fuseIntervalStart = 0;
    /// @dev end of fuse interval
    uint256 fuseIntervalEnd = 0;

    // For future use
    uint256[50] private __gap;

    event FuseIntervalUpdated(uint256 oldStart, uint256 oldEnd, uint256 start, uint256 end);

    error FuseIntervalValuesIncorrect();
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

    /// @notice return the WETH balance on the contract that can be used to for beacon chain
    /// staking - staking on the validators. Because WETH on this contract can be present as 
    /// a result of deposits and beacon chain rewards this function needs to return only WETH
    /// that is present due to deposits.
    function getWETHBalanceEligibleForStaking() public override returns(uint256 _amount){
        // if below amount results in a negative number there is a bug with accounting
        _amount = IWETH9(WETH_TOKEN_ADDRESS).balanceOf(address(this)) - beaconChainRewardWETH;
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
        require(_amount > 0, "Must withdraw something");
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
     * @dev Approves the SSV Network contract to transfer SSV tokens for deposits
     */
    function safeApproveAllTokens() external override {
        /// @dev Approves the SSV Network contract to transfer SSV tokens for deposits
        IERC20(SSV_TOKEN_ADDRESS).approve(SSV_NETWORK_ADDRESS, type(uint256).max);
    }

    /// @dev Deposits more SSV Tokens to the SSV Network contract which is used to pay the SSV Operators
    /// A SSV cluster is defined by the SSVOwnerAddress and the set of operatorIds
    function depositSSV(uint64[] memory operatorIds, uint256 amount, Cluster memory cluster) external {
        // address SSV_NETWORK_ADDRESS = lrtConfig.getContract(LRTConstants.SSV_NETWORK);
        // ISSVNetwork(SSV_NETWORK_ADDRESS).deposit(address(this), operatorIds, amount, cluster);
    }

    /**
     * @notice set fuse interval values
     */
    function setFuseInterval(uint256 _fuseIntervalStart, uint256 _fuseIntervalEnd) external onlyGovernor {
        if (
            _fuseIntervalStart > _fuseIntervalEnd ||
            _fuseIntervalStart >= 32 ether || 
            _fuseIntervalEnd >= 32 ether || 
            _fuseIntervalEnd - _fuseIntervalStart < 4 ether

        ) {
            revert FuseIntervalValuesIncorrect();
        }

        emit FuseIntervalUpdated(fuseIntervalStart, fuseIntervalEnd, _fuseIntervalStart, _fuseIntervalEnd);

        fuseIntervalStart = _fuseIntervalStart;
        fuseIntervalEnd = _fuseIntervalEnd;
    }
}
