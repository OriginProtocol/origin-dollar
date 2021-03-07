perl -0777 -i -pe 's'/\
'address\[\] internal assetsMapped;/'\
'address\[\] internal assetsMapped;\n'\
'\tfunction lengthOfPlatformTokensList\(\) external view returns \(uint\) \{ return assetsMapped.length; \}\n'\
'\tfunction underlyingBalance\(address asset\) external view returns \(uint\) \{ return IERC20(asset).balanceOf(address(this)); \}\n'\
'\tfunction underlyingBalanceOf\(address asset, address who\) external view returns \(uint\) \{ return IERC20(asset).balanceOf(who); \}\n'\
'\tfunction init_state\(\) external view \{\}/g' \
contracts/utils/InitializableAbstractStrategy.sol