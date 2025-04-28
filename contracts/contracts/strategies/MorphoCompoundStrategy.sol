// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Morpho Compound Strategy
 * @notice Investment strategy for investing stablecoins via Morpho (Compound)
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, AbstractCompoundStrategy, InitializableAbstractStrategy } from "./AbstractCompoundStrategy.sol";
import { IMorpho } from "../interfaces/morpho/IMorpho.sol";
import { ILens } from "../interfaces/morpho/ILens.sol";
import { StableMath } from "../utils/StableMath.sol";
import "../utils/Helpers.sol";

contract MorphoCompoundStrategy is AbstractCompoundStrategy {
    address public constant MORPHO = 0x8888882f8f843896699869179fB6E4f7e3B58888;
    address public constant LENS = 0x930f1b46e1D081Ec1524efD95752bE3eCe51EF67;
    using SafeERC20 for IERC20;
    using StableMath for uint256;

    constructor(BaseStrategyConfig memory _stratConfig)
        InitializableAbstractStrategy(_stratConfig)
    {}

    /**
     * @dev Initialize function, to set up initial internal state
     * @param _rewardTokenAddresses Address of reward token for platform
     * @param _assets Addresses of initial supported assets
     * @param _pTokens Platform Token corresponding addresses
     */
    function initialize(
        address[] calldata _rewardTokenAddresses,
        address[] calldata _assets,
        address[] calldata _pTokens
    ) external onlyGovernor initializer {
        InitializableAbstractStrategy._initialize(
            _rewardTokenAddresses,
            _assets,
            _pTokens
        );
    }

    /**
     * @dev Approve the spending of all assets by main Morpho contract,
     *      if for some reason is it necessary.
     */
    function safeApproveAllTokens()
        external
        override
        onlyGovernor
        nonReentrant
    {
        uint256 assetCount = assetsMapped.length;
        for (uint256 i = 0; i < assetCount; i++) {
            address asset = assetsMapped[i];

            // Safe approval
            IERC20(asset).safeApprove(MORPHO, 0);
            IERC20(asset).safeApprove(MORPHO, type(uint256).max);
        }
    }

    /**
     * @dev Internal method to respond to the addition of new asset
     *      We need to approve and allow Morpho to move them
     * @param _asset Address of the asset to approve
     * @param _pToken The pToken for the approval
     */
    // solhint-disable-next-line no-unused-vars
    function _abstractSetPToken(address _asset, address _pToken)
        internal
        override
    {
        IERC20(_asset).safeApprove(MORPHO, 0);
        IERC20(_asset).safeApprove(MORPHO, type(uint256).max);
    }

    /**
     * @dev Collect accumulated rewards and send them to Harvester.
     */
    function collectRewardTokens()
        external
        override
        onlyHarvester
        nonReentrant
    {
        /**
         * Gas considerations. We could query Morpho LENS's `getUserUnclaimedRewards` for each
         * cToken separately and only claimRewards where it is economically feasible. Each call
         * (out of 3) costs ~60k gas extra.
         *
         * Each extra cToken in the `poolTokens` of `claimRewards` function makes that call
         * 89-120k more expensive gas wise.
         *
         * With Lens query in case where:
         *  - there is only 1 reward token to collect. Net gas usage in best case would be
         *    3*60 - 2*120 = -60k -> saving 60k gas
         *  - there are 2 reward tokens to collect. Net gas usage in best case would be
         *    3*60 - 120 = 60k -> more expensive for 60k gas
         *  - there are 3 reward tokens to collect. Net gas usage in best case would be
         *    3*60 = 180k -> more expensive for 180k gas
         *
         * For the above reasoning such "optimization" is not implemented
         */

        address[] memory poolTokens = new address[](assetsMapped.length);
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            poolTokens[i] = assetToPToken[assetsMapped[i]];
        }

        // slither-disable-next-line unused-return
        IMorpho(MORPHO).claimRewards(
            poolTokens, // The addresses of the underlying protocol's pools to claim rewards from
            false // Whether to trade the accrued rewards for MORPHO token, with a premium
        );

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
     * @dev Get the amount of rewards pending to be collected from the protocol
     */
    function getPendingRewards() external view returns (uint256 balance) {
        address[] memory poolTokens = new address[](assetsMapped.length);
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            poolTokens[i] = assetToPToken[assetsMapped[i]];
        }

        return ILens(LENS).getUserUnclaimedRewards(poolTokens, address(this));
    }

    /**
     * @dev Deposit asset into Morpho
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
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
     * @dev Deposit asset into Morpho
     * @param _asset Address of asset to deposit
     * @param _amount Amount of asset to deposit
     */
    function _deposit(address _asset, uint256 _amount) internal {
        require(_amount > 0, "Must deposit something");

        IMorpho(MORPHO).supply(
            address(_getCTokenFor(_asset)),
            address(this), // the address of the user you want to supply on behalf of
            _amount
        );
        emit Deposit(_asset, address(_getCTokenFor(_asset)), _amount);
    }

    /**
     * @dev Deposit the entire balance of any supported asset into Morpho
     */
    function depositAll() external override onlyVault nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            uint256 balance = IERC20(assetsMapped[i]).balanceOf(address(this));
            if (balance > 0) {
                _deposit(assetsMapped[i], balance);
            }
        }
    }

    /**
     * @dev Withdraw asset from Morpho
     * @param _recipient Address to receive withdrawn asset
     * @param _asset Address of asset to withdraw
     * @param _amount Amount of asset to withdraw
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
        require(_recipient != address(0), "Must specify recipient");

        address pToken = assetToPToken[_asset];

        IMorpho(MORPHO).withdraw(pToken, _amount);
        emit Withdrawal(_asset, address(_getCTokenFor(_asset)), _amount);
        IERC20(_asset).safeTransfer(_recipient, _amount);
    }

    /**
     * @dev Remove all assets from platform and send them to Vault contract.
     */
    function withdrawAll() external override onlyVaultOrGovernor nonReentrant {
        for (uint256 i = 0; i < assetsMapped.length; i++) {
            uint256 balance = _checkBalance(assetsMapped[i]);
            if (balance > 0) {
                _withdraw(vaultAddress, assetsMapped[i], balance);
            }
        }
    }

    /**
     * @dev Return total value of an asset held in the platform
     * @param _asset      Address of the asset
     * @return balance    Total value of the asset in the platform
     */
    function checkBalance(address _asset)
        external
        view
        override
        returns (uint256 balance)
    {
        return _checkBalance(_asset);
    }

    function _checkBalance(address _asset)
        internal
        view
        returns (uint256 balance)
    {
        address pToken = assetToPToken[_asset];

        // Total value represented by decimal position of underlying token
        (, , balance) = ILens(LENS).getCurrentSupplyBalanceInOf(
            pToken,
            address(this)
        );
    }
}
