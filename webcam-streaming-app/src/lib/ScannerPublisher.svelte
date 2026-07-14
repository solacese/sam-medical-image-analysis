<script>
  import { onMount, onDestroy } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { APP_CONFIG, SESSION_ID_ENABLED, DEMO_MODE } from './common/config';
  import GELogo from './GELogo.svelte';

  let { solaceClient, onBack } = $props();

  const sessionId = SESSION_ID_ENABLED ? uuidv4() : null;
  const sessionVideoTopic = sessionId ? `${APP_CONFIG.videoTopic}/${sessionId}` : APP_CONFIG.videoTopic;

  // MRI sequence labels cycled through for the overlay
  const SEQUENCES = ['T1 AXIAL', 'T2 FLAIR', 'T1 SAGITTAL', 'DWI', 'T2 CORONAL'];

  let videoEl = $state(null);
  let stream = $state(null);
  let status = $state('loading'); // loading | active | error | ready
  let errorMessage = $state(null);
  let publishedCount = $state(0);
  let jpegQuality = $state(0.6);
  let targetFps = $state(10);
  let sliceIndex = $state(0);
  let sequence = $state(SEQUENCES[0]);
  let qrCodeDataUrl = $state(null);

  let captureIntervalId = null;
  let statusIntervalId = null;
  let framePublishInFlight = false;

  const captureIntervalMs = $derived(Math.round(1000 / targetFps));

  async function startScanner() {
    errorMessage = null;
    status = 'loading';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      videoEl.srcObject = stream;
      await videoEl.play();
      status = 'active';
      startCaptureLoop();
      startStatusLoop();
    } catch (err) {
      console.error('Camera access error:', err);
      errorMessage = err.name === 'NotAllowedError'
        ? 'Camera access denied. Allow camera permissions to start the scanner feed.'
        : 'Could not access camera: ' + err.message;
      status = 'error';
    }
  }

  function stopScanner() {
    if (captureIntervalId) { clearInterval(captureIntervalId); captureIntervalId = null; }
    if (statusIntervalId) { clearInterval(statusIntervalId); statusIntervalId = null; }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
    status = 'ready';
  }

  function startCaptureLoop() {
    if (captureIntervalId) clearInterval(captureIntervalId);
    captureIntervalId = setInterval(captureAndPublish, captureIntervalMs);
  }

  // Restart the capture loop whenever the FPS target changes
  $effect(() => {
    captureIntervalMs;
    if (status === 'active') startCaptureLoop();
  });

  function startStatusLoop() {
    statusIntervalId = setInterval(() => {
      sliceIndex = (sliceIndex + 1) % 128;
      if (sliceIndex === 0) {
        sequence = SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
      }
      solaceClient.publishControl(APP_CONFIG.statusTopic, {
        scannerId: sessionId ?? 'default',
        sequence,
        slice: sliceIndex,
        fps: targetFps,
        timestamp: new Date().toISOString()
      });
    }, 1000);
  }

  function captureAndPublish() {
    if (status !== 'active' || !videoEl || videoEl.readyState < 2) return;
    if (framePublishInFlight) return;
    framePublishInFlight = true;

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) { framePublishInFlight = false; return; }
      const arrayBuffer = await blob.arrayBuffer();
      solaceClient.publishVideoFrame(sessionVideoTopic, arrayBuffer);
      publishedCount++;
      framePublishInFlight = false;
    }, 'image/jpeg', jpegQuality);
  }

  onMount(async () => {
    if (sessionId) {
      const viewerUrl = `${window.location.origin}/reading-room?sessionId=${sessionId}`;
      const QRCode = await import('qrcode').catch(() => null);
      if (QRCode) {
        qrCodeDataUrl = await QRCode.default.toDataURL(viewerUrl, {
          width: 300, margin: 1, color: { dark: '#3B2A8C', light: '#ffffff' }
        });
      }
    }
    await startScanner();
  });

  onDestroy(() => stopScanner());
</script>

<div class="h-screen bg-gradient-to-br from-gehc-bg via-white to-gehc-bg flex flex-col overflow-hidden">
  <!-- Header -->
  <header class="shrink-0 bg-white shadow-md border-b-4 border-gehc-purple">
    <div class="container mx-auto px-4 py-3 flex items-center gap-3">
      <GELogo size={40} />
      <span class="hidden sm:inline text-sm font-semibold text-gehc-navy/60 border-l border-gehc-navy/15 pl-3 ml-1">
        MRI Scanner Console
      </span>
      <button onclick={onBack} class="ml-auto text-sm text-gehc-navy hover:text-gehc-purple font-medium transition-colors">
        ← Back
      </button>
    </div>
  </header>

  <main class="flex-1 min-h-0 flex items-center justify-center gap-4 p-4">

    <!-- QR panel -->
    {#if qrCodeDataUrl}
      <div class="shrink-0 self-center bg-white rounded-2xl shadow-xl border-2 border-gehc-purple-light/30 p-4 flex flex-col items-center gap-2">
        <p class="text-xs font-semibold text-gehc-purple-deep uppercase tracking-widest">Scan to View Feed</p>
        <img src={qrCodeDataUrl} alt="QR code for the reading room feed" class="w-44 h-44 rounded-lg block" />
        <p class="text-[10px] text-gray-400 font-mono">/reading-room</p>
      </div>
    {/if}

    <!-- Scanner card -->
    <div class="flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden border-2 {status === 'active' ? 'border-gehc-purple' : 'border-gehc-purple-light/30'} transition-colors duration-300" style="height: 100%; aspect-ratio: 4 / 3;">

      <!-- Header bar -->
      <div class="bg-gradient-to-r from-gehc-purple to-gehc-purple-deep px-4 py-2 flex items-center gap-3 min-w-0 shrink-0">
        <h2 class="text-base font-display font-bold text-white shrink-0">Live Acquisition</h2>
        <div class="flex items-center gap-3 ml-auto shrink-0">
          {#if status === 'active'}
            <span class="text-xs text-white/70 font-mono">{publishedCount} frames</span>
          {/if}
          <label for="fps" class="text-xs text-white/70 font-mono">{targetFps} fps</label>
          <input id="fps" type="range" min="1" max="24" step="1" bind:value={targetFps} class="w-16 accent-white" />
          <label for="q" class="text-xs text-white/70 font-mono">Q {Math.round(jpegQuality * 100)}%</label>
          <input id="q" type="range" min="0.1" max="1.0" step="0.05" bind:value={jpegQuality} class="w-16 accent-white" />
          <span class="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold text-white flex items-center gap-1">
            {#if status === 'active'}
              <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Streaming
            {:else if status === 'error'}
              <span class="w-2 h-2 bg-red-400 rounded-full"></span> Error
            {:else if status === 'loading'}
              <span class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span> Warming up
            {:else}
              <span class="w-2 h-2 bg-gray-400 rounded-full"></span> Idle
            {/if}
          </span>
        </div>
      </div>

      <!-- Video area -->
      <div class="flex-1 min-h-0 bg-gradient-to-br from-gehc-ink via-[#0a0d1f] to-gehc-ink relative overflow-hidden">
        <video
          bind:this={videoEl}
          autoplay playsinline muted
          class="absolute inset-0 w-full h-full object-cover"
          style="opacity: {status === 'active' ? 1 : 0};"
        ></video>

        {#if status !== 'active'}
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="text-center space-y-4 px-6">
              {#if status === 'loading'}
                <div class="w-16 h-16 mx-auto border-4 border-gehc-purple/30 border-t-gehc-purple rounded-full animate-spin"></div>
                <p class="text-gehc-purple-light text-sm">Initializing scanner feed…</p>
              {:else if status === 'error'}
                <div class="w-24 h-24 mx-auto bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500/50">
                  <svg class="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <p class="text-red-400 font-medium">{errorMessage}</p>
                <button onclick={startScanner} class="px-6 py-2 bg-gehc-purple text-white font-semibold rounded-full hover:bg-gehc-purple-dark transition-colors text-sm">Retry</button>
              {:else}
                <p class="text-gehc-purple-light font-medium text-lg">Scanner idle</p>
                <button onclick={startScanner} class="px-6 py-2 bg-gehc-purple text-white font-semibold rounded-full hover:bg-gehc-purple-dark transition-colors text-sm">Start Feed</button>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Corner brackets -->
        <div class="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-gehc-purple-light/60"></div>
        <div class="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-gehc-purple-light/60"></div>
        <div class="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-gehc-purple-light/60"></div>
        <div class="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-gehc-purple-light/60"></div>

        <!-- Scan-line sweep -->
        <div class="absolute inset-0 pointer-events-none">
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gehc-purple-light to-transparent animate-pulse"></div>
        </div>

        <!-- MRI HUD overlay -->
        {#if status === 'active'}
          <div class="absolute top-4 left-4 font-mono text-xs text-gehc-purple-light/90 space-y-0.5 pointer-events-none">
            <div>SEQ · {sequence}</div>
            <div>SLICE · {String(sliceIndex).padStart(3, '0')}/128</div>
          </div>
          <div class="absolute bottom-4 right-4 font-mono text-[10px] text-gehc-purple-light/70 pointer-events-none">
            {sessionVideoTopic}
          </div>
        {/if}
      </div>
    </div>
  </main>
</div>
