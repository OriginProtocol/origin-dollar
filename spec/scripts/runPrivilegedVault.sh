certoraRun contracts/vault/VaultCore.sol \
  --verify VaultCore:../spec/PrivilegedVault.spec \
  --solc solc5.11 \
  --settings -b=1,-assumeUnwindCond,-ignoreViewFunctions \
  --cloud --msg "VaultCore Privileged"
