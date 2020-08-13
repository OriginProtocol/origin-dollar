<script>
  export let holdings;
</script>

<table>
  <tbody>
    {#each Object.keys(holdings || {}) as token}
      <tr>
        <td>💰</td>
        <td style="text-align:right">{holdings[token].toLocaleString()}</td>
        <td>{token}</td>
        <td />
      </tr>
    {/each}
  </tbody>
</table>
