pragma solidity 0.5.11;

import { OUSD } from "./OUSD.sol";

contract OUSDReset is OUSD {
    /**
     * Reset function to restore initial state.
     * TODO Remove
     */
    function reset() external onlyGovernor {
        _name = "Origin Dollar";
        _symbol = "OUSD";
        _decimals = 18;
        rebasingCreditsPerToken = 1e18;
    }

    function setVaultAddress(address _vaultAddress) external onlyGovernor {
        vaultAddress = _vaultAddress;
    }
}
