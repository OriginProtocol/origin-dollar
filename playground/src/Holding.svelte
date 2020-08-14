<script>
    import { tweened } from 'svelte/motion';
    import { cubicOut } from 'svelte/easing';
    import { onDestroy } from 'svelte';
    export let token;
    export let holding;
    const progress = tweened(0.0, {
		duration: 200,
		easing: cubicOut
    });
    const unsubscribe = holding.subscribe(v => {
		progress.set(parseFloat(v))
    });
    onDestroy(unsubscribe);
</script>

<style>
    .fade{opacity:0.1}
</style>

    <tr class="{$progress==0?'fade':''}">
        <td>💰</td>
        <td style="text-align:right">{$progress.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td>{token.toLowerCase()}</td>
    </tr>