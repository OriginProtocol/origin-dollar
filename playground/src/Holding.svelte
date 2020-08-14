<script>
    import Holding from "./Holding.svelte";
    export let token;
    export let holding;
    $: amount = parseFloat($holding).toFixed(2)
</script>

{#if amount > 0}
<tr>
    <td>💰</td>
    <td style="text-align:right">{amount.toLocaleString()}</td>
    <td>{token.toLowerCase()}</td>
    <td />
</tr>
{/if}