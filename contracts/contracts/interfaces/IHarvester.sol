// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IHarvester {
    event RewardTokenConfigUpdated(
        address _tokenAddress,
        uint16 _allowedSlippageBps,
        uint16 _harvestRewardBps,
        address _uniswapV2CompatibleAddr,
        uint256 _liquidationLimit,
        bool _doSwapRewardToken
    );

    struct RewardTokenConfig {
        uint16 allowedSlippageBps;
        uint16 harvestRewardBps;
        address uniswapV2CompatibleAddr;
        bool doSwapRewardToken;
        uint256 liquidationLimit;
    }

    // Governable.sol
    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    function governor() external view returns (address);

    // Harvester.sol
    function addSwapToken(address _addr) external;

    function removeSwapToken(address _addr) external;

    function setRewardsProceedsAddress(address _rewardProceedsAddress) external;

    function harvest() external;

    function harvest(address _strategyAddr) external;

    function swap() external;

    function harvestAndSwap() external;

    function harvestAndSwap(address _strategyAddr) external;

    function harvestAndSwap(address _strategyAddr, address _rewardTo) external;

    function setSupportedStrategy(address _strategyAddress, bool _isSupported)
        external;

    function rewardTokenConfigs(address _tokenAddress)
        external
        view
        returns (RewardTokenConfig calldata);

    function setRewardTokenConfig(
        address _tokenAddress,
        uint16 _allowedSlippageBps,
        uint16 _harvestRewardBps,
        address _uniswapV2CompatibleAddr,
        uint256 _liquidationLimit,
        bool _doSwapRewardToken
    ) external;
}
