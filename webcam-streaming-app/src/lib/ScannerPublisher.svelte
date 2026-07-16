<script>
  import { onMount, onDestroy } from 'svelte';
  import { v4 as uuidv4 } from 'uuid';
  import { APP_CONFIG, SESSION_ID_ENABLED, DEMO_MODE } from './common/config';
  import GELogo from './GELogo.svelte';

  let { solaceClient, onBack } = $props();

  const sessionId = SESSION_ID_ENABLED ? uuidv4() : null;
  const sessionVideoTopic = sessionId ? `${APP_CONFIG.videoTopic}/${sessionId}` : APP_CONFIG.videoTopic;

  const SEQUENCES = ['T1 AXIAL', 'T2 FLAIR', 'T1 SAGITTAL', 'DWI', 'T2 CORONAL'];
  const ANALYSIS_IMAGES = [
    { filename: 'brain1.jpg', label: 'Brain Study 1' },
    { filename: 'brain2.jpg', label: 'Brain Study 2' },
    { filename: 'knee1.jpg', label: 'Knee Study 1' },
    { filename: 'knee2.jpg', label: 'Knee Study 2' },
    { filename: 'knee3.jpg', label: 'Knee Study 3' },
    { filename: 'knee4.jpg', label: 'Knee Study 4' }
  ];

  let videoEl = $state(null);
  let stream = $state(null);
  let status = $state('loading');
  let errorMessage = $state(null);
  let publishedCount = $state(0);
  let jpegQuality = $state(0.6);
  let targetFps = $state(10);
  let sliceIndex = $state(0);
  let sequence = $state(SEQUENCES[0]);
  let qrCodeDataUrl = $state(null);

  let analysisPayload = $state(null);
  let analysisHtml = $state('');
  let analysisLoading = $state(false);

  let captureIntervalId = null;
  let statusIntervalId = null;
  let framePublishInFlight = false;

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatInline(text) {
    return text
      .replace(/`([^`]+)`/g, '<code class="rounded px-1 bg-slate-100 text-slate-800">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-gehc-purple underline">$1</a>');
  }

  function renderMarkdown(markdown) {
    if (!markdown) return '';

    const codeBlocks = [];
    const placeholder = '___CODE_BLOCK_PLACEHOLDER___';

    const text = markdown.replace(/```(?:([^\n]+)\n)?([\s\S]*?)```/g, (_, lang, code) => {
      const formattedCode = `<pre class="rounded-3xl bg-slate-950 text-slate-100 overflow-x-auto p-3 text-[12px]"><code>${escapeHtml(code)}</code></pre>`;
      const token = `${placeholder}${codeBlocks.length}___`;
      codeBlocks.push(formattedCode);
      return token;
    });

    const lines = text.split('\n');
    let html = '';
    let inList = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line && inList) {
        html += '</ul>';
        inList = false;
      }

      if (!line) continue;

      if (line.startsWith(placeholder)) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        const index = Number(line.slice(placeholder.length, -3));
        html += codeBlocks[index] ?? '';
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        if (inList) { html += '</ul>'; inList = false; }
        const level = headingMatch[1].length;
        html += `<h${level} class="mt-4 mb-2 font-semibold text-slate-900">${formatInline(escapeHtml(headingMatch[2]))}</h${level}>`;
        continue;
      }

      if (/^([-*_]){3,}$/.test(line)) {
        if (inList) { html += '</ul>'; inList = false; }
        html += '<hr class="my-4 border-slate-200" />';
        continue;
      }

      const listMatch = line.match(/^[-*+]\s+(.+)$/);
      if (listMatch) {
        if (!inList) {
          html += '<ul class="list-disc list-inside space-y-1 mb-3">';
          inList = true;
        }
        html += `<li>${formatInline(escapeHtml(listMatch[1]))}</li>`;
        continue;
      }

      html += `<p class="mb-3">${formatInline(escapeHtml(line))}</p>`;
    }

    if (inList) html += '</ul>';
    return html;
  }

  function publishAnalysisRequest(payload) {
    solaceClient.publishControl(APP_CONFIG.analysisTopic, payload);
  }

  function subscribeToResultTopic() {
    solaceClient.subscribeToTopic(APP_CONFIG.resultTopic, (message) => {
      const text = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
      analysisPayload = text;
      analysisHtml = renderMarkdown(text);
      analysisLoading = false;
    });
  }

  async function simulateImageAnalysis(filename) {
    analysisLoading = true;
    analysisPayload = null;
    analysisHtml = '';

    const payload = { file: filename };

    publishAnalysisRequest(payload);

    if (DEMO_MODE) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const demoText = [
        '# MRI Positioning Result',
        '',
        `**File:** ${filename}`,
        '',
        '- Position: *Head First Supine*',
        '- Table location: **72 cm**',
        '- Coil: **Head/Neck**',
        '',
        '## Recommendations',
        '',
        '- Verify patient head alignment.',
        '- Confirm no motion artifacts.',
        '',
        '```json',
        JSON.stringify(payload, null, 2),
        '```'
      ].join('\n');

      analysisPayload = demoText;
      analysisHtml = renderMarkdown(demoText);
      analysisLoading = false;
    }
  }

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
    captureIntervalId = setInterval(captureAndPublish, Math.round(1000 / targetFps));
  }

  $effect(() => {
    if (status === 'active') {
      startCaptureLoop();
    }
  });

  function startStatusLoop() {
    statusIntervalId = setInterval(() => {
      sliceIndex = (sliceIndex + 1) % 128;
      if (sliceIndex === 0) sequence = SEQUENCES[Math.floor(Math.random() * SEQUENCES.length)];
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
      publishedCount += 1;
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

    subscribeToResultTopic();
    await startScanner();
  });

  onDestroy(() => {
    stopScanner();
    solaceClient.unsubscribeFromTopic(APP_CONFIG.resultTopic);
  });
</script>

<div class="h-screen bg-gradient-to-br from-gehc-bg via-white to-gehc-bg flex flex-col overflow-hidden">
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

  <main class="flex-1 min-h-0 flex flex-col md:flex-row items-stretch gap-4 p-4 overflow-hidden min-w-0">
    <section class="w-full md:w-80 shrink-0 min-w-0 bg-white rounded-3xl border border-slate-200 shadow-xl p-4 flex flex-col gap-4 overflow-hidden">
      {#if qrCodeDataUrl}
        <div class="text-center space-y-3">
          <p class="text-xs font-semibold uppercase tracking-widest text-gehc-purple-deep">Scan to View Feed</p>
          <img src={qrCodeDataUrl} alt="QR code for the reading room feed" class="mx-auto h-44 w-44 rounded-2xl border border-slate-200" />
          <p class="text-[10px] text-slate-500 font-mono">/reading-room</p>
        </div>
      {/if}

      <div class="rounded-3xl bg-slate-50 p-4">
        <p class="text-xs uppercase tracking-[0.24em] font-semibold text-slate-500">Analysis result</p>
        <p class="mt-3 text-sm text-slate-700">Publish a test payload to {APP_CONFIG.analysisTopic} and render markdown from {APP_CONFIG.resultTopic} below.</p>
      </div>

      <div class="rounded-3xl border border-slate-200 bg-white p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-gehc-purple-deep">Test images</p>
            <p class="text-xs text-slate-500">Use a preview card to publish a simulated analysis payload.</p>
          </div>
        </div>
        <div class="mt-4 max-h-[360px] min-h-0 overflow-y-auto pr-1">
          <div class="grid gap-3">
            {#each ANALYSIS_IMAGES as image}
              <button
                type="button"
                onclick={() => simulateImageAnalysis(image.filename)}
                class="group grid grid-cols-[72px_1fr] items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-gehc-purple hover:bg-gehc-purple/5"
              >
                <img src={`/images/${image.filename}`} alt={image.label} class="h-16 w-16 rounded-2xl object-cover border border-slate-200" />
                <div class="min-w-0">
                  <p class="font-semibold text-slate-900 group-hover:text-gehc-purple">{image.label}</p>
                  <p class="text-xs text-slate-500 truncate">{image.filename}</p>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <div class="rounded-3xl border border-slate-200 bg-white p-4">
        <p class="text-xs uppercase tracking-[0.24em] font-semibold text-slate-500 mb-2">Status</p>
        <div class="space-y-2 text-sm text-slate-700">
          <div><span class="font-semibold">Feed</span>: {status}</div>
          <div><span class="font-semibold">Frames</span>: {publishedCount}</div>
          <div><span class="font-semibold">Sequence</span>: {sequence}</div>
          <div><span class="font-semibold">Slice</span>: {sliceIndex}</div>
        </div>
      </div>
    </section>

    <section class="flex-1 flex flex-col overflow-hidden rounded-3xl border border-slate-200 shadow-xl bg-white">
      <div class="bg-gradient-to-r from-gehc-purple to-gehc-purple-deep px-5 py-4 text-white">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">Live Acquisition</h2>
            <p class="text-xs text-white/80">Publishing camera frames to Solace</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="rounded-full bg-white/15 px-3 py-1">FPS {targetFps}</span>
            <span class="rounded-full bg-white/15 px-3 py-1">Q{Math.round(jpegQuality * 100)}%</span>
            {#if status === 'active'}
              <span class="rounded-full bg-emerald-400/20 text-emerald-50 px-3 py-1">Streaming</span>
            {:else if status === 'error'}
              <span class="rounded-full bg-rose-400/20 text-rose-50 px-3 py-1">Error</span>
            {/if}
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0 relative overflow-hidden bg-slate-950">
        <video bind:this={videoEl}
          autoplay playsinline muted
          class="absolute inset-0 h-full w-full object-cover"
          style="opacity: {status === 'active' ? 1 : 0};"
        ></video>
        {#if status !== 'active'}
          <div class="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-center px-6">
            <div class="space-y-4">
              {#if status === 'loading'}
                <div class="mx-auto h-16 w-16 rounded-full border-4 border-white/20 border-t-white animate-spin"></div>
                <p class="text-white text-sm">Initializing scanner feed…</p>
              {:else if status === 'error'}
                <p class="text-white text-sm font-semibold">{errorMessage}</p>
                <button onclick={startScanner} class="rounded-full bg-gehc-purple px-5 py-2 text-sm font-semibold text-white hover:bg-gehc-purple-dark transition">Retry</button>
              {:else}
                <p class="text-white text-sm">Scanner idle. Start the feed to publish frames.</p>
                <button onclick={startScanner} class="rounded-full bg-gehc-purple px-5 py-2 text-sm font-semibold text-white hover:bg-gehc-purple-dark transition">Start Feed</button>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <div class="bg-slate-50 p-4 border-t border-slate-200 overflow-hidden flex-none">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-gehc-purple-deep">Analysis result</p>
              <p class="text-xs text-slate-500">Rendered from markdown payload on {APP_CONFIG.resultTopic}</p>
            </div>
            {#if analysisLoading}
              <div class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
                <span class="h-3 w-3 rounded-full border-2 border-slate-300 border-t-gehc-purple animate-spin"></span>
                Waiting for payload…
              </div>
            {/if}
          </div>

          <div class="rounded-3xl border border-slate-200 bg-white p-4 min-h-[180px] max-h-[280px] overflow-y-auto">
            {#if analysisLoading}
              <p class="text-slate-500">Awaiting the analysis result from {APP_CONFIG.resultTopic}...</p>
            {:else if analysisPayload}
              <div class="markdown-body space-y-4 text-slate-800">{@html analysisHtml}</div>
            {:else}
              <p class="text-slate-500">No analysis result yet. Use one of the simulator buttons to publish a test payload.</p>
            {/if}
          </div>
        </div>
      </div>
    </section>
  </main>
</div>
