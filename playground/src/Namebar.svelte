<script>
  export let person;
</script>

<style>
  h3 {
    margin-top: 0px;
  }
  .avatar {
    width: 32px;
    height: 32px;
    border: 1px solid #775;
    border-radius: 4px;
    text-align: center;
    font-size: 28px;
    background: radial-gradient(#724848, #101c0d);
    opacity: 1;
    float: left;
    margin-right: 12px;
  }
</style>

<h3>
  <div class="avatar">{person.icon}</div>
  {person.name}
</h3>
