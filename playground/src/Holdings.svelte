<script>
import Holding from "./Holding.svelte";

  export let holdings;
</script>

<table>
  <tbody>
    {#each Object.keys(holdings || {}) as token}
      <Holding holding={holdings[token]} token={token}></Holding>
    {/each}
  </tbody>
</table>
