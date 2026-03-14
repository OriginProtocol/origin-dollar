const addresses = require("./addresses");

const cctpDomainIds = {
  Ethereum: 0,
  Base: 6,
  HyperEVM: 19,
};
const api = "https://iris-api.circle.com";
const configuration = {
  mainnetBaseMorpho: {
    mainnet: {
      cctpDestinationDomainId: cctpDomainIds.Base,
      cctpSourceDomainId: cctpDomainIds.Ethereum,
      cctpIntegrationContractAddress:
        addresses.mainnet.CrossChainMasterStrategy,
      cctpIntegrationContractAddressDestination:
        addresses.base.CrossChainRemoteStrategy,
      blockLookback: 14600, // a bit over 2 days in block time on mainnet
    },
    base: {
      cctpDestinationDomainId: cctpDomainIds.Ethereum,
      cctpSourceDomainId: cctpDomainIds.Base,
      cctpIntegrationContractAddress: addresses.base.CrossChainRemoteStrategy,
      cctpIntegrationContractAddressDestination:
        addresses.mainnet.CrossChainMasterStrategy,
      blockLookback: 87600, // a bit over 2 days in block time on base
    },
  },
  mainnetHyperEVMMorpho: {
    mainnet: {
      cctpDestinationDomainId: cctpDomainIds.HyperEVM,
      cctpSourceDomainId: cctpDomainIds.Ethereum,
      cctpIntegrationContractAddress:
        addresses.mainnet.CrossChainHyperEVMMasterStrategy,
      cctpIntegrationContractAddressDestination:
        addresses.hyperevm.CrossChainRemoteStrategy,
      blockLookback: 14600, // a bit over 2 days in block time on mainnet
    },
    hyperevm: {
      cctpDestinationDomainId: cctpDomainIds.Ethereum,
      cctpSourceDomainId: cctpDomainIds.HyperEVM,
      cctpIntegrationContractAddress: addresses.hyperevm.CrossChainRemoteStrategy,
      cctpIntegrationContractAddressDestination:
        addresses.mainnet.CrossChainHyperEVMMasterStrategy,
      blockLookback: 87600, // a bit over 2 days in block time on HyperEVM (adjust if needed)
    },
  },
};

module.exports = {
  cctpDomainIds,
  api,
  configuration,
};
