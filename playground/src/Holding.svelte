<script>
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";
  import { onDestroy } from "svelte";
  export let token;
  export let holding;
  let isChanging = false;
  const progress = tweened(undefined, {
    duration: 400,
    easing: cubicOut,
  });
  const unsubscribe = holding.subscribe((v) => {
    isChanging = true;
    progress.set(parseFloat(v)).then(() => {
      isChanging = false;
    });
  });
  onDestroy(unsubscribe);
</script>

<style>
  .fade {
    opacity: 0.1;
  }
  .changing {
    color: gold;
  }
</style>

<tr class="{$progress == 0 ? 'fade' : ''} {isChanging ? 'changing' : ''}">
  <td>💰</td>
  <td style="text-align:right">
    {$progress.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}
  </td>
  <td>{token.toLowerCase()}</td>
</tr>
