<script>
  import { onMount, onDestroy } from 'svelte';
  import { APP_CONFIG } from './common/config';
  import GELogo from './GELogo.svelte';

  let { solaceClient, onBack, sessionId = null } = $props();

  let imgElement;
  let isActive = $state(false);
  let hasReceivedFrame = $state(false);
  let connectionError = $state('');
  let frameCount = $state(0);
  let scannerStatus = $state(null);

  const VIDEO_TOPIC = sessionId ? `${APP_CONFIG.videoTopic}/${sessionId}` : APP_CONFIG.videoTopic;

  onMount(async () => {
    try {
      await solaceClient.subscribe(VIDEO_TOPIC, handleVideoMessage);
      solaceClient.subscribeToTopic(APP_CONFIG.statusTopic, handleStatus);
      isActive = true;
    } catch (error) {
      console.error('VideoFeedViewer: Failed to subscribe:', error);
      connectionError = 'Failed to connect to video feed';
      isActive = false;
    }
  });

  onDestroy(async () => {
    try {
      await solaceClient.unsubscribe(VIDEO_TOPIC);
      solaceClient.unsubscribeFromTopic(APP_CONFIG.statusTopic);
    } catch (error) {
      console.error('VideoFeedViewer: Error during cleanup:', error);
    }
  });

  function handleVideoMessage(payload) {
    if (payload === 'INACTIVE') {
      isActive = false;
      hasReceivedFrame = false;
      if (imgElement) imgElement.style.display = 'none';
      return;
    }
    if (typeof payload === 'string' && payload.startsWith('data:image/')) {
      if (imgElement) {
        imgElement.src = payload;
        imgElement.style.display = 'block';
        hasReceivedFrame = true;
        frameCount++;
      }
    }
  }

  function handleStatus(payload) {
    if (payload && typeof payload === 'object') scannerStatus = payload;
  }
</script>

<div class="min-h-screen bg-gradient-to-br from-gehc-bg via-white to-gehc-bg flex flex-col">
  <!-- Header -->
  <header class="bg-white shadow-md border-b-4 border-gehc-purple">
    <div class="container mx-auto px-4 py-3 flex items-center gap-3">
      <GELogo size={40} />
      <span class="hidden sm:inline text-sm font-semibold text-gehc-navy/60 border-l border-gehc-navy/15 pl-3 ml-1">
        Radiology Reading Room
      </span>
      <div class="flex items-center gap-2 ml-auto">
        {#if isActive && hasReceivedFrame}
          <div class="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
          <span class="text-sm font-medium text-gray-600">Live</span>
        {:else if connectionError}
          <div class="w-3 h-3 bg-red-400 rounded-full"></div>
          <span class="text-sm font-medium text-red-500">Error</span>
        {:else if isActive}
          <div class="w-3 h-3 bg-green-400 rounded-full"></div>
          <span class="text-sm font-medium text-gray-600">Subscribed</span>
        {:else}
          <div class="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
          <span class="text-sm font-medium text-gray-600">Connecting</span>
        {/if}
        <button onclick={onBack} class="ml-3 text-sm text-gehc-navy hover:text-gehc-purple font-medium transition-colors">← Back</button>
      </div>
    </div>
  </header>

  <!-- Main content -->
  <main class="flex-1 container mx-auto px-4 py-6 flex flex-col gap-4">
    <div class="flex-1 max-w-4xl mx-auto w-full bg-white rounded-2xl shadow-xl overflow-hidden border-2 border-gehc-purple-light/30">
      <!-- Feed header -->
      <div class="bg-gradient-to-r from-gehc-purple to-gehc-purple-deep px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <h2 class="text-xl font-display font-bold text-white shrink-0">MRI Feed</h2>
          <span class="text-sm text-white/80 font-mono truncate">{VIDEO_TOPIC}</span>
        </div>
        <span class="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold text-white flex items-center gap-1 shrink-0">
          {#if isActive && hasReceivedFrame}
            <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Active
          {:else if connectionError}
            <span class="w-2 h-2 bg-red-400 rounded-full"></span> Error
          {:else if isActive}
            <span class="w-2 h-2 bg-green-400 rounded-full"></span> Waiting for feed
          {:else}
            <span class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span> Connecting…
          {/if}
        </span>
      </div>

      <!-- Video area -->
      <div class="aspect-video bg-gradient-to-br from-gehc-ink via-[#0a0d1f] to-gehc-ink relative overflow-hidden">
        <img bind:this={imgElement} class="absolute inset-0 w-full h-full object-contain" style="display: none;" alt="Live MRI feed" />

        {#if !hasReceivedFrame}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center space-y-4 px-6">
              <div class="w-24 h-24 mx-auto bg-gehc-purple/20 rounded-full flex items-center justify-center backdrop-blur-sm border-2 border-gehc-purple/50">
                <svg class="w-12 h-12 text-gehc-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              {#if connectionError}
                <p class="text-red-400 font-medium text-lg">{connectionError}</p>
                <p class="text-gray-400 text-sm">Check Solace connection settings</p>
              {:else if isActive}
                <p class="text-gehc-purple-light font-medium text-lg">Subscribed — waiting for scanner feed</p>
                <p class="text-gray-400 text-xs font-mono">{VIDEO_TOPIC}</p>
              {:else}
                <p class="text-yellow-400 font-medium text-lg">Connecting to Solace…</p>
                <p class="text-gray-400 text-sm">Establishing broker connection</p>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Scan line -->
        <div class="absolute inset-0 pointer-events-none">
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gehc-purple-light to-transparent animate-pulse"></div>
        </div>

        <!-- Corner brackets -->
        <div class="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-gehc-purple-light/60"></div>
        <div class="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-gehc-purple-light/60"></div>
        <div class="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-gehc-purple-light/60"></div>
        <div class="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-gehc-purple-light/60"></div>

        <!-- Scanner status HUD -->
        {#if scannerStatus}
          <div class="absolute top-4 left-4 font-mono text-xs text-gehc-purple-light/90 space-y-0.5 pointer-events-none">
            <div>SEQ · {scannerStatus.sequence}</div>
            <div>SLICE · {String(scannerStatus.slice ?? 0).padStart(3, '0')}/128</div>
            <div>{scannerStatus.fps} fps</div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Stats row -->
    <div class="max-w-4xl mx-auto w-full grid grid-cols-3 gap-3">
      <div class="bg-white rounded-xl border border-gehc-purple-light/30 p-3 text-center shadow-sm">
        <div class="text-2xl font-bold text-gehc-purple-deep font-mono">{frameCount}</div>
        <div class="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Frames Received</div>
      </div>
      <div class="bg-white rounded-xl border border-gehc-purple-light/30 p-3 text-center shadow-sm">
        <div class="text-2xl font-bold text-gehc-purple-deep font-mono">{scannerStatus?.sequence ?? '—'}</div>
        <div class="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Active Sequence</div>
      </div>
      <div class="bg-white rounded-xl border border-gehc-purple-light/30 p-3 text-center shadow-sm">
        <div class="text-2xl font-bold text-gehc-purple-deep font-mono">{scannerStatus?.fps ?? '—'}</div>
        <div class="text-[10px] uppercase tracking-widest text-gray-400 mt-1">Scanner FPS</div>
      </div>
    </div>
  </main>
</div>
