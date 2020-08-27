<script>
  import { people, contracts } from "./stores.js";

  export let param;
  export let value;
</script>

<select bind:value title={param.name}>
  {#if param.type == 'erc20'}
    {#each $contracts.filter((x) => x.isERC20) as contract}
      <option value={contract.name}>{contract.icon} {contract.name}</option>
    {/each}
  {:else}
    <optgroup label="Contracts">
      {#each $contracts as contract}
        <option value={contract.name}>{contract.icon} {contract.name}</option>
      {/each}
    </optgroup>
    <optgroup label="People">
      {#each $people as person}
        <option value={person.name}>{person.icon} {person.name}</option>
      {/each}
    </optgroup>
  {/if}

</select>
