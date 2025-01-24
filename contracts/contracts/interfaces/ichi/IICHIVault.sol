// SPDX-License-Identifier: Unlicense

pragma solidity >=0.8.4;

interface IICHIVault {
    function ichiVaultFactory() external view returns (address);

    function symbol() external view returns (string memory);

    function name() external view returns (string memory);

    function decimals() external view returns (uint8);

    function pool() external view returns (address);

    function token0() external view returns (address);

    function allowToken0() external view returns (bool);

    function token1() external view returns (address);

    function allowToken1() external view returns (bool);

    function fee() external view returns (uint24);

    function tickSpacing() external view returns (int24);

    function ammFeeRecipient() external view returns (address);

    function affiliate() external view returns (address);

    function baseLower() external view returns (int24);

    function baseUpper() external view returns (int24);

    function limitLower() external view returns (int24);

    function limitUpper() external view returns (int24);

    /// @notice NFT ID of the base position. If 0, the base position is not initialized.
    function basePositionId() external view returns (uint256);

    /// @notice NFT ID of the limit position. If 0, the limit position is not initialized.
    function limitPositionId() external view returns (uint256);

    function deposit0Max() external view returns (uint256);

    function deposit1Max() external view returns (uint256);

    function hysteresis() external view returns (uint256);

    function twapPeriod() external view returns (uint32);

    function auxTwapPeriod() external view returns (uint32);

    function getTotalAmounts()
        external
        view
        returns (uint256 amount0, uint256 amount1);

    function getBasePosition()
        external
        view
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    function getLimitPosition()
        external
        view
        returns (
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );

    function deposit(
        uint256,
        uint256,
        address
    ) external returns (uint256);

    function withdraw(uint256, address) external returns (uint256, uint256);

    function currentTick() external view returns (int24);

    function resetAllowances() external;

    function rebalance(
        int24 _baseLower,
        int24 _baseUpper,
        int24 _limitLower,
        int24 _limitUpper,
        int256 swapQuantity
    ) external;

    function collectFees() external returns (uint256 fees0, uint256 fees1);

    function setDepositMax(uint256 _deposit0Max, uint256 _deposit1Max) external;

    function setHysteresis(uint256 _hysteresis) external;

    function setAmmFeeRecipient(address _ammFeeRecipient) external;

    function setAffiliate(address _affiliate) external;

    function setTwapPeriod(uint32 newTwapPeriod) external;

    function setAuxTwapPeriod(uint32 newAuxTwapPeriod) external;

    event DeployICHIVault(
        address indexed sender,
        address indexed pool,
        bool allowToken0,
        bool allowToken1,
        address owner,
        uint256 twapPeriod
    );

    event SetTwapPeriod(address sender, uint32 newTwapPeriod);

    event SetAuxTwapPeriod(address sender, uint32 newAuxTwapPeriod);

    event Deposit(
        address indexed sender,
        address indexed to,
        uint256 shares,
        uint256 amount0,
        uint256 amount1
    );

    event Withdraw(
        address indexed sender,
        address indexed to,
        uint256 shares,
        uint256 amount0,
        uint256 amount1
    );

    event Rebalance(
        int24 tick,
        uint256 totalAmount0,
        uint256 totalAmount1,
        uint256 feeAmount0,
        uint256 feeAmount1,
        uint256 totalSupply
    );

    event CollectFees(
        address indexed sender,
        uint256 feeAmount0,
        uint256 feeAmount1
    );

    event Hysteresis(address indexed sender, uint256 hysteresis);

    event DepositMax(
        address indexed sender,
        uint256 deposit0Max,
        uint256 deposit1Max
    );

    event AmmFeeRecipient(address indexed sender, address ammFeeRecipient);

    event Affiliate(address indexed sender, address affiliate);
}
