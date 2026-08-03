"use strict";

/**
 * Builds synthetic storage layouts in the exact shape solc emits, so policy
 * cases read as a one-line diff rather than 30 lines of hand-written JSON.
 *
 * Type entries are copied verbatim from deployments/mainnet/OUSDVault.json so
 * the fixtures match real forge output, including the AST-id-bearing ids that
 * make raw type strings unusable as a comparison key.
 */

const TYPES = {
  t_bool: { encoding: "inplace", label: "bool", numberOfBytes: "1" },
  t_uint64: { encoding: "inplace", label: "uint64", numberOfBytes: "8" },
  t_uint256: { encoding: "inplace", label: "uint256", numberOfBytes: "32" },
  t_address: { encoding: "inplace", label: "address", numberOfBytes: "20" },
  "t_mapping(t_address,t_uint256)": {
    encoding: "mapping",
    key: "t_address",
    label: "mapping(address => uint256)",
    numberOfBytes: "32",
    value: "t_uint256",
  },
  // AST-id-bearing ids, as solc really emits them
  "t_enum(RebaseOptions)842": {
    encoding: "inplace",
    label: "enum OUSD.RebaseOptions",
    numberOfBytes: "1",
  },
  "t_enum(RebaseOptions)91177": {
    encoding: "inplace",
    label: "enum OUSD.RebaseOptions",
    numberOfBytes: "1",
  },
  "t_struct(Strategy)5275_storage": {
    encoding: "inplace",
    label: "struct VaultStorage.Strategy",
    numberOfBytes: "64",
  },
};

const arrayType = (n) => `t_array(t_uint256)${n}_storage`;

function typeEntry(id) {
  if (TYPES[id]) return TYPES[id];
  const m = /^t_array\(t_uint256\)(\d+)_storage$/.exec(id);
  if (m) {
    return {
      base: "t_uint256",
      encoding: "inplace",
      label: `uint256[${m[1]}]`,
      numberOfBytes: String(Number(m[1]) * 32),
    };
  }
  throw new Error(`layout fixture: unknown type ${id}`);
}

/** A gap row spec. `gap(50)` -> uint256[50] labelled __gap. */
const gap = (n, label = "__gap") => ({ label, type: arrayType(n) });

/**
 * layout(["initialized:bool", gap(50, "______gap"), "alice:address"])
 *
 * Slots are assigned sequentially, one variable per slot, an array consuming as
 * many slots as it declares. Pass an explicit `{slot, offset}` to model packing.
 */
function layout(specs) {
  const storage = [];
  const used = new Set();
  let slot = 0;
  let astId = 100;

  for (const spec of specs) {
    const s =
      typeof spec === "string"
        ? { label: spec.split(":")[0], type: spec.split(":")[1] }
        : { ...spec };
    const entry = typeEntry(s.type);
    const row = {
      astId: astId++,
      contract: "C.sol:C",
      label: s.label,
      offset: s.offset ?? 0,
      slot: String(s.slot ?? slot),
      type: s.type,
    };
    storage.push(row);
    used.add(s.type);
    if (s.slot === undefined) {
      slot += Math.max(1, Math.ceil(Number(entry.numberOfBytes) / 32));
    }
  }

  const types = {};
  for (const id of used) {
    types[id] = typeEntry(id);
    if (types[id].base) types[types[id].base] = typeEntry(types[id].base);
    if (types[id].key) {
      types[types[id].key] = typeEntry(types[id].key);
      types[types[id].value] = typeEntry(types[id].value);
    }
  }
  return { storage, types };
}

const clone = (l) => JSON.parse(JSON.stringify(l));
const find = (l, label) => l.storage.findIndex((r) => r.label === label);

/** Renumber slots after a structural edit, mirroring solc's allocation. */
function reslot(l) {
  let slot = 0;
  for (const row of l.storage) {
    row.slot = String(slot);
    slot += Math.max(
      1,
      Math.ceil(Number(typeEntry(row.type).numberOfBytes) / 32)
    );
  }
  return l;
}

function rename(l, from, to) {
  const c = clone(l);
  c.storage[find(c, from)].label = to;
  return c;
}

function drop(l, label) {
  const c = clone(l);
  c.storage.splice(find(c, label), 1);
  return reslot(c);
}

/** Insert a new variable immediately BEFORE `beforeLabel`. */
function insert(l, beforeLabel, spec) {
  const c = clone(l);
  const [label, type] = spec.split(":");
  c.storage.splice(find(c, beforeLabel), 0, {
    astId: 900,
    contract: "C.sol:C",
    label,
    offset: 0,
    slot: "0",
    type,
  });
  c.types[type] = typeEntry(type);
  return reslot(c);
}

function retype(l, label, type) {
  const c = clone(l);
  c.storage[find(c, label)].type = type;
  c.types[type] = typeEntry(type);
  return reslot(c);
}

/** Shrink a gap by `n` slots, keeping its label. */
function shrinkGap(l, n, label = "__gap") {
  const c = clone(l);
  const row = c.storage[find(c, label)];
  const size = Number(/\)(\d+)_storage$/.exec(row.type)[1]);
  row.type = arrayType(size - n);
  c.types[row.type] = typeEntry(row.type);
  return reslot(c);
}

function swapLabels(l, a, b) {
  const c = clone(l);
  const ia = find(c, a);
  const ib = find(c, b);
  c.storage[ia].label = b;
  c.storage[ib].label = a;
  return c;
}

module.exports = {
  layout,
  gap,
  arrayType,
  rename,
  drop,
  insert,
  retype,
  shrinkGap,
  swapLabels,
  clone,
};
