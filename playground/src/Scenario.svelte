<script>
  import { blockRun, updateAllHoldings } from "./stores.js";
  export let scenario;
  const lines = scenario.actions.split("\n").filter((x) => x.trim() != "");
  let activeLineIndex = -1;

  async function playLine(line, i) {
    activeLineIndex = i;
    await blockRun(line.trim().split(" "));
    await updateAllHoldings();
    activeLineIndex = -1;
  }

  async function play() {
    console.log("OKKAA");
    try {
      for (const i in lines) {
        const line = lines[i];
        if (line.trim() == "") {
          continue;
        }
        if (line.trim().startsWith("#")) {
          continue;
        }
        await playLine(line, i);
      }
    } catch (e) {
      console.error(e);
    }
    activeLineIndex = -1;
  }
</script>

<style>
  ul {
    padding-left: 0px;
  }
  li {
    margin-left: 0px;
  }
  li.comment {
    list-style-type: none;
    margin-left: -20px;
    padding-left: 0px;
  }
  li.code {
    list-style-type: none;
    font-family: Ioseveka, monospace;
    opacity: 0.5;
  }
  li.active {
    color: white;
    opacity: 1;
  }
  a {
    text-decoration: none;
    color: #aaa;
  }
  a:hover {
    opacity: 0.9;
    color: #eff;
  }
</style>

<div>
  <h3>{scenario.name} <button on:click={play}>Play All</button></h3>
  <ul>
    {#each lines as line, i}
      {#if line.trim().startsWith('#')}
        <li class="comment {i == activeLineIndex ? 'active' : ''}">
          <span style="color: #333">#</span>
          {line.trim().replace(/^# /, '')}
        </li>
      {:else}
        <li class="code {i == activeLineIndex ? 'active' : ''}">
          <a href="#" on:click={() => playLine(line, i)}>&gt; {line.trim()}</a>
        </li>
      {/if}
    {/each}
  </ul>
</div>
