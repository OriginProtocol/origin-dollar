import { Store } from "pullstate"
 
const AccountStore = new Store({
  address: null,
	allowances: null,
	balances: null
})

export default AccountStore
