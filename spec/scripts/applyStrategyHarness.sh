perl -0777 -i -pe 's'/\
'address\[\] internal assetsMapped;/'\
'address\[\] internal assetsMapped;\n'\
'\tfunction lengthOfPlatformTokensList\(\) external returns \(uint\) \{ return assetsMapped.length; \}\n'\
'\tfunction underlyingBalance\(address asset\) external returns \(uint\) \{ return IERC20(asset).balanceOf(address(this)); \}\n'\
'\tfunction init_state\(\) external \{\}/g' \
contracts/utils/InitializableAbstractStrategy.sol