certoraRun contracts/vault/VaultCore.sol \
  --verify VaultCore:../spec/sanity.spec \
  --solc solc5.11 \
  --settings -b=2,-assumeUnwindCond \
  --cloud --msg "VaultCore Sanity"