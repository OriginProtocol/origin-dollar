contract OUSDReset is OUSD {
    /**
     * Reset function to restore initial state.
     * TODO Remove
     */
    function reset() external onlyGovernor {
       _totalSupply = 0;
       rebasingCredits = 0;
       rebasingCreditsPerToken = 1e18;
       nonRebasingSupply = 0;
       // No longer used, but reset it anyway to avoid any potential confusion
       _deprecated_nonRebasingCredits = 0;
    }
}
