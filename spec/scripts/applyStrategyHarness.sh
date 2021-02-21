perl -0777 -i -pe 's'/\
'address\[\] internal assetsMapped;/'\
'address\[\] internal assetsMapped;'\
' function lengthOfPlatformTokensList\(\) external returns \(uint\) \{ return assetsMapped.length; \}'\
' function init_state\(\) external \{\}/g' \
contracts/utils/InitializableAbstractStrategy.sol