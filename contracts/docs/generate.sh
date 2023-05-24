

# contracts/flipper
sol2uml .. -v -hv -hf -he -hs -hl -b Flipper -o FlipperHierarchy.svg
sol2uml .. -s -d 0 -b Flipper -o FlipperSquashed.svg
sol2uml storage .. -c Flipper -o FlipperStorage.svg

# contracts/harvest
sol2uml .. -v -hv -hf -he -hs -hl -b Dripper -o DripperHierarchy.svg
sol2uml .. -s -d 0 -b Dripper -o DripperSquashed.svg
sol2uml storage .. -c Dripper -o DripperStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b OETHDripper -o OETHDripperHierarchy.svg
sol2uml .. -s -d 0 -b OETHDripper -o OETHDripperSquashed.svg
sol2uml storage .. -c OETHDripper -o OETHDripperStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b Harvester -o HarvesterHierarchy.svg
sol2uml .. -s -d 0 -b Harvester -o HarvesterSquashed.svg
sol2uml storage .. -c Harvester -o HarvesterStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b OETHHarvester -o OETHHarvesterHierarchy.svg
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
sol2uml .. -v -hv -hf -he -hs -hl -b AaveStrategy -o AaveStrategyHierarchy.svg
sol2uml .. -s -d 0 -b AaveStrategy -o AaveStrategySquashed.svg
sol2uml storage .. -c AaveStrategy -o AaveStrategyStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b CompoundStrategy -o CompStrategyHierarchy.svg
sol2uml .. -s -d 0 -b CompoundStrategy -o CompStrategySquashed.svg
sol2uml storage .. -c CompoundStrategy -o CompStrategyStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b ConvexEthMetaStrategy -o ConvexEthMetaStrategyHierarchy.svg
sol2uml .. -s -d 0 -b ConvexEthMetaStrategy -o ConvexEthMetaStrategySquashed.svg
sol2uml storage .. -c ConvexEthMetaStrategy -o ConvexEthMetaStrategyStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b Generalized4626Strategy -o Gen4626StrategyHierarchy.svg
sol2uml .. -s -d 0 -b Generalized4626Strategy -o Gen4626StrategySquashed.svg
## TODO fix sol2uml "Failed to find user defined type "IERC20" in attribute "shareToken" of type "1"""
sol2uml storage .. -c Generalized4626Strategy -o Gen4626StrategyStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b MorphoAaveStrategy -o MorphoAaveStrategyHierarchy.svg
sol2uml .. -s -d 0 -b MorphoAaveStrategy -o MorphoAaveStrategySquashed.svg
sol2uml storage .. -c MorphoAaveStrategy -o MorphoAaveStrategyStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b MorphoCompoundStrategy -o MorphoCompStrategyHierarchy.svg
sol2uml .. -s -d 0 -b MorphoCompoundStrategy -o MorphoCompStrategySquashed.svg
sol2uml storage .. -c MorphoCompoundStrategy -o MorphoCompStrategyStorage.svg

# contracts/timelock
sol2uml .. -v -hv -hf -he -hs -hl -b Timelock -o TimelockHierarchy.svg
sol2uml .. -s -d 0 -b Timelock -o TimelockSquashed.svg
sol2uml storage .. -c Timelock -o TimelockStorage.svg

# contracts/token
sol2uml .. -v -hv -hf -he -hs -hl -b OUSD -o OUSDHierarchy.svg
sol2uml .. -s -d 0 -b OUSD -o OUSDSquashed.svg
sol2uml storage .. -c OUSD -o OUSDStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b WrappedOusd -o WOUSDHierarchy.svg
sol2uml .. -s -d 0 -b WrappedOusd -o WOUSDSquashed.svg
sol2uml storage .. -c WrappedOusd -o WOUSDStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b OETH -o OETHHierarchy.svg
sol2uml .. -s -d 0 -b OETH -o OETHSquashed.svg
sol2uml storage .. -c OETH -o OETHStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b WOETH -o WOETHHierarchy.svg
sol2uml .. -s -d 0 -b WOETH -o WOETHSquashed.svg
sol2uml storage .. -c WOETH -o WOETHStorage.svg

# contracts/vault
sol2uml .. -v -hv -hf -he -hs -hl -b VaultCore -o VaultHierarchy.svg
sol2uml .. -s -d 0 -b VaultCore -o VaultSquashed.svg
sol2uml storage .. -c VaultCore -o VaultStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b OETHVaultCore -o OETHVaultHierarchy.svg
sol2uml .. -s -d 0 -b OETHVaultCore -o OETHVaultSquashed.svg
sol2uml storage .. -c OETHVaultCore -o OETHVaultStorage.svg
