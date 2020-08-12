import { writable } from "svelte/store";

const PEOPLE = [
  { name: "Matt", icon: "👨‍🚀", id: 0, holdings: { USDT: 9000 } },
  { name: "Sofi", icon: "👸", id: 1, holdings: { USDT: 2000 } },
  { name: "Raul", icon: "👨‍🎨", id: 2, holdings: { USDT: 1000 } },
  { name: "Suparman", icon: "👨🏾‍🎤", id: 3, holdings: { USDT: 1500 } },
  { name: "Anna", icon: "🧝🏻‍♀️", id: 4, holdings: { USDT: 600 } },
  { name: "Pyotr", icon: "👨🏻‍⚖️", id: 5, holdings: { USDT: 4000, PZI: 100 } },
];

const CONTRACTS = [
  {
    name: "USDT",
    icon: "💵",
    id: 0,
    actions: [{ name: "Transfer" }, { name: "Approve" }],
  },
  {
    name: "Ponzi",
    icon: "🎩",
    id: 1,
    holdings: { USDT: 100 },
    actions: [
      { name: "Mint", params: [{ name: "Amount in USDT" }] },
      { name: "Redeem", params: [{ name: "Amount in PZI" }] },
    ],
  },
  {
    name: "OUSD",
    icon: "🖲",
    id: 0,
    holdings: {},
    actions: [
      { name: "Mint", params: [{ name: "Amount in USDT" }] },
      { name: "Burn" },
      { name: "Transfer" },
      { name: "Approve" },
    ],
  },
];

export let people = writable(PEOPLE);
export let contracts = writable(CONTRACTS);

export let activePopupMenu = writable();
export let activePerson = writable();

function updateAll() {
  people.update((old) => old);
  contracts.update((old) => old);
}

setInterval(() => {
  for (const account of [...PEOPLE, ...CONTRACTS]) {
    const holdings = account.holdings || {};
    if (holdings.PZI) {
      holdings.PZI = holdings.PZI * (1.0037 + Math.random() / 100);
    }
  }
  updateAll();
}, 1000);

export function handleTx(contract, person, action, args) {
  console.log(contract, person, action, args);

  if (contract.name == "OUSD") {
    if (action.name == "Mint") {
      const amount = parseFloat(args[0]);
      if (person.holdings.USDT < amount) {
        return alert("You do not have enough USDT mint that much OUSD");
      }
      person.holdings.USDT -= amount;
      contract.holdings.USDT = (contract.holdings.USDT || 0) + amount;
      person.holdings.OUSD = (person.holdings.OUSD || 0) + amount;
      updateAll();
      return true;
    }
  }

  if (contract.name == "Ponzi") {
    if (action.name == "Mint") {
      const amount = parseFloat(args[0]);
      if (amount < 0) {
        return alert("You can only mint a positive amount");
      }
      if (person.holdings.USDT < amount) {
        return alert("You do not have enough USDT mint that much PZI");
      }
      person.holdings.USDT -= amount;
      contract.holdings.USDT += amount;
      person.holdings.PZI = (person.holdings.PZI || 0) + amount;
      updateAll();
      return true;
    }
    if (action.name == "Redeem") {
      const amount = parseFloat(args[0]);
      if (amount < 0) {
        return alert("You can only redeem a positive amount");
      }
      if (person.holdings.PZI < amount) {
        return alert("You do not have enough PZI to redeem that much USDT");
      }
      if (contract.holdings.USDT < amount) {
        return alert(
          "The contract does not have enough USDT to redeem that much"
        );
      }
      person.holdings.PZI = (person.holdings.PZI || 0) - amount;
      person.holdings.USDT = (person.holdings.USDT || 0) + amount;
      contract.holdings.USDT -= amount;
      updateAll();
      return true;
    }
  }
}
