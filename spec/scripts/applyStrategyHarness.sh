perl -0777 -i -pe 's'/\
'address\[\] internal assetsMapped;/'\
'address\[\] internal assetsMapped;'\
' function lengthOfPlatformTokensList\(\) external returns \(uint\) \{ return assetsMapped.length; \}'\
' function isListedAsPlatformToken\(address asset, uint index\) external returns \(bool\) \{ return index < assetsMapped.length && 0 <= index && assetsMapped\[index\] == asset; \}/g' \
contracts/utils/InitializableAbstractStrategy.sol