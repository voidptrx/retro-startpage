<script>
    import { onMount, onDestroy } from 'svelte'

    let { class: className = '' } = $props()

    let loadTime = $state(0)
    let latency = $state(null)
    let viewportWidth = $state(0)
    let viewportHeight = $state(0)
    let fps = $state(0)

    let frameCount = 0
    let lastTime = 0
    let fpsAnimationId = null
    let perfObserver = null

    function updateFPS() {
        frameCount++
        const currentTime = performance.now()

        if (currentTime >= lastTime + 1000) {
            fps = frameCount
            frameCount = 0
            lastTime = currentTime
        }

        fpsAnimationId = requestAnimationFrame(updateFPS)
    }

    function startFPS() {
        if (!fpsAnimationId) {
            frameCount = 0
            lastTime = performance.now()
            updateFPS()
        }
    }

    function stopFPS() {
        if (fpsAnimationId) {
            cancelAnimationFrame(fpsAnimationId)
            fpsAnimationId = null
            fps = 0
        }
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            startFPS()
            measurePing()
        } else {
            stopFPS()
        }
    }

    async function measurePing() {
        const start = performance.now()

        try {
            await fetch('https://www.google.com/generate_204', {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-cache',
            })
            latency = Math.round(performance.now() - start)
        } catch (error) {
            latency = null
        }
    }

    function updateViewportSize() {
        viewportWidth = window.innerWidth
        viewportHeight = window.innerHeight
    }

    onMount(() => {
        measurePing()
        updateViewportSize()
        startFPS()

        perfObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            if (entries.length > 0) {
                const entry = entries[0].toJSON()
                loadTime = Math.round(entry.duration)
            }
        })
        perfObserver.observe({ type: 'navigation', buffered: true })

        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('resize', updateViewportSize)
    })

    onDestroy(() => {
        stopFPS()
        if (perfObserver) {
            perfObserver.disconnect()
        }
        window.removeEventListener('resize', updateViewportSize)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
    })
</script>

<div class="panel-wrapper {className}">
    <div class="panel-label">stats</div>
    <div class="panel">
        <div>load <span class="bright">{loadTime} ms</span></div>
        <div>ping <span class="bright">{latency || '?'} ms</span></div>
        <div>fps <span class="bright">{fps}</span></div>
        <div>
            <span class="bright">{viewportWidth}</span> x
            <span class="bright">{viewportHeight}</span>
        </div>
    </div>
</div>

<style>
    .panel-wrapper.expand {
        flex-grow: 1;
    }
</style>
