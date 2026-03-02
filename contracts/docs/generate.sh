# contracts/harvest
sol2uml .. -v -hv -hf -he -hs -hl -hi -b Dripper -o DripperHierarchy.svg
sol2uml .. -s -d 0 -b Dripper -o DripperSquashed.svg
sol2uml storage .. -c Dripper -o DripperStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -hi -b OETHFixedRateDripper -o OETHFixedRateDripperHierarchy.svg
sol2uml .. -s -d 0 -b OETHFixedRateDripper -o OETHFixedRateDripperSquashed.svg
sol2uml storage .. -c OETHFixedRateDripper -o OETHFixedRateDripperStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -hi -b OETHHarvesterSimple -o OETHHarvesterSimpleHierarchy.svg
sol2uml .. -s -d 0 -b OETHHarvesterSimple -o OETHHarvesterSimpleSquashed.svg
sol2uml storage .. -c OETHHarvesterSimple -o OETHHarvesterSimpleStorage.svg --hideExpand __gap,___gap,______gap

sol2uml .. -v -hv -hf -he -hs -hl -hi -b OSonicHarvester -o OSonicHarvesterHierarchy.svg
sol2uml .. -s -d 0 -b OSonicHarvester -o OSonicHarvesterSquashed.svg
sol2uml storage .. -c OSonicHarvester -o OSonicHarvesterStorage.svg --hideExpand __gap,___gap,______gap

# contracts/governance
sol2uml .. -v -hv -hf -he -hs -hl -b Governor -o GovernorHierarchy.svg
sol2uml .. -s -d 0 -b Governor -o GovernorSquashed.svg
sol2uml storage .. -c Governor -o GovernorStorage.svg

# contracts/oracles
sol2uml .. -v -hv -hf -he -hs -hl -b OETHOracleRouter -o OETHOracleRouterHierarchy.svg
sol2uml .. -s -d 0 -b OETHOracleRouter -o OETHOracleRouterSquashed.svg
sol2uml storage .. -c OETHOracleRouter -o OETHOracleRouterStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b OracleRouter -o OracleRouterHierarchy.svg
sol2uml .. -s -d 0 -b OracleRouter -o OracleRouterSquashed.svg
sol2uml storage .. -c OracleRouter -o OracleRouterStorage.svg

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

sol2uml .. -v -hv -hf -he -hs -hl -hi -b BridgedWOETHStrategy -o BridgedWOETHStrategyHierarchy.svg
sol2uml .. -s -d 0 -b BridgedWOETHStrategy -o BridgedWOETHStrategySquashed.svg
sol2uml storage .. -c BridgedWOETHStrategy -o BridgedWOETHStrategyStorage.svg --hideExpand ______gap,_reserved,__reserved

sol2uml .. -v -hv -hf -he -hs -hl -hi -b Generalized4626Strategy -o Generalized4626StrategyHierarchy.svg
sol2uml .. -s -d 0 -b Generalized4626Strategy -o Generalized4626StrategySquashed.svg
sol2uml storage .. -c Generalized4626Strategy -o Generalized4626StrategyStorage.svg --hideExpand ______gap,_reserved,__gap

sol2uml .. -v -hv -hf -he -hs -hl -hi -b NativeStakingSSVStrategy -o NativeStakingSSVStrategyHierarchy.svg
sol2uml .. -s -d 0 -b NativeStakingSSVStrategy -o NativeStakingSSVStrategySquashed.svg
sol2uml storage .. -c NativeStakingSSVStrategy -o NativeStakingSSVStrategyStorage.svg --hideExpand __gap,______gap,_reserved
sol2uml .. -v -hv -hf -he -hs -hl -hi -b FeeAccumulator -o FeeAccumulatorHierarchy.svg
sol2uml .. -s -d 0 -b FeeAccumulator -o FeeAccumulatorSquashed.svg

sol2uml .. -v -hv -hf -he -hs -hl -hi -i prettier-plugin-solidity -b CurveAMOStrategy -o CurveAMOStrategyHierarchy.svg
sol2uml .. -s -d 0 -b CurveAMOStrategy -i prettier-plugin-solidity -o CurveAMOStrategySquashed.svg
sol2uml storage .. -c CurveAMOStrategy -i prettier-plugin-solidity -o CurveAMOStrategyStorage.svg --hideExpand ______gap,_reserved,__gap

sol2uml .. -v -hv -hf -he -hs -hl -hi -i prettier-plugin-solidity -b BaseCurveAMOStrategy -o BaseCurveAMOStrategyHierarchy.svg
sol2uml .. -s -d 0 -b BaseCurveAMOStrategy -i prettier-plugin-solidity -o BaseCurveAMOStrategySquashed.svg
sol2uml storage .. -c BaseCurveAMOStrategy -i prettier-plugin-solidity -o BaseCurveAMOStrategyStorage.svg --hideExpand ______gap,_reserved,__gap

# contracts/strategies/sonic
sol2uml .. -v -hv -hf -he -hs -hl -hi -b SonicStakingStrategy -o SonicStakingStrategyHierarchy.svg
sol2uml .. -s -d 0 -b SonicStakingStrategy -o SonicStakingStrategySquashed.svg
sol2uml storage .. -c SonicStakingStrategy -o SonicStakingStrategyStorage.svg --hideExpand __gap,______gap,_reserved

sol2uml .. -v -hv -hf -he -hs -hl -hi -b SonicSwapXAMOStrategy -o SonicSwapXAMOStrategyHierarchy.svg
sol2uml .. -s -d 0 -b SonicSwapXAMOStrategy -o SonicSwapXAMOStrategySquashed.svg
sol2uml storage .. -c SonicSwapXAMOStrategy -o SonicSwapXAMOStrategyStorage.svg --hideExpand __gap,______gap,_reserved

# contracts/token
sol2uml .. -v -hv -hf -he -hs -hl -hi  -b OUSD -o OUSDHierarchy.svg
sol2uml .. -s -d 0 -b OUSD -o OUSDSquashed.svg
sol2uml storage .. -c OUSD -o OUSDStorage.svg --hideExpand _gap,__gap

sol2uml .. -v -hv -hf -he -hs -hl -hi  -b WrappedOusd -o WOUSDHierarchy.svg
sol2uml .. -s -d 0 -b WrappedOusd -o WOUSDSquashed.svg
sol2uml storage .. -c WrappedOusd -o WOUSDStorage.svg --hideExpand ______gap

sol2uml .. -v -hv -hf -he -hs -hl -b OETH -o OETHHierarchy.svg
sol2uml .. -s -d 0 -b OETH -o OETHSquashed.svg
sol2uml storage .. -c OETH -o OETHStorage.svg --hideExpand _gap,__gap

sol2uml .. -v -hv -hf -he -hs -hl -hi  -b WOETH -o WOETHHierarchy.svg
sol2uml .. -s -d 0 -b WOETH -o WOETHSquashed.svg
sol2uml storage .. -c WOETH -o WOETHStorage.svg --hideExpand ______gap

# Base tokens
sol2uml .. -v -hv -hf -he -hs -hl -hi -i prettier-plugin-solidity -b OETHBase -o OETHBaseHierarchy.svg
sol2uml .. -s -d 0 -b OETHBase -i prettier-plugin-solidity -o OETHBaseSquashed.svg
sol2uml storage .. -c OETHBase -i prettier-plugin-solidity -o OETHBaseStorage.svg --hideExpand  _gap,__gap

sol2uml .. -v -hv -hf -he -hs -hl -hi -b WOETHBase -o WOETHBaseHierarchy.svg
sol2uml .. -s -d 0 -b WOETHBase -o WOETHBaseSquashed.svg
sol2uml storage .. -c WOETHBase -o WOETHBaseStorage.svg --hideExpand  ______gap

# Sonic tokens
sol2uml .. -v -hv -hf -he -hs -hl -hi -b OSonic -o OSonicHierarchy.svg
sol2uml .. -s -d 0 -b OSonic -o OSonicSquashed.svg
sol2uml storage .. -c OSonic -o OSonicStorage.svg --hideExpand _gap,__gap

sol2uml .. -v -hv -hf -he -hs -hl -hi -b WOSonic -o WOSonicHierarchy.svg
sol2uml .. -s -d 0 -b WOSonic -o WOSonicSquashed.svg
sol2uml storage .. -c WOSonic -o WOSonicStorage.svg --hideExpand  ______gap

# contracts/vault

sol2uml .. -v -hv -hf -he -hs -hl -hi -i prettier-plugin-solidity -b OUSDVault,OETHVault,OETHBaseVault,OSVault -o VaultHierarchy.svg

sol2uml .. -s -d 0 -i prettier-plugin-solidity -b OUSDVault -o VaultSquashed.svg -v
sol2uml storage .. -i prettier-plugin-solidity -c OUSDVault -o VaultStorage.svg --hideExpand __gap,______gap,_deprecated_swapTokens -v

# sol2uml .. -s -d 0 -i prettier-plugin-solidity -b OETHVault -o OETHVaultSquashed.svg
# sol2uml storage .. -i prettier-plugin-solidity -c OETHVault -o OETHVaultStorage.svg --hideExpand __gap,______gap,_deprecated_swapTokens

# sol2uml .. -s -d 0 -i prettier-plugin-solidity -b OETHBaseVault -o OETHBaseVaultSquashed.svg
# sol2uml storage .. -i prettier-plugin-solidity -c OETHBaseVault -o OETHBaseVaultStorage.svg --hideExpand __gap,______gap

# sol2uml .. -s -d 0 -i prettier-plugin-solidity -b OSVault -o OSVaultSquashed.svg
# sol2uml storage .. -i prettier-plugin-solidity -c OSVault -o OSVaultStorage.svg --hideExpand __gap,______gap,_deprecated_swapTokens

# contracts/poolBooster
sol2uml .. -v -hv -hf -he -hs -hl `-i prettier-plugin-solidity` -b PoolBoosterFactorySwapxSingle -o PoolBoosterFactorySwapxSingleHierarchy.svg
sol2uml .. -s -d 0 -i prettier-plugin-solidity -b PoolBoosterFactorySwapxSingle -o PoolBoosterFactorySwapxSingleSquashed.svg
sol2uml storage .. -i prettier-plugin-solidity -c PoolBoosterFactorySwapxSingle -o PoolBoosterFactorySwapxSingleStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -i prettier-plugin-solidity -b PoolBoosterFactorySwapxDouble -o PoolBoosterFactorySwapxDoubleHierarchy.svg
sol2uml .. -s -d 0 -i prettier-plugin-solidity -b PoolBoosterFactorySwapxDouble -o PoolBoosterFactorySwapxDoubleSquashed.svg
sol2uml storage .. -i prettier-plugin-solidity -c PoolBoosterFactorySwapxDouble -o PoolBoosterFactorySwapxDoubleStorage.svg

# contracts/utils
sol2uml .. -v -hv -hf -he -hs -hl -b InitializableAbstractStrategy -o InitializableAbstractStrategyHierarchy.svg
sol2uml .. -s -d 0 -b InitializableAbstractStrategy -o InitializableAbstractStrategySquashed.svg
sol2uml storage .. -c InitializableAbstractStrategy -o InitializableAbstractStrategyStorage.svg

sol2uml .. -v -hv -hf -he -hs -hl -b InitializableERC20Detailed -o InitializableERC20DetailedHierarchy.svg
sol2uml .. -s -d 0 -b InitializableERC20Detailed -o InitializableERC20DetailedSquashed.svg
sol2uml storage .. -c InitializableERC20Detailed -o InitializableERC20DetailedStorage.svg

sol2uml .. -v -hv -hf -b StableMath -o StableMathHierarchy.svg
sol2uml .. -s -d 0 -b StableMath -o StableMathSquashed.svg
