const addresses = require("./addresses");

const cctpDomainIds = {
  Ethereum: 0,
  Base: 6,
};
const api = "https://iris-api.circle.com";
const configuration = {
  mainnetBaseMorpho:{
    mainnet: {
      cctpDestinationDomainId: cctpDomainIds.Base,
      cctpSourceDomainId: cctpDomainIds.Ethereum,
      cctpIntegrationContractAddress: addresses.mainnet.CrossChainMasterStrategy,
      cctpIntegrationContractAddressDestination: addresses.base.CrossChainRemoteStrategy,
      blockLookback: 14600, // a bit over 2 days in block time on mainnet
    },
    base: {
      cctpDestinationDomainId: cctpDomainIds.Ethereum,
      cctpSourceDomainId: cctpDomainIds.Base,
      cctpIntegrationContractAddress: addresses.base.CrossChainRemoteStrategy,
      cctpIntegrationContractAddressDestination: addresses.mainnet.CrossChainMasterStrategy,
      blockLookback: 87600, // a bit over 2 days in block time on base
    }
  }
} 

module.exports = {
  cctpDomainIds,
  api,
  configuration,
};
