/**
 * A separate file for small utils other files can use. The purpose of this being separate is also to not mess up the
 * dependency graph too much, since there is a source file limit of 5MB on Defender actions
 */
const checkPubkeyFormat = (pubkey) => {
  if (!pubkey.startsWith("0x")) {
    pubkey = `0x${pubkey}`;
  }
  return pubkey;
};

module.exports = {
  checkPubkeyFormat,
};
