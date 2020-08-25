import { Store } from "pullstate";
 
export const AccountStore = new Store({
  allowances: {},
  balances: {},
  establishingConnection: true,
  showLoginModal: false
})
