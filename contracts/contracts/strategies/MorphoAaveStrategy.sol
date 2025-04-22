// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/**
 * @title OUSD Morpho Aave Strategy
 * @notice Investment strategy for investing stablecoins via Morpho (Aave)
 * @author Origin Protocol Inc
 */
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20, InitializableAbstractStrategy } from "../utils/InitializableAbstractStrategy.sol";
import { IMorpho } from "../interfaces/morpho/IMorpho.sol";
import { ILens } from "../interfaces/morpho/ILens.sol";
import { StableMath } from "../utils/StableMath.sol";

contract MorphoAaveStrategy is InitializableAbstractStrategy {
    address public constant MORPHO = 0x777777c9898D384F785Ee44Acfe945efDFf5f3E0;
    address public constant LENS = 0x507fA343d0A90786d86C7cd885f5C49263A91FF4;

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
        // Morpho Aave-v2 doesn't distribute reward tokens
        // solhint-disable-next-line max-line-length
        // Ref: https://developers.morpho.xyz/interact-with-morpho/get-started/interact-with-morpho/claim-rewards#morpho-aave-v2
    }

    /**
     * @dev Get the amount of rewards pending to be collected from the protocol
     */
    function getPendingRewards() external view returns (uint256 balance) {
        // Morpho Aave-v2 doesn't distribute reward tokens
        // solhint-disable-next-line max-line-length
        // Ref: https://developers.morpho.xyz/interact-with-morpho/get-started/interact-with-morpho/claim-rewards#morpho-aave-v2
        return 0;
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

        address pToken = address(_getPTokenFor(_asset));

        IMorpho(MORPHO).supply(
            pToken,
            address(this), // the address of the user you want to supply on behalf of
            _amount
        );
        emit Deposit(_asset, pToken, _amount);
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

        address pToken = address(_getPTokenFor(_asset));

        IMorpho(MORPHO).withdraw(pToken, _amount);
        emit Withdrawal(_asset, pToken, _amount);
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
        address pToken = address(_getPTokenFor(_asset));

        // Total value represented by decimal position of underlying token
        (, , balance) = ILens(LENS).getCurrentSupplyBalanceInOf(
            pToken,
            address(this)
        );
    }

    /**
     * @dev Retuns bool indicating whether asset is supported by strategy
     * @param _asset Address of the asset
     */
    function supportsAsset(address _asset) public view override returns (bool) {
        return assetToPToken[_asset] != address(0);
    }

    /**
     * @dev Get the pToken wrapped in the IERC20 interface for this asset.
     *      Fails if the pToken doesn't exist in our mappings.
     * @param _asset Address of the asset
     * @return pToken Corresponding pToken to this asset
     */
    function _getPTokenFor(address _asset) internal view returns (IERC20) {
        address pToken = assetToPToken[_asset];
        require(pToken != address(0), "pToken does not exist");
        return IERC20(pToken);
    }
}
