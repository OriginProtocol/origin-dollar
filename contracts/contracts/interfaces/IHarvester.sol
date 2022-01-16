// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

interface IHarvester {
    // Governable.sol
    function transferGovernance(address _newGovernor) external;

    function claimGovernance() external;

    function governor() external view returns (address);

    // Harvester.sol
    function addSwapToken(address _addr) external;

    function removeSwapToken(address _addr) external;

    function harvest() external;

    function harvest(address _strategyAddr) external;

    function swap() external;

    function harvestAndSwap() external;

    function harvestAndSwap(address _strategyAddr) external;

    function addRewardTokenConfig(
        address _tokenAddress,
        uint32 _allowedSlippageBps,
        uint32 _harvestRewardBps,
        address _uniswapV2CompatibleAddr,
        uint256 _liquidationLimit
    ) external;
}
