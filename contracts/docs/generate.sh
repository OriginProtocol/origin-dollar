
# contracts/buyback
sol2uml .. -v -hv -hf -he -hs -hl -hi -b OUSDBuyback,OETHBuyback -o BuybackHierarchy.svg
sol2uml .. -s -d 0 -b OETHBuyback -o OETHBuybackSquashed.svg
sol2uml storage .. -c OETHBuyback -o OETHBuybackStorage.svg --hideExpand __gap,______gap

# contracts/flipper
sol2uml .. -v -hv -hf -he -hs -hl -b Flipper -o FlipperHierarchy.svg
sol2uml .. -s -d 0 -b Flipper -o FlipperSquashed.svg
sol2uml storage .. -c Flipper -o FlipperStorage.svg

# contracts/harvest
sol2uml .. -v -hv -hf -he -hs -hl -hi -b Dripper -o DripperHierarchy.svg
sol2uml .. -s -d 0 -b Dripper -o DripperSquashed.svg
sol2uml storage .. -c Dripper -o DripperStorage.svg \
    --slotNames OUSD.governor,OUSD.pending.governor,OUSD.reentry.status,0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
    --slotTypes address,address,bool,address

sol2uml .. -v -hv -hf -he -hs -hl -hi -b OETHDripper -o OETHDripperHierarchy.svg
sol2uml .. -s -d 0 -b OETHDripper -o OETHDripperSquashed.svg
sol2uml storage .. -c OETHDripper -o OETHDripperStorage.svg \
    --slotNames OUSD.governor,OUSD.pending.governor,OUSD.reentry.status,0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
    --slotTypes address,address,bool,address

sol2uml .. -v -hv -hf -he -hs -hl -hi -b Harvester -o HarvesterHierarchy.svg
sol2uml .. -s -d 0 -b Harvester -o HarvesterSquashed.svg
sol2uml storage .. -c Harvester -o HarvesterStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -hi -b OETHHarvester -o OETHHarvesterHierarchy.svg
sol2uml .. -s -d 0 -b OETHHarvester -o OETHHarvesterSquashed.svg
sol2uml storage .. -c OETHHarvester -o OETHHarvesterStorage.svg

# contracts/governance
sol2uml .. -v -hv -hf -he -hs -hl -b Governor -o GovernorHierarchy.svg
sol2uml .. -s -d 0 -b Governor -o GovernorSquashed.svg
sol2uml storage .. -c Governor -o GovernorStorage.svg

# contracts/oracles
sol2uml .. -v -hv -hf -he -hs -hl -b OETHOracleRouter -o OETHOracleRouterHierarchy.svg
sol2uml .. -s -d 0 -b OETHOracleRouter -o OETHOracleRouterSquashed.svg
sol2uml storage .. -c OETHOracleRouter -o OETHOracleRouterStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b MixOracle -o MixOracleHierarchy.svg
sol2uml .. -s -d 0 -b MixOracle -o MixOracleSquashed.svg
sol2uml storage .. -c MixOracle -o MixOracleStorage.svg

# contracts/proxies
sol2uml .. -v -hv -hf -he -hs -hl -b OUSDProxy -o OUSDProxyHierarchy.svg
sol2uml .. -s -d 0 -b OUSDProxy -o OUSDProxySquashed.svg
sol2uml storage .. -c OUSDProxy -o OUSDProxyStorage.svg

# contracts/strategies
sol2uml .. -v -hv -hf -he -hs -hl -hi -b AaveStrategy -o AaveStrategyHierarchy.svg
sol2uml .. -s -d 0 -b AaveStrategy -o AaveStrategySquashed.svg
sol2uml storage .. -c AaveStrategy -o AaveStrategyStorage.svg --hideExpand ______gap,_reserved

sol2uml .. -v -hv -hf -he -hs -hl -hi -b CompoundStrategy -o CompStrategyHierarchy.svg
sol2uml .. -s -d 0 -b CompoundStrategy -o CompStrategySquashed.svg
sol2uml storage .. -c CompoundStrategy -o CompStrategyStorage.svg --hideExpand ______gap,_reserved,__reserved

sol2uml .. -v -hv -hf -he -hs -hl -hi -b ConvexTwoPoolStrategy,ConvexThreePoolStrategy,ConvexCryptoStrategy -o ConvexStrategiesHierarchy.svg
sol2uml .. -s -d 0 -b ConvexThreePoolStrategy -o ConvexThreePoolStrategySquashed.svg
sol2uml storage .. -c ConvexThreePoolStrategy -o ConvexThreePoolStrategyStorage.svg --hideExpand ______gap,_reserved,__reserved
sol2uml .. -s -d 0 -b ConvexTwoPoolStrategy -o ConvexTwoPoolStrategySquashed.svg
sol2uml storage .. -c ConvexTwoPoolStrategy -o ConvexTwoPoolStrategyStorage.svg --hideExpand ______gap,_reserved,__reserved
sol2uml .. -s -d 0 -b ConvexCryptoStrategy -o ConvexCryptoStrategySquashed.svg
sol2uml storage .. -c ConvexCryptoStrategy -o ConvexCryptoStrategyStorage.svg --hideExpand ______gap,_reserved,__reserved

sol2uml .. -v -hv -hf -he -hs -hl -hi -b FluxStrategy -o FluxStrategyHierarchy.svg
sol2uml .. -s -d 0 -b FluxStrategy -o FluxStrategySquashed.svg
sol2uml storage .. -c FluxStrategy -o FluxStrategyStorage.svg --hideExpand ______gap,_reserved,__reserved

sol2uml .. -v -hv -hf -he -hs -hl -hi -b FraxETHStrategy -o FraxETHStrategyHierarchy.svg
sol2uml .. -s -d 0 -b FraxETHStrategy -o FraxETHStrategySquashed.svg
sol2uml storage .. -c FraxETHStrategy -o FraxETHStrategyStorage.svg --hideExpand ______gap,__gap,_reserved

sol2uml .. -v -hv -hf -he -hs -hl -hi -b Generalized4626Strategy -o Generalized4626StrategyHierarchy.svg
sol2uml .. -s -d 0 -b Generalized4626Strategy -o Generalized4626StrategySquashed.svg
sol2uml storage .. -c Generalized4626Strategy -o Generalized4626StrategyStorage.svg --hideExpand ______gap,_reserved,__gap

sol2uml .. -v -hv -hf -he -hs -hl -hi -b MorphoAaveStrategy -o MorphoAaveStrategyHierarchy.svg
sol2uml .. -s -d 0 -b MorphoAaveStrategy -o MorphoAaveStrategySquashed.svg
sol2uml storage .. -c MorphoAaveStrategy -o MorphoAaveStrategyStorage.svg --hideExpand ______gap,_reserved

sol2uml .. -v -hv -hf -he -hs -hl -hi -b MorphoCompoundStrategy -o MorphoCompStrategyHierarchy.svg
sol2uml .. -s -d 0 -b MorphoCompoundStrategy -o MorphoCompStrategySquashed.svg
sol2uml storage .. -c MorphoCompoundStrategy -o MorphoCompStrategyStorage.svg --hideExpand ______gap,_reserved,__reserved

# contracts/strategies/amo

## AMO contracts
sol2uml .. -v -hv -hf -he -hs -hl -hi -b ConvexEthMetaStrategy,ConvexFrxETHAMOStrategy,ConvexOUSDMetaStrategy,BalancerEthAMOStrategy -o AMOContractHierarchy.svg

sol2uml .. -v -hv -hf -he -hs -hl -hi -b ConvexEthMetaStrategy -o ConvexEthMetaStrategyHierarchy.svg
sol2uml .. -s -d 0 -b ConvexEthMetaStrategy -o ConvexEthMetaStrategySquashed.svg
sol2uml storage .. -c ConvexEthMetaStrategy -o ConvexEthMetaStrategyStorage.svg  \
    --hideExpand ______gap,_reserved \
    --slotNames OUSD.governor,OUSD.pending.governor,OUSD.reentry.status,0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
    --slotTypes address,address,bool,address

sol2uml .. -v -hv -hf -he -hs -hl -hi -b ConvexFrxETHAMOStrategy -o ConvexFrxETHAMOStrategyHierarchy.svg
sol2uml .. -s -d 0 -b ConvexFrxETHAMOStrategy -o ConvexFrxETHAMOStrategySquashed.svg
sol2uml storage .. -c ConvexFrxETHAMOStrategy -o ConvexFrxETHAMOStrategyStorage.svg  \
    --hideExpand ______gap,_reserved \
    --slotNames OUSD.governor,OUSD.pending.governor,OUSD.reentry.status,0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
    --slotTypes address,address,bool,address

sol2uml .. -v -hv -hf -he -hs -hl -hi -b ConvexOUSDMetaStrategy -o ConvexOUSDMetaStrategyHierarchy.svg
sol2uml .. -s -d 0 -b ConvexOUSDMetaStrategy -o ConvexOUSDMetaStrategySquashed.svg
sol2uml storage .. -c ConvexOUSDMetaStrategy -o ConvexOUSDMetaStrategyStorage.svg  \
    --hideExpand ______gap,_reserved \
    --slotNames OUSD.governor,OUSD.pending.governor,OUSD.reentry.status,0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
    --slotTypes address,address,bool,address

sol2uml .. -v -hv -hf -he -hs -hl -hi -b BalancerEthAMOStrategy -o BalancerEthAMOStrategyHierarchy.svg
sol2uml .. -s -d 0 -b BalancerEthAMOStrategy -o BalancerEthAMOStrategySquashed.svg
sol2uml storage .. -c BalancerEthAMOStrategy -o BalancerEthAMOStrategyStorage.svg  \
    --hideExpand ______gap,_reserved \
    --slotNames OUSD.governor,OUSD.pending.governor,OUSD.reentry.status,0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
    --slotTypes address,address,bool,address

# contracts/strategies/balancer
sol2uml .. -v -hv -hf -he -hs -hl -hi -b BalancerMetaPoolStrategy -o BalancerMetaPoolStrategyHierarchy.svg
sol2uml .. -s -d 0 -b BalancerMetaPoolStrategy -o BalancerMetaPoolStrategySquashed.svg
sol2uml storage .. -c BalancerMetaPoolStrategy -o BalancerMetaPoolStrategyStorage.svg --hideExpand ______gap,_reserved,__reserved,__reserved_baseAuraStrategy

# contracts/strategies/curve
sol2uml .. -hl -b CurveTwoCoinFunctions -o CurveTwoCoinFunctions.svg
sol2uml .. -hl -b CurveThreeCoinFunctions -o CurveThreeCoinFunctions.svg

# contracts/swapper
sol2uml .. -v -hv -hf -he -hs -hl -b Swapper1InchV5 -o Swapper1InchV5Hierarchy.svg
sol2uml .. -s -d 0 -b Swapper1InchV5 -o Swapper1InchV5Squashed.svg
sol2uml storage .. -c Swapper1InchV5 -o Swapper1InchV5Storage.svg

# contracts/timelock
sol2uml .. -v -hv -hf -he -hs -hl -b Timelock -o TimelockHierarchy.svg
sol2uml .. -s -d 0 -b Timelock -o TimelockSquashed.svg
sol2uml storage .. -c Timelock -o TimelockStorage.svg

# contracts/token
sol2uml .. -v -hv -hf -he -hs -hl -b OUSD -o OUSDHierarchy.svg
sol2uml .. -s -d 0 -b OUSD -o OUSDSquashed.svg
sol2uml storage .. -c OUSD -o OUSDStorage.svg --hideExpand _____gap,______gap

sol2uml .. -v -hv -hf -he -hs -hl -b WrappedOusd -o WOUSDHierarchy.svg
sol2uml .. -s -d 0 -b WrappedOusd -o WOUSDSquashed.svg
sol2uml storage .. -c WrappedOusd -o WOUSDStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b OETH -o OETHHierarchy.svg
sol2uml .. -s -d 0 -b OETH -o OETHSquashed.svg
sol2uml storage .. -c OETH -o OETHStorage.svg --hideExpand _____gap,______gap

sol2uml .. -v -hv -hf -he -hs -hl -b WOETH -o WOETHHierarchy.svg
sol2uml .. -s -d 0 -b WOETH -o WOETHSquashed.svg
sol2uml storage .. -c WOETH -o WOETHStorage.svg

# contracts/vault
sol2uml .. -v -hv -hf -he -hs -hl -hi -b VaultCore,VaultAdmin -o VaultHierarchy.svg
sol2uml .. -s -d 0 -b VaultCore -o VaultCoreSquashed.svg
sol2uml .. -s -d 0 -b VaultAdmin -o VaultAdminSquashed.svg
sol2uml storage .. -c VaultCore -o VaultStorage.svg \
    --hideExpand ______gap,_deprecated_swapTokens \
    --slotNames OUSD.governor,OUSD.pending.governor,OUSD.reentry.status,OUSD.vault.governor.admin.impl,0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
    --slotTypes address,address,bool,address,address

sol2uml .. -v -hv -hf -he -hs -hl -hi -b OETHVaultCore,OETHVaultAdmin -o OETHVaultHierarchy.svg
sol2uml .. -s -d 0 -b OETHVaultCore -o OETHVaultCoreSquashed.svg
sol2uml .. -s -d 0 -b OETHVaultAdmin -o OETHVaultAdminSquashed.svg
sol2uml storage .. -c OETHVaultCore -o OETHVaultStorage.svg \
    --hideExpand ______gap,_deprecated_swapTokens \
    --slotNames OUSD.governor,OUSD.pending.governor,OUSD.reentry.status,OUSD.vault.governor.admin.impl,0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc \
    --slotTypes address,address,bool,address,address

# contracts/utils
sol2uml .. -v -hv -hf -he -hs -hl -b InitializableAbstractStrategy -o InitializableAbstractStrategyHierarchy.svg
sol2uml .. -s -d 0 -b InitializableAbstractStrategy -o InitializableAbstractStrategySquashed.svg
sol2uml storage .. -c InitializableAbstractStrategy -o InitializableAbstractStrategyStorage.svg \
    --hideExpand ______gap,_reserved \
    --slotNames OUSD.governor,OUSD.pending.governor,OUSD.reentry.status \
    --slotTypes address,address,bool

sol2uml .. -v -hv -hf -he -hs -hl -b InitializableERC20Detailed -o InitializableERC20DetailedHierarchy.svg
sol2uml .. -s -d 0 -b InitializableERC20Detailed -o InitializableERC20DetailedSquashed.svg
sol2uml storage .. -c InitializableERC20Detailed -o InitializableERC20DetailedStorage.svg \
    --hideExpand _____gap

sol2uml .. -v -hv -hf -b StableMath -o StableMathHierarchy.svg
sol2uml .. -s -d 0 -b StableMath -o StableMathSquashed.svg
