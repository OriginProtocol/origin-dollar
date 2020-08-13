import { Store } from "pullstate"
 
const AccountStore = new Store({
	/*
		account : {
			address: '0x123...456',
			allowences: {...},
			balances: {...}
		}
	 */
  account: null,
})

export default AccountStore
