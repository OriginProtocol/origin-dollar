const utils = require("web3-utils");

const KEY_PROXY_ADMIN = utils.keccak256("ProxyAdmin");
const KEY_VAULT = utils.keccak256("Vault");

module.exports = {
  KEY_PROXY_ADMIN,
  KEY_VAULT,
};
