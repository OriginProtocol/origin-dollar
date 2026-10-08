// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IMorphoV2Adapter } from "../interfaces/morpho/IMorphoV2Adapter.sol";

contract MockMorphoV1VaultLiquidityAdapter is IMorphoV2Adapter {
    address public mockMorphoVault;

    function setMockMorphoVault(address _mockMorphoVault) external {
        mockMorphoVault = _mockMorphoVault;
    }

    function morphoVaultV1() external view override returns (address) {
        return mockMorphoVault;
    }

    function parentVault() external view override returns (address) {
        return mockMorphoVault;
    }
}
