import { writable } from "svelte/store";
import ethers from "ethers";
import network from "../../dapp/network.json";
import _ from "underscore";
import { CONTRACTS, PEOPLE, SETUP, SCENARIOS } from "./world";

const RPC_URL = "http://127.0.0.1:8545/";

export const scenarios = SCENARIOS;

class Account {
  constructor({ name, icon }) {
    this.name = name;
    this.icon = icon;
    this.address = "";
    // Holdings is {OGN: writeable(0)}
    this.holdings = _.object(
      CONTRACTS.filter((x) => x.isERC20).map((x) => [x.name, writable(0)])
    );
  }
}

class User extends Account {
  constructor({ name, icon }) {
    super({ name, icon });
  }
}

class Contract extends Account {
  constructor({ name, icon, actions, contractName, decimal }) {
    super({ name, icon });
    this.actions = actions;
    this.contractName = contractName || this.name;
    this.decimal = decimal;
    this.transactions = writable([]);
  }
}

class ERC20 extends Contract {
  constructor({ name, icon, actions, contractName, decimal }) {
    super({ name, icon, actions, contractName, decimal });
    this.isERC20 = true;
  }
}

// Setup people

const PEOPLE_OBJECTS = _.map(PEOPLE, (x) => new User(x));
const PEOPLE_BY_NAME = _.object(_.map(PEOPLE_OBJECTS, (x) => [x.name, x]));
const CONTRACT_OBJECTS = _.map(CONTRACTS, (x) =>
  x.isERC20 ? new ERC20(x) : new Contract(x)
);
const CONTRACT_BY_NAME = _.object(_.map(CONTRACT_OBJECTS, (x) => [x.name, x]));

export let people = writable(PEOPLE_OBJECTS);
export let contracts = writable(CONTRACT_OBJECTS);

export let activePopupMenu = writable();
export let activePerson = writable();

function updateAll() {
  people.update((old) => old);
  contracts.update((old) => old);
}

export let blockRun = function () {};

export async function handleTx(contract, person, action, args) {
  console.log("H>", contract.name, person.name, action.name, args);
  await blockRun([person.name, contract.name, action.name, ...args]);
  await updateAllHoldings();
}

export let mattHolding = writable(0);
window.mattHolding = mattHolding;

// Ether stuff
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
(async function () {
  const accounts = await provider.listAccounts();
  const signer = await provider.getSigner(accounts[2]);
  const chainContracts = {};
  for (const key in network.contracts) {
    const proxy = network.contracts[key + "Proxy"];
    console.log(key, proxy);
    chainContracts[key] = new ethers.Contract(
      (proxy ? proxy : network.contracts[key]).address,
      network.contracts[key].abi,
      signer
    );
    console.log(key, chainContracts[key].address);
  }
  window.chainContracts = chainContracts;

  blockRun = async function (params) {
    console.log("ℨ", params);
    const user = PEOPLE_BY_NAME[params[0]];
    if (user == undefined) {
      console.error(`Run could not lookup user ${params[0]}`);
    }
    if (user.signer == undefined) {
      console.error(`Run could not find signer for user ${params[0]}`);
    }
    const contract = CONTRACT_BY_NAME[params[1]];
    if (contract == undefined) {
      console.error(`Run could not lookup contract ${params[1]}`);
    }
    if (contract.contract == undefined) {
      console.error(`Run could not find backing contract for ${params[1]}`);
    }
    const method = params[2][0].toLowerCase() + params[2].slice(1);
    const args = params.slice(3);
    for (const i in args) {
      const v = args[i];
      const amountTokens = /^([0-9.]+)([A-Z]+)$/.exec(v);
      if (amountTokens) {
        const amount = amountTokens[1];
        const token = amountTokens[2].toUpperCase();
        console.log(CONTRACT_BY_NAME[token]);
        const decimals = CONTRACT_BY_NAME[token].decimal;
        if (decimals == undefined) {
          console.error(`Decimals are undefined for ${token}`);
        }
        args[i] = ethers.utils.parseUnits(amount, decimals);
        continue;
      }
      if (v.startsWith('"')) {
        args[i] = JSON.parse(v);
      }
      if (/^[A-Za-z]+$/.exec(v)) {
        if (PEOPLE_BY_NAME[v]) {
          args[i] = await PEOPLE_BY_NAME[v].signer.getAddress();
          continue;
        }
        if (CONTRACT_BY_NAME[v]) {
          args[i] = await CONTRACT_BY_NAME[v].address;
          continue;
        }
        console.error(`Run could not find account for ${v}`);
      }
    }
    console.log("🔭", user.name, contract.name, method, args);
    try {
      txPromise = contract.contract.connect(user.signer)[method](...args);
      const tx = await txPromise;
      tx.userName = user.name;
      tx.contractName = contract.name;
      tx.method = method;
      tx.args = args;
      contract.transactions.update((old) => [...old, tx]);
    } catch (err) {
      if (err.body) {
        const message = new TextDecoder("utf-8").decode(err.body);
        console.error(message);
      } else {
        console.error(err);
      }
    }
  };

  for (const contract of CONTRACT_OBJECTS) {
    if (contract.contractName) {
      contract.contract = chainContracts[contract.contractName];
      contract.address = contract.contract.address;
      if (contract.contract == undefined) {
        console.log(
          `Error, failed to back ${contract.name} with ${contract.contractName}`
        );
      }
    }
  }

  for (var i in PEOPLE_OBJECTS) {
    const account = accounts[i];
    PEOPLE_OBJECTS[i].signer = await provider.getSigner(account);
    PEOPLE_OBJECTS[i].address = await PEOPLE_OBJECTS[i].signer.getAddress();
  }
  // Setup
  const mattBalance = await CONTRACT_BY_NAME["OUSD"].contract.balanceOf(
    PEOPLE_BY_NAME["Matt"].address
  );
  const mattHasMoney = mattBalance.gt(900);
  if (!mattHasMoney) {
    const setup = SETUP;

    try {
      for (const line of setup.split("\n")) {
        if (line.trim() == "") {
          continue;
        }
        await blockRun(line.trim().split(" "));
      }
    } catch {}
  }
  await updateAllHoldings();
})();

async function updateHolding(user, contractName) {
  const contract = CONTRACT_BY_NAME[contractName];
  const rawBalance = await contract.contract.balanceOf(user.address);
  const balance = ethers.utils.formatUnits(rawBalance, contract.decimal);
  user.holdings[contractName].set(balance);
}

export async function updateAllHoldings() {
  let updates = [];
  const accounts = [...PEOPLE_OBJECTS, ...CONTRACT_OBJECTS];
  const Erc20Tokens = CONTRACT_OBJECTS.filter((x) => x.isERC20);
  for (const account of accounts) {
    for (const coin of Erc20Tokens) {
      updates.push(updateHolding(account, coin.name));
    }
  }
  await Promise.all(updates);
}
