<script>
    let { checked = $bindable(false), children } = $props()
</script>

<label>
    <input type="checkbox" bind:checked />
    <span class="checkbox-indicator">
        {#if checked}
            [<span class="checkbox-x">x</span>]
        {:else}
            [ ]
        {/if}
    </span>
    <span class="checkbox-content">
        {@render children?.()}
    </span>
</label>

<style>
    label {
        display: block;
        cursor: pointer;
    }

    label input[type='checkbox'] {
        display: none;
    }

    .checkbox-indicator {
        color: var(--txt-3);
    }

    .checkbox-x {
        color: var(--txt-2);
    }

    label:hover .checkbox-indicator {
        color: var(--txt-2);
    }
</style>
