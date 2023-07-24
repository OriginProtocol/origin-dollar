export const connectorNameIconMap = {
  MetaMask: 'metamask-icon.svg',
  Ledger: 'ledger-icon.svg',
  Exodus: 'exodus-icon.svg',
  MyEtherWallet: 'myetherwallet-icon.svg',
  WalletConnect: 'walletconnect-icon.svg',
  'Wallet Connect V2': 'walletconnect-icon.svg',
}

export const getConnectorIcon = (name) =>
  connectorNameIconMap?.[name] || 'default-wallet-icon.svg'
