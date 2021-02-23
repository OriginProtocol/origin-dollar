perl -0777 -i -pe 's/uint256 private constant MAX_SUPPLY/uint256 internal constant MAX_SUPPLY/igs' contracts/token/OUSD.sol
perl -0777 -i -pe 's/InitializableERC20Detailed._initialize/\/\/InitializableERC20Detailed._initialize/igs' contracts/token/OUSD.sol
# perl -0777 -i -pe 's/_creditsPerToken\(address _account\)/_creditsPerToken\(address _account\) virtual/igs' contracts/token/OUSD.sol # only for solc6...
# Assume that non rebasing credits per token is <= 1e18
perl -0777 -i -pe 's/return nonRebasingCreditsPerToken\[_account\];/require \(nonRebasingCreditsPerToken\[_account\] <= 1e18\); return nonRebasingCreditsPerToken\[_account\];/igs' contracts/token/OUSD.sol
# make crvMinterAddress public
perl -0777 -i -pe 's/address crvMinterAddress/address public crvMinterAddress/g' contracts/strategies/ThreePoolStrategy.sol
# VaultCore to be big and include VaultAdmin too
perl -0777 -i -pe 's/contract VaultCore is VaultStorage/contract VaultCore is Vault/g' contracts/vault/VaultCore.sol
# update import for updated VaultCore
perl -0777 -i -pe 's/import ".\/VaultStorage.sol"/import ".\/VaultStorage.sol"; import ".\/Vault.sol";/g' contracts/vault/VaultCore.sol
# avoid recursion
perl -0777 -i -pe 's/function checkBalance\(/function checkBalance_ext\(/g' contracts/vault/VaultCore.sol