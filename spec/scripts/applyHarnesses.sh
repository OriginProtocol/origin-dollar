perl -0777 -i -pe 's/uint256 private constant MAX_SUPPLY/uint256 internal constant MAX_SUPPLY/igs' contracts/token/OUSD.sol
perl -0777 -i -pe 's/InitializableERC20Detailed._initialize/\/\/InitializableERC20Detailed._initialize/igs' contracts/token/OUSD.sol
# perl -0777 -i -pe 's/_creditsPerToken\(address _account\)/_creditsPerToken\(address _account\) virtual/igs' contracts/token/OUSD.sol # only for solc6...
# Assume that non rebasing credits per token is <= 1e18
perl -0777 -i -pe 's/return nonRebasingCreditsPerToken\[_account\];/require \(nonRebasingCreditsPerToken\[_account\] <= 1e18\); return nonRebasingCreditsPerToken\[_account\];/igs' contracts/token/OUSD.sol