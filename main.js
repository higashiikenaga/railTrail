(() => {
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const tileInfoEl = document.getElementById('tile-info');
  const hudStatsEl = document.getElementById('hud-stats');
  let candidateActionsRowEl = document.getElementById('candidate-actions-row') || null;
  let lawActionBtn = null;
  let frontierActionBtn = null;
  let roadManualBtn = null;
  let railManualBtn = null;
  let populationPlanBtn = document.querySelector('[data-action="population-plan"]') || null;
  let candidateLogEl = document.getElementById('candidate-log') || null;
  const hudEl = document.getElementById('hud');
  const titleContainer = document.getElementById('title-ui');
  const titleStatusEl = document.getElementById('title-status');
  const newWorldBtn = document.getElementById('btn-new-world');
  const loadWorldBtn = document.getElementById('btn-load-world');
  const storyModeBtn = document.getElementById('btn-story-mode');
  const galleryBtn = document.getElementById('btn-gallery');
  const bgmToggleBtn = document.getElementById('btn-bgm-toggle');
  const bgmAudio = document.getElementById('title-bgm');
  const storyOverlayRoot = document.getElementById('story-overlay-root');
  const confirmOverlay = document.getElementById('confirm-overlay');
  const overlaySaveBtn = document.getElementById('btn-overlay-save');
  const overlayDiscardBtn = document.getElementById('btn-overlay-discard');
  const overlayCancelBtn = document.getElementById('btn-overlay-cancel');
  const mobileUiEl = document.getElementById('mobile-ui');
  const cityListOverlay = document.getElementById('city-list-overlay');
  const cityListContainer = document.getElementById('city-list-container');
  const cityListCloseBtn = document.getElementById('btn-city-list-close');
  const gameOverOverlay = document.getElementById('game-over-overlay');
  const btnGoTitle = document.getElementById('btn-go-title');
  const btnGoLoad = document.getElementById('btn-go-load');
  const hudButtons = Array.from(document.querySelectorAll('#hud [data-action]'));
  const MOBILE_BREAKPOINT = 900;
  const MOBILE_UI_HEIGHT_RATIO = 0.48;
  const MOBILE_UI_HEIGHT_MIN = 260;
  const MOBILE_UI_HEIGHT_MAX = 420;
  const SPEED_ORDER = [0, 1, 2, 3];
  const SPEED_LABELS = { 0: '停止', 1: '1x', 2: '2x', 3: '3x' };
  const hasTouchSupport = (() => {
    if (typeof window === 'undefined') return false;
    if ('ontouchstart' in window) return true;
    if (typeof navigator !== 'undefined') {
      const points = navigator.maxTouchPoints || navigator.msMaxTouchPoints || 0;
      return points > 0;
    }
    return false;
  })();
  const mobileModeButtons = [];
  const MOBILE_MODE_LABELS = {
    world: '世界',
    actions: '行動',
    info: '情報',
    story: 'ストーリー',
    system: 'システム',
  };
  const MOBILE_SYSTEM_EXTRA_ACTIONS = [
    { key: 'manage-military', label: '軍備編成' },
    { key: 'population-plan', label: '人口増加計画' },
    { key: 'rename-city', label: '都市改名' },
    { key: 'abdicate', label: '王位譲渡' },
  ];

  const MOBILE_MODE_ACTIONS = {
    world: [
      { actionId: 'toggle-2d', label: '2D表示' },
      { actionId: 'toggle-civ', label: '文明度' },
      { actionId: 'toggle-roads', label: '道路表示' },
    ],
    actions: [
      { actionId: 'select-capital', label: '首都選定', confirm: true, disabled: () => isCapitalDevelopmentLocked() },
      { actionId: 'develop', label: '開拓', confirm: true, disabled: () => isCapitalDevelopmentLocked() },
      { actionId: 'manage-military', label: '軍備編成', confirm: true },
    ],
    info: [
      { handler: () => openStoryTimelineOverlay(), label: '王命履歴' },
      { handler: () => openNationOverviewOverlay(), label: '国家情報' },
      { handler: () => showCityListOverlay(), label: '都市一覧' },
    ],
    story: [
      { handler: () => openStoryTimelineOverlay(), label: 'ストーリー履歴' },
      {
        handler: () => handleStoryEndRequest(),
        label: '譲る',
        disabled: () => !ensureStoryScenarioState()?.storyEndReady,
      },
      {
        handler: () => openPopulationPlanOverlay(),
        label: '人口増加計画',
        confirm: true,
        disabled: () => roles.player !== 'king',
      },
    ],
    system: [
      { actionId: 'save-world', label: '保存' },
      { actionId: 'load-world', label: '読み込み' },
      { actionId: 'back-title', label: 'タイトルへ' },
    ],
  };
  function isMobileUIEnabled() {
    return !!(document && document.body && document.body.classList.contains('mobile-ui-enabled'));
  }
  let mobileActiveMode = 'world';
  let orientationLockEl = null;
  let mobileContextPanel = null;
  let mobileInfoMirror = null;
  let mobileStatsMirror = null;
  let mobileModalShell = null;
  let mobileModalHeaderEl = null;
  let mobileModalBackBtn = null;
  let mobileModalTitleEl = null;
  let mobileContextActionsEl = null;
  let mobileContextTitleEl = null;
  let mobileContextSubtitleEl = null;
  let mobileSpeedIndicatorEl = null;
  let mobileInputBarEl = null;
  let mobileInputMessageEl = null;
  let mobileStoryInputField = null;
  let mobileStoryGenderSelect = null;
  let mobileInputPrimaryBtn = null;
  let mobileInputSecondaryBtn = null;
  let mobileInputNextBtn = null;
  let mobileConfirmAction = null;
  let mobileStorySetupCallback = null;
  let mobileInputMode = null;
  let mobileNewsPanelEl = null;
  let mobileNewsBodyEl = null;
  let mobileNewsTurnEl = null;
  let mobileSystemActionsEl = null;
  let mobileTickerEl = null;
  const mobileOverlayHistory = [];
  const mobileObservers = [];

  function requestCapitalSelection() {
    pendingCapitalSelection = true;
    pendingDevelopment = false;
    if (tileInfoEl) {
      tileInfoEl.textContent = '王都に指定したい都市をクリックしてください';
    }
    updateControlButtons();
  }

  function requestDevelopmentSelection() {
    pendingDevelopment = true;
    pendingCapitalSelection = false;
    if (tileInfoEl) {
      tileInfoEl.textContent = '開拓する場所をクリックしてください';
    }
    updateControlButtons();
  }
  const STORY_TIMELINE_LIMIT = 120;
  const MONTHLY_ARCHIVE_LIMIT = 12;
  const storyActionTimeline = [];
  const monthlyNewspapers = [];
  let skipMonthlyNewsAfterLoad = false;
  let lastMonthlyNewspaperTurn = -1;
  const aiActionLog = [];
  const AI_LOG_LIMIT = 12;
  const modeTransition = {
    active: false,
    overlay: null,
    start: 0,
    duration: 780,
    animationId: null,
    target: null,
  };
  const OPENING_WATCHED_KEY = 'openingWatched';
  const OPENING_AUDIO_URL = './music/bgm/game_op.wav';
  const OPENING_AUDIO_DURATION = 38;
  const PRE_OPEN_BLACK = 1;
  const POST_OPEN_BLACK = 1;
  const OPENING_DURATION = PRE_OPEN_BLACK + OPENING_AUDIO_DURATION + POST_OPEN_BLACK;
  const BETA_OPENING_DURATION = 40;
  const BETA_RING_LAYERS = 6;
  const BETA_HALO_POINTS = 14;
  const BETA_CONVERGING_COUNT = 18;
  const BETA_SYMBOL_CONFIG = [
    { radiusFactor: 0.45, dash: 8, gap: 6 },
    { radiusFactor: 0.58, dash: 4, gap: 6 },
    { radiusFactor: 0.7, dash: 2, gap: 10 },
  ];
  let openingAudioDataPromise = fetch(OPENING_AUDIO_URL)
    .then(res => res.ok ? res.arrayBuffer() : Promise.reject(new Error('audio fetch failed')))
    .catch(err => {
      console.warn('opening audio prefetch failed', err);
      return null;
    });
  let openingAudioCtx = null;
  let openingAudioBuffer = null;
  const openingState = {
    playing: false,
    overlay: null,
    canvas: null,
    ctx: null,
    animationId: null,
    startTime: 0,
    skippable: true,
    mode: null,
    onComplete: null,
    resolve: null,
    keyListener: null,
    pointerListener: null,
    audioSource: null,
    audioGain: null,
    completing: false,
  };

  
  // --- HUD の動的整形（候補アクション / ログなど）---
  (function setupHudEnhancements() {
    if (!hudEl) return;
    if (!candidateActionsRowEl) {
      candidateActionsRowEl = document.createElement('div');
      candidateActionsRowEl.id = 'candidate-actions-row';
      candidateActionsRowEl.className = 'controls';
      candidateActionsRowEl.style.borderTop = '1px solid #2a2f3a';
      candidateActionsRowEl.style.paddingTop = '4px';
      candidateActionsRowEl.style.marginTop = '4px';
      candidateActionsRowEl.style.display = 'none';
      const buildHudButton = (action, label) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.dataset.action = action;
        btn.textContent = label;
        btn.addEventListener('click', handleHUDAction);
        candidateActionsRowEl.appendChild(btn);
        return btn;
      };
      const actions = [
        { label: 'インフラ整備', action: 'candidate-infra' },
        { label: '治安維持', action: 'candidate-security' },
        { label: '魔法研究', action: 'candidate-magic' },
      ];
      actions.forEach(cfg => buildHudButton(cfg.action, cfg.label));
      if (!lawActionBtn) {
        lawActionBtn = buildHudButton('enact-law', '法律制定');
        lawActionBtn.style.display = 'none';
      }
      if (!frontierActionBtn) {
        frontierActionBtn = buildHudButton('develop-frontier', '未開の地');
        frontierActionBtn.style.display = 'none';
      }
      if (!roadManualBtn) {
        roadManualBtn = buildHudButton('road-maintenance', '街道整備');
        roadManualBtn.style.display = 'none';
      }
        if (!railManualBtn) {
          railManualBtn = buildHudButton('rail-maintenance', '馬車鉄道の敷設');
          railManualBtn.style.display = 'none';
        }
      const insertBefore = hudStatsEl || tileInfoEl || null;
      if (insertBefore) {
        hudEl.insertBefore(candidateActionsRowEl, insertBefore);
      } else {
        hudEl.appendChild(candidateActionsRowEl);
      }
    }
    if (!candidateLogEl) {
      candidateLogEl = document.createElement('div');
      candidateLogEl.id = 'candidate-log';
      candidateLogEl.style.fontSize = '11px';
      candidateLogEl.style.opacity = '0.9';
      candidateLogEl.style.marginTop = '2px';
      candidateLogEl.style.borderTop = '1px dashed #2a2f3a';
      candidateLogEl.style.paddingTop = '4px';
      candidateLogEl.style.display = 'none';
      const insertBeforeLog = tileInfoEl || null;
      if (insertBeforeLog) {
        hudEl.insertBefore(candidateLogEl, insertBeforeLog);
      } else {
        hudEl.appendChild(candidateLogEl);
      }
    }
  })();

  function ensureModeTransitionOverlay() {
    if (modeTransition.overlay) return modeTransition.overlay;
    const overlay = document.createElement('div');
    overlay.id = 'mode-transition-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';
    overlay.style.background = 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.4) 0%, rgba(3,6,15,0.9) 65%)';
    overlay.style.zIndex = '1100';
    overlay.style.mixBlendMode = 'screen';
    document.body.appendChild(overlay);
    modeTransition.overlay = overlay;
    return overlay;
  }

  function animateModeTransition(timestamp) {
    if (!modeTransition.active) return;
    if (!modeTransition.start) modeTransition.start = timestamp;
    const elapsed = timestamp - modeTransition.start;
    const progress = Math.min(1, elapsed / modeTransition.duration);
    const overlay = ensureModeTransitionOverlay();
    const center = 40 + progress * 20;
    overlay.style.background = `radial-gradient(circle at ${center}% ${center}%, rgba(255,255,255,${0.45 - progress * 0.3}) 0%, rgba(3,6,15,${0.85 * progress}) 75%)`;
    overlay.style.opacity = progress < 1 ? '1' : '0';
    if (progress >= 1) {
      modeTransition.active = false;
      modeTransition.start = 0;
      modeTransition.animationId = null;
    } else {
      modeTransition.animationId = requestAnimationFrame(animateModeTransition);
    }
  }

  function startModeTransitionAnimation(targetIs2D) {
    modeTransition.target = targetIs2D;
    modeTransition.active = true;
    modeTransition.start = 0;
    if (modeTransition.animationId) {
      cancelAnimationFrame(modeTransition.animationId);
    }
    modeTransition.animationId = requestAnimationFrame(animateModeTransition);
  }

  function recordAILog(message) {
    if (!message) return;
    aiActionLog.unshift({
      turn: currentTurn,
      text: message,
      timestamp: Date.now(),
    });
    if (aiActionLog.length > AI_LOG_LIMIT) aiActionLog.length = AI_LOG_LIMIT;
  }

  function ensureOpeningAudioBuffer() {
    if (typeof window === 'undefined') return Promise.resolve(null);
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return Promise.resolve(null);
    if (!openingAudioCtx) {
      openingAudioCtx = new AudioCtx();
    }
    if (openingAudioBuffer) {
      return openingAudioCtx
        .resume()
        .then(() => openingAudioBuffer)
        .catch(() => openingAudioBuffer);
    }
    return openingAudioDataPromise
      .then(raw => {
        if (!raw) return null;
        return openingAudioCtx.decodeAudioData(raw.slice(0));
      })
      .then(decoded => {
        if (!decoded) return null;
        openingAudioBuffer = decoded;
        return openingAudioCtx
          .resume()
          .then(() => openingAudioBuffer)
          .catch(() => openingAudioBuffer);
      })
      .catch(err => {
        console.error('opening audio ensure failed', err);
        return null;
      });
  }

  function startOpeningAudio() {
    return ensureOpeningAudioBuffer().then(buffer => {
      if (!buffer || !openingAudioCtx) return null;
      if (openingState.audioSource) {
        try {
          openingState.audioSource.stop();
        } catch {}
      }
      const source = openingAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = false;
      const gain = openingAudioCtx.createGain();
      gain.gain.value = 1;
      source.connect(gain).connect(openingAudioCtx.destination);
      const startAt = openingAudioCtx.currentTime + PRE_OPEN_BLACK;
      source.start(startAt);
      source.stop(startAt + OPENING_AUDIO_DURATION + 0.2);
      openingState.audioSource = source;
      openingState.audioGain = gain;
      return source;
    }).catch(err => {
      console.error('opening audio start failed', err);
    });
  }

  function fadeOutOpeningAudio(duration = 0.4) {
    if (!openingAudioCtx || !openingState.audioSource || !openingState.audioGain) {
      openingState.audioSource = null;
      openingState.audioGain = null;
      return Promise.resolve();
    }
    const now = openingAudioCtx.currentTime;
    const gain = openingState.audioGain;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);
    const source = openingState.audioSource;
    return new Promise(resolve => {
      try {
        source.stop(now + duration + 0.05);
      } catch {}
      setTimeout(() => {
        openingState.audioSource = null;
        openingState.audioGain = null;
        resolve();
      }, (duration + 0.1) * 1000);
    });
  }

  function createOpeningOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'opening-overlay';
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);
    return { overlay, canvas };
  }

  function drawBloomText(ctx, text, x, y, options = {}) {
    const {
      color = '#d8e6ff',
      size = 24,
      intensity = 3,
      alpha = 1,
    } = options;
    ctx.save();
    ctx.font = `${size}px "Noto Sans JP", "Hiragino Kaku Gothic Pro", "MS Gothic", "Meiryo", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = intensity; i >= 1; i--) {
      ctx.globalAlpha = (alpha * 0.1) * i;
      ctx.fillStyle = color;
      ctx.fillText(text, x + (i - 2) * 0.6, y + (i - 2) * 0.6);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function getBetaStage(elapsed) {
    const stage = Math.floor(elapsed / 10);
    return Math.min(3, Math.max(0, stage));
  }

  function drawBetaRingGrid(ctx, cx, cy, baseRadius, elapsed) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    for (let layer = 0; layer < BETA_RING_LAYERS; layer++) {
      const radius = baseRadius * (0.6 + layer * 0.08 + Math.sin(elapsed * 0.2 + layer) * 0.02);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.globalAlpha = 0.25 + layer * 0.05;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBetaMagicSigils(ctx, cx, cy, baseRadius, elapsed, intensity = 1) {
    ctx.save();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    BETA_SYMBOL_CONFIG.forEach((config, idx) => {
      const radius = baseRadius * config.radiusFactor;
      ctx.beginPath();
      for (let seg = 0; seg < 24; seg++) {
        const start = (seg / 24) * Math.PI * 2 + elapsed * 0.1 * (idx + 1);
        const end = start + (config.dash / 20);
        ctx.arc(cx, cy, radius, start, end);
      }
      ctx.globalAlpha = Math.max(0.2, Math.min(1, 0.35 + idx * 0.15)) * intensity;
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawBetaCityHalo(ctx, cx, cy, baseRadius, elapsed) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < BETA_HALO_POINTS; i++) {
      const angle = (i / BETA_HALO_POINTS) * Math.PI * 2 + elapsed * 0.15;
      const radius = baseRadius * (0.3 + Math.sin(elapsed * 0.4 + i) * 0.05);
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      const size = 6 + Math.sin(elapsed + i) * 3;
      ctx.beginPath();
      ctx.rect(px - size / 2, py - size / 2, size, size);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBetaCityClusters(ctx, cx, cy, baseRadius, elapsed, stageProgress) {
    ctx.save();
    const clusterCount = 12;
    for (let i = 0; i < clusterCount; i++) {
      const angle = (i / clusterCount) * Math.PI * 2 + stageProgress * Math.PI;
      const distance = baseRadius * (0.45 + 0.12 * Math.sin(elapsed * 0.3 + i));
      const height = 10 + stageProgress * 40 + Math.sin(elapsed * 0.5 + i) * 6;
      const width = 6 + Math.cos(elapsed * 0.4 + i) * 2;
      const px = cx + Math.cos(angle) * distance;
      const py = cy + Math.sin(angle) * distance;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = `rgba(255,255,255,${0.15 + stageProgress * 0.45})`;
      ctx.fillRect(-width / 2, -height, width, height);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBetaMapContours(ctx, cx, cy, baseRadius, elapsed, stageProgress) {
    ctx.save();
    const layerCount = 4;
    for (let layer = 0; layer < layerCount; layer++) {
      const radius = baseRadius * (0.38 + layer * 0.08);
      const offset = elapsed * 0.18 + layer;
      ctx.beginPath();
      for (let seg = 0; seg <= 32; seg++) {
        const angle = (seg / 32) * Math.PI * 2;
        const radial = radius + Math.sin(angle * 3 + offset) * baseRadius * 0.02;
        const px = cx + Math.cos(angle) * radial;
        const py = cy + Math.sin(angle) * radial;
        if (!seg) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + stageProgress * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const branchCount = 8;
    for (let i = 0; i < branchCount; i++) {
      const angle = (i / branchCount) * Math.PI * 2 + elapsed * 0.25;
      const inner = baseRadius * 0.2;
      const outer = baseRadius * 1.05;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + stageProgress * 0.25})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBetaConvergingShards(ctx, cx, cy, baseRadius, elapsed, stageProgress) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${0.1 + stageProgress * 0.35})`;
    for (let i = 0; i < BETA_CONVERGING_COUNT; i++) {
      const angle = (i / BETA_CONVERGING_COUNT) * Math.PI * 2 + elapsed * 0.45;
      const startRadius = baseRadius * (1.6 - stageProgress * 0.5);
      const endRadius = baseRadius * (0.65 + stageProgress * 0.1);
      const radius = startRadius * (1 - stageProgress) + endRadius * stageProgress;
      const px = cx + Math.cos(angle) * radius;
      const py = cy + Math.sin(angle) * radius;
      const tipRadius = radius * 0.72;
      const tx = cx + Math.cos(angle) * tipRadius;
      const ty = cy + Math.sin(angle) * tipRadius;
      const width = 6 + Math.sin(elapsed * 0.4 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(
        tx + Math.sin(angle) * width * 0.6,
        ty - Math.cos(angle) * width * 0.6
      );
      ctx.lineTo(
        tx - Math.sin(angle) * width * 0.6,
        ty + Math.cos(angle) * width * 0.6
      );
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBetaPowerRings(ctx, cx, cy, baseRadius, elapsed, stageProgress) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur = 12;
    const ringCount = 5;
    for (let i = 0; i < ringCount; i++) {
      const radius = baseRadius * (0.5 + i * 0.08 + stageProgress * 0.12);
      const offset = elapsed * 0.6 + i * 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, offset, offset + Math.PI * (1.0 + stageProgress * 0.4));
      ctx.strokeStyle = `rgba(255,255,255,${0.35 + stageProgress * 0.25})`;
      ctx.lineWidth = 1.4 + i * 0.4;
      ctx.stroke();
    }
    const beamCount = 6;
    for (let i = 0; i < beamCount; i++) {
      const angle = (i / beamCount) * Math.PI * 2 + elapsed * 0.7;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * baseRadius * 0.3, cy + Math.sin(angle) * baseRadius * 0.3);
      ctx.lineTo(cx + Math.cos(angle) * baseRadius * 1.1, cy + Math.sin(angle) * baseRadius * 1.1);
      ctx.strokeStyle = `rgba(255,255,255,${0.18 + stageProgress * 0.4})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    ctx.restore();
  }

  function previewTileColor(tile) {
    if (!tile) return '#10121a';
    switch (tile.base) {
      case BASE.SEA:
        return '#0c1c2a';
      case BASE.LAKE:
        return '#163144';
      case BASE.MOUNTAIN:
        return '#4d4d5b';
      case BASE.DESERT:
        return '#c39b50';
      case BASE.FOREST:
        return '#1d3a1f';
      case BASE.GRASS:
      default:
        return '#2e5b2a';
    }
  }

  function renderMapPreview(ctx, opacity) {
    if (!Array.isArray(map) || !map.length) return;
    const previewWidth = 220;
    const previewHeight = 140;
    const startX = 50;
    const startY = 30;
    const cols = Math.min(40, W);
    const rows = Math.min(22, H);
    const tileW = previewWidth / cols;
    const tileH = previewHeight / rows;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity * 0.9));
    for (let ry = 0; ry < rows; ry++) {
      const mapY = Math.floor((ry / rows) * H);
      for (let rx = 0; rx < cols; rx++) {
        const mapX = Math.floor((rx / cols) * W);
        const tile = map[mapY] && map[mapY][mapX];
        ctx.fillStyle = previewTileColor(tile);
        ctx.fillRect(startX + rx * tileW, startY + ry * tileH, tileW + 0.5, tileH + 0.5);
      }
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity * 0.8));
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * Math.min(1, opacity)})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX - 4, startY - 4, previewWidth + 8, previewHeight + 8);
    ctx.restore();
  }

  function hasOpeningWatchedFlag() {
    try {
      return Boolean(localStorage.getItem(OPENING_WATCHED_KEY));
    } catch {
      return false;
    }
  }

  function markOpeningWatchedFlag() {
    try {
      localStorage.setItem(OPENING_WATCHED_KEY, 'true');
    } catch {
      /* ignore */
    }
  }

  function handleOpeningSkipEvent(event) {
    if (!openingState.playing || !openingState.skippable) return;
    event.preventDefault();
    event.stopPropagation();
    finishOpening('skip');
  }

  function renderClassicOpeningFrame(timestamp) {
    if (!openingState.playing || !openingState.ctx) return;
    if (!openingState.startTime) {
      openingState.startTime = timestamp;
    }
    const elapsed = (timestamp - openingState.startTime) / 1000;
    const ctx = openingState.ctx;
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#03060f';
    ctx.fillRect(0, 0, width, height);

    if (elapsed >= 5 && elapsed < 12) {
      const text = '……ここはどこだ？‥‥‥';
      const progress = clamp((elapsed - 5) / 7, 0, 1);
      const count = Math.max(1, Math.min(text.length, Math.floor(text.length * progress)));
      drawBloomText(ctx, text.slice(0, count), centerX, 126, { size: 20 });
    }

    if (elapsed >= 12 && elapsed < 20) {
      if (elapsed < 15) {
        drawBloomText(ctx, '気づけばここにいた‥‥‥', centerX, 128, { size: 24, intensity: 2 });
      } else {
        const combined = '王国は、静かに傾いた。';
        const progress = clamp((elapsed - 15) / 5, 0, 1);
        const count = Math.max(3, Math.min(combined.length, Math.floor(combined.length * progress)));
        const display = combined.slice(0, count);
        drawBloomText(ctx, display, centerX, 128, { size: 24, intensity: 2 });
      }
    }

    if (elapsed >= 20 && elapsed < 30) {
      const progress = clamp((elapsed - 20) / 10, 0, 1);
      const rows = 6;
      const baseY = 170;
      for (let i = 0; i < rows; i++) {
        const threshold = i / rows;
        if (progress <= threshold) continue;
        const local = clamp((progress - threshold) / (1 / rows), 0, 1);
        const y = baseY - i * 18;
        ctx.fillStyle = `rgba(60,120,160,${0.2 + local * 0.5})`;
        ctx.fillRect(32, y - local * 8, 256, 14 + local * 12);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 40; x < 280; x += 32) {
        ctx.moveTo(x, 60);
        ctx.lineTo(x, 190);
      }
      ctx.stroke();
      const lines = ['・交易税の急激な引き上げ', '・治安維持費の削減', '・地方評議会の軽視'];
      lines.forEach((line, idx) => {
        const appear = 20.8 + idx * 1.5;
        if (elapsed >= appear) {
          const localAlpha = clamp((elapsed - appear) / 1.2, 0, 1);
          ctx.globalAlpha = localAlpha;
          drawBloomText(ctx, line, centerX, 98 + idx * 18, { size: 18, color: '#d7e4ff' });
          ctx.globalAlpha = 1;
        }
      });
    }

    if (elapsed >= 30 && elapsed < 36) {
      ctx.strokeStyle = 'rgba(220,228,240,0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 52, 240, 108);
      ctx.strokeRect(46, 60, 228, 30);
      ctx.strokeRect(46, 96, 228, 46);
      ctx.fillStyle = '#e6f0ff';
      ctx.font = `12px "Noto Sans JP", "Hiragino Kaku Gothic Pro", "MS Gothic", "Meiryo", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('王命新聞', centerX, 70);
      ctx.fillText('王が姿を消す\n後継者候補を召喚へ', centerX, 140);
    }

    if (elapsed >= 36 && elapsed < 40) {
      drawBloomText(ctx, 'RAIL TRAIL', centerX, 110, { size: 32, color: '#ffffff', intensity: 4 });
      const subtitle = '蒸気と航路の記録';
      const subAlpha = clamp((elapsed - 36) / 0.5, 0, 1);
      ctx.globalAlpha = subAlpha;
      ctx.font = `12px "Noto Sans JP", "Hiragino Kaku Gothic Pro", "MS Gothic", "Meiryo", sans-serif`;
      ctx.fillStyle = '#e4f0ff';
      ctx.fillText(subtitle, centerX, 138);
      ctx.globalAlpha = 1;
    }

    if (elapsed >= 34) {
      const previewOpacity = clamp((elapsed - 34) / 6, 0, 1);
      renderMapPreview(ctx, previewOpacity);
    }

    if (elapsed >= OPENING_DURATION) {
      finishOpening('complete');
      return;
    }

    openingState.animationId = requestAnimationFrame(openingState.renderFn || renderClassicOpeningFrame);
  }

  function renderBetaOpeningFrame(timestamp) {
    if (!openingState.playing || !openingState.ctx) return;
    if (!openingState.startTime) {
      openingState.startTime = timestamp;
    }
    const elapsed = (timestamp - openingState.startTime) / 1000;
    const ctx = openingState.ctx;
    const canvas = ctx.canvas;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#01030a';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h * 0.45;
    const baseRadius = Math.min(w, h) * (0.32 + 0.03 * Math.sin(elapsed * 0.2));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const stage = getBetaStage(elapsed);
    const stageProgress = Math.min(1, Math.max(0, (elapsed - stage * 10) / 10));
    const sigilIntensity = Math.max(0.4, 1 - stage * 0.15);
    drawBetaRingGrid(ctx, cx, cy, baseRadius, elapsed);
    drawBetaMagicSigils(ctx, cx, cy, baseRadius, elapsed, sigilIntensity);
    drawBetaCityHalo(ctx, cx, cy, baseRadius, elapsed);
    const formationProgress = stage < 2 ? stageProgress : 1;
    drawBetaConvergingShards(ctx, cx, cy, baseRadius, elapsed, formationProgress);
    if (stage >= 1) {
      drawBetaCityClusters(ctx, cx, cy, baseRadius, elapsed, stageProgress);
    }
    if (stage >= 2) {
      drawBetaMapContours(ctx, cx, cy, baseRadius, elapsed, stageProgress);
    }
    if (stage >= 3) {
      drawBetaPowerRings(ctx, cx, cy, baseRadius, elapsed, stageProgress);
    }
    const shimmerAngle = elapsed * (0.4 + stage * 0.05);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.8 + stage * 0.2;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.85, shimmerAngle, shimmerAngle + Math.PI / 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.85, shimmerAngle + Math.PI, shimmerAngle + Math.PI + Math.PI / 6);
    ctx.stroke();
    ctx.restore();
    if (elapsed >= 30) {
      ctx.save();
      ctx.textAlign = 'center';
      const logoY = h * 0.85;
      const gradient = ctx.createLinearGradient(cx - 120, logoY - 16, cx + 120, logoY + 16);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.45, '#d2e8ff');
      gradient.addColorStop(1, '#8fb1ff');
      ctx.fillStyle = gradient;
      ctx.font = `48px "Noto Sans JP", "Hiragino Kaku Gothic Pro", "MS Gothic", "Meiryo", sans-serif`;
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = 16;
      const logoAlpha = Math.min(1, (elapsed - 30) / 2);
      ctx.globalAlpha = logoAlpha;
      ctx.fillText('railTrail', cx, logoY);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 0.9;
      ctx.strokeText('railTrail', cx, logoY);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    if (elapsed >= BETA_OPENING_DURATION) {
      finishOpening('complete');
      return;
    }
    openingState.animationId = requestAnimationFrame(openingState.renderFn || renderBetaOpeningFrame);
  }

  async function finishOpening(reason) {
    if (!openingState.playing || openingState.completing) return;
    openingState.completing = true;
    openingState.playing = false;
    if (openingState.animationId) {
      cancelAnimationFrame(openingState.animationId);
    }
    if (openingState.keyListener) {
      window.removeEventListener('keydown', openingState.keyListener, true);
      openingState.keyListener = null;
    }
    if (openingState.pointerListener) {
      window.removeEventListener('pointerdown', openingState.pointerListener, true);
      openingState.pointerListener = null;
    }
    await fadeOutOpeningAudio(0.4);
    if (openingState.overlay && openingState.overlay.parentNode) {
      openingState.overlay.parentNode.removeChild(openingState.overlay);
    }
    if (openingState.mode === 'story') {
      markOpeningWatchedFlag();
    }
    const onComplete = openingState.onComplete;
    const resolver = openingState.resolve;
    openingState.overlay = null;
    openingState.canvas = null;
    openingState.ctx = null;
    openingState.animationId = null;
    openingState.startTime = 0;
    openingState.mode = null;
    openingState.onComplete = null;
    openingState.resolve = null;
    openingState.skippable = true;
    openingState.variant = 'classic';
    openingState.renderFn = null;
    openingState.completing = false;
    if (typeof resolver === 'function') resolver();
    if (typeof onComplete === 'function') onComplete();
  }

  function playOpening(options = {}) {
    if (openingState.playing) return Promise.resolve();
    const { mode = 'gallery', skippable = true, variant = 'classic', onComplete } = options;
    const { overlay, canvas } = createOpeningOverlay();
    openingState.playing = true;
    openingState.overlay = overlay;
    openingState.canvas = canvas;
    openingState.ctx = canvas.getContext('2d');
    openingState.skippable = Boolean(skippable);
    openingState.mode = mode;
    openingState.variant = variant === 'beta' ? 'beta' : 'classic';
    openingState.renderFn = openingState.variant === 'beta' ? renderBetaOpeningFrame : renderClassicOpeningFrame;
    openingState.onComplete = onComplete;
    openingState.startTime = 0;
    openingState.resolve = null;
    openingState.completing = false;
    openingState.keyListener = event => {
      handleOpeningSkipEvent(event);
    };
    openingState.pointerListener = event => {
      handleOpeningSkipEvent(event);
    };
    window.addEventListener('keydown', openingState.keyListener, true);
    window.addEventListener('pointerdown', openingState.pointerListener, true);
    openingState.animationId = requestAnimationFrame(openingState.renderFn);
    startOpeningAudio().catch(() => {});
    return new Promise(resolve => {
      openingState.resolve = resolve;
    });
  }

  let bgmPermissionState = 'unknown'; // 'unknown' | 'granted' | 'denied'
  let bgmUserEnabled = false;
  let bgmBlobUrl = './music/bgm/game_theme.wav';

  const INITIAL_CHARACTERS = {
      player: {
        id: "player",
        name: null, // Will be set from player input
        role: null,
        loyalty: 50,
      stats: { economy: 70, infrastructure: 80, administration: 50, military: 30, legitimacy: 10 },
      support: { citizens: 50, merchants: 50, nobility: 10, military: 10, clergy: 10 },
      behavior: { ambition: 40, caution: 60, flexibility: 70 }
    },
    marshal: {
      id: "marshal",
      name: "ラウル・グレイヴ",
      role: null,
      loyalty: 60,
      loyalty: 60,
      stats: { economy: 30, infrastructure: 40, administration: 50, military: 85, legitimacy: 40 },
      support: { citizens: 20, merchants: 10, nobility: 40, military: 80, clergy: 20 },
      behavior: { ambition: 70, caution: 80, flexibility: 20 }
    },
    princess: {
      id: "princess",
      name: "リリア・アステル",
      role: null,
      loyalty: 65,
      loyalty: 65,
      stats: { economy: 40, infrastructure: 30, administration: 45, military: 25, legitimacy: 85 },
      support: { citizens: 40, merchants: 20, nobility: 30, military: 10, clergy: 70 },
      behavior: { ambition: 30, caution: 50, flexibility: 60 }
    },
    council: {
      id: "council",
      name: "セシル・ヴァレン",
      role: null,
      loyalty: 55,
      loyalty: 55,
      stats: { economy: 60, infrastructure: 40, administration: 85, military: 30, legitimacy: 30 },
      support: { citizens: 30, merchants: 60, nobility: 40, military: 10, clergy: 10 },
      behavior: { ambition: 60, caution: 70, flexibility: 40 }
    }
    };

  const INITIAL_CHARACTERS_V2 = {
    player: {
      id: "player",
      name: null, // Will be set from player input
      role: null,
      stats: { economy: 70, infrastructure: 80, administration: 50, military: 30, legitimacy: 10 },
      support: { citizens: 50, merchants: 50, nobility: 10, military: 10, clergy: 10 },
      behavior: { ambition: 40, caution: 60, flexibility: 70 }
    },
    marshal: {
      id: "marshal",
      name: "ラウル・グレイヴ",
      role: null,
      stats: { economy: 30, infrastructure: 40, administration: 50, military: 85, legitimacy: 40 },
      support: { citizens: 20, merchants: 10, nobility: 40, military: 80, clergy: 20 },
      behavior: { ambition: 70, caution: 80, flexibility: 20 }
    },
    princess: {
      id: "princess",
      name: "リリア・アステル",
      role: null,
      stats: { economy: 40, infrastructure: 30, administration: 45, military: 25, legitimacy: 85 },
      support: { citizens: 40, merchants: 20, nobility: 30, military: 10, clergy: 70 },
      behavior: { ambition: 30, caution: 50, flexibility: 60 }
    },
    council: {
      id: "council",
      name: "セシル・ヴァレン",
      role: null,
      stats: { economy: 60, infrastructure: 40, administration: 85, military: 30, legitimacy: 30 },
      support: { citizens: 30, merchants: 60, nobility: 40, military: 10, clergy: 10 },
      behavior: { ambition: 60, caution: 70, flexibility: 40 }
    },
  };
  
    const ROLE_BONUS = {
    king:       { legitimacy:+20 },
    chancellor: { economy:+10, administration:+15 },
    marshal:    { military:+20 },
    speaker:    { legitimacy:+10, administration:+10 },
    advisor:    { economy:+5, infrastructure:+5 }
  };

  let characters = {};
  
  const player = {
    profile: {
      name: '',
      gender: 'undisclosed',
    },
    proposedLaw: null,
  };
  
  function initCharacters() {
    // deep copy base data
    characters = JSON.parse(JSON.stringify(INITIAL_CHARACTERS_V2));
    // inject current player profile name / roles
    if (characters.player) {
      if (player.profile && player.profile.name) {
        characters.player.name = player.profile.name;
      }
      characters.player.role = roles.player || null;
    }
    if (characters.marshal) characters.marshal.role = roles.marshal || null;
    if (characters.princess) characters.princess.role = roles.princess || null;
    if (characters.council) characters.council.role = roles.council || null;
  }

  const ROLE_TEMPLATES = {
    player:   { marshal:'marshal',  princess:'speaker',  council:'chancellor' },
    marshal:  { player:'chancellor', princess:'speaker', council:'advisor' },
    princess: { player:'chancellor', marshal:'marshal',  council:'speaker' },
    council:  { player:'advisor',   marshal:'marshal',  princess:'speaker' },
  };

    const roles = {
      player: null,
      marshal: null,
      princess: null,
      council: null,
    };
  
    // キャラクター候補（名前アクセス用ビュー）
    const CANDIDATES = [
      {
        id: 'player',
        get name() {
          const char = characters.player;
          return (char && char.name) || (player.profile && player.profile.name) || 'プレイヤー';
        },
        set name(value) {
          if (!characters.player) initCharacters();
          characters.player.name = value;
          if (!player.profile.name) {
            player.profile.name = value || '';
          }
        },
      },
      {
        id: 'marshal',
        get name() {
          const char = characters.marshal;
          const base = INITIAL_CHARACTERS_V2.marshal;
          return (char && char.name) || (base && base.name) || 'Marshal';
        },
        set name(value) {
          if (!characters.marshal) initCharacters();
          characters.marshal.name = value;
        },
      },
      {
        id: 'princess',
        get name() {
          const char = characters.princess;
          const base = INITIAL_CHARACTERS_V2.princess;
          return (char && char.name) || (base && base.name) || 'Princess';
        },
        set name(value) {
          if (!characters.princess) initCharacters();
          characters.princess.name = value;
        },
      },
      {
        id: 'council',
        get name() {
          const char = characters.council;
          const base = INITIAL_CHARACTERS_V2.council;
          return (char && char.name) || (base && base.name) || 'Council';
        },
        set name(value) {
          if (!characters.council) initCharacters();
          characters.council.name = value;
          },
        },
      ];

    function getCharacter(id) {
      return characters[id] || null;
    }

    function getCharacterEffectiveStats(id) {
      const char = getCharacter(id);
      if (!char || !char.stats) return null;
      const role = roles[id] || char.role || null;
      const bonus = ROLE_BONUS[role] || {};
      const result = { ...char.stats };
      for (const key in bonus) {
        const base = Number(result[key] ?? 0);
        const delta = Number(bonus[key] ?? 0);
        let value = base + delta;
        if (typeof clamp === 'function') {
          value = clamp(value, 0, 100);
        }
        result[key] = value;
      }
      return result;
    }

      function adjustCharacterValue(id, section, key, delta) {
        const char = getCharacter(id);
        if (!char || !char[section] || typeof delta !== 'number') return;
        const current = Number(char[section][key] ?? 0);
        let next = current + delta;
        if (typeof clamp === 'function') {
          next = clamp(next, 0, 100);
        }
        char[section][key] = next;
      }

      function ensureCharacterTrust(id) {
        const char = getCharacter(id);
        if (!char) return null;
        if (!char.trust || typeof char.trust !== 'object') {
          char.trust = { global: 50, cities: {} };
        } else {
          if (typeof char.trust.global !== 'number') {
            char.trust.global = 50;
          }
          if (!char.trust.cities || typeof char.trust.cities !== 'object') {
            char.trust.cities = {};
          }
        }
        return char;
      }

      function adjustGlobalTrust(id, delta) {
        if (typeof delta !== 'number') return;
        const char = ensureCharacterTrust(id);
        if (!char) return;
        const current = Number(char.trust.global ?? 50);
        let next = current + delta;
        if (typeof clamp === 'function') {
          next = clamp(next, 0, 100);
        }
        char.trust.global = next;
      }

      function adjustCityTrust(id, cityId, delta) {
        if (typeof delta !== 'number') return;
        const char = ensureCharacterTrust(id);
        if (!char) return;
        const key = String(cityId);
        const current = Number(
          (char.trust.cities && char.trust.cities[key] != null)
            ? char.trust.cities[key]
            : char.trust.global ?? 50
        );
        let next = current + delta;
        if (typeof clamp === 'function') {
          next = clamp(next, 0, 100);
        }
        char.trust.cities[key] = next;
      }

      function getCityTrust(id, cityId) {
        const char = getCharacter(id);
        if (!char || !char.trust) return 50;
        const key = String(cityId);
        let value = char.trust.cities && char.trust.cities[key];
        if (typeof value !== 'number') {
          value = typeof char.trust.global === 'number' ? char.trust.global : 50;
        }
        if (typeof clamp === 'function') {
          return clamp(value, 0, 100);
        }
        return value;
      }

      // 王候補としての行動（インフラ整備・治安維持・魔法研究）
      // actionId: 'infrastructure' | 'security' | 'magic'
      // actorId: 'player' など, cityId: 対象都市ID (任意)
      function applyCandidateAction(actionId, actorId = 'player', cityId = null, options = {}) {
        const opts = options || {};
        // 古い 'magic' 呼び出しを 'magic_research' に集約
        if (actionId === 'magic') actionId = 'magic_research';
        switch (actionId) {
          case 'infrastructure':
            adjustCharacterValue(actorId, 'stats', 'infrastructure', +5);
            adjustCharacterValue(actorId, 'stats', 'economy', +3);
            adjustCharacterValue(actorId, 'support', 'citizens', +4);
            adjustCharacterValue(actorId, 'support', 'merchants', +4);
            adjustGlobalTrust(actorId, +3);
            if (cityId != null) adjustCityTrust(actorId, cityId, +6);
            break;
          case 'security':
            adjustCharacterValue(actorId, 'stats', 'military', +5);
            adjustCharacterValue(actorId, 'stats', 'administration', +3);
            adjustCharacterValue(actorId, 'support', 'military', +5);
            adjustCharacterValue(actorId, 'support', 'citizens', +3);
            adjustCharacterValue(actorId, 'support', 'nobility', +2);
            adjustGlobalTrust(actorId, +3);
            if (cityId != null) adjustCityTrust(actorId, cityId, +6);
            break;
          case 'magic_research':
            adjustCharacterValue(actorId, 'stats', 'administration', +3);
            adjustCharacterValue(actorId, 'stats', 'legitimacy', +4);
            adjustCharacterValue(actorId, 'support', 'clergy', +4);
            adjustCharacterValue(actorId, 'support', 'merchants', +2);
            adjustGlobalTrust(actorId, +2);
            if (cityId != null) adjustCityTrust(actorId, cityId, +4);
            break;
          case 'horsecar_research': {
            const research = ensureHorsecarResearch();
            research.progress = Math.min(100, (research.progress || 0) + 30);
            if (research.progress >= 100 && !research.completed) {
              research.completed = true;
              const headline = '馬車交通の黎明';
              const summary = '馬車輸送に関する理論が結実し、王都では鉄道への道筋が見えてきました。';
              showNewspaperHeadline(headline, summary);
            }
            break;
          }
            case 'horsecar_rail': {
              const state = getWorldState();
              if (!state.horsecarLines) state.horsecarLines = [];
              const lines = state.horsecarLines;
              const demandLevel = clamp(Number(opts.demandLevel) || 1, 1, 6);
              let path = null;
              if (Array.isArray(opts.path) && opts.path.length >= 2) {
                path = opts.path
                  .map(pt => ({
                    x: clamp(Math.round(Number(pt.x)), 0, W - 1),
                    y: clamp(Math.round(Number(pt.y)), 0, H - 1),
                  }))
                  .filter(pt => Number.isFinite(pt.x) && Number.isFinite(pt.y));
                if (path.length < 2) path = null;
              }
              const resolveCityAtPoint = point => {
                if (!point) return null;
                return cities.find(city => city && city.x === point.x && city.y === point.y) || null;
              };
              const startCity = path ? resolveCityAtPoint(path[0]) : null;
              const endCity = path ? resolveCityAtPoint(path[path.length - 1]) : null;
              const providedA = Number(opts.cityAId);
              const providedB = Number(opts.cityBId);
              const cityAId = startCity ? startCity.id : (Number.isFinite(providedA) ? providedA : null);
              const cityBId = endCity ? endCity.id : (Number.isFinite(providedB) ? providedB : null);
              if (!path && Number.isFinite(cityAId) && Number.isFinite(cityBId)) {
                const cityA = cities[cityAId];
                const cityB = cities[cityBId];
                if (cityA && cityB) {
                  path = [
                    { x: cityA.x, y: cityA.y },
                    { x: cityB.x, y: cityB.y },
                  ];
                }
              }
              let line = null;
              if (Number.isFinite(cityAId) && Number.isFinite(cityBId)) {
                line = lines.find(entry => (
                  (entry.cityAId === cityAId && entry.cityBId === cityBId) ||
                  (entry.cityAId === cityBId && entry.cityBId === cityAId)
                ));
              }
              if (!line) {
                line = {
                  id: `rail-line-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                  cityAId,
                  cityBId,
                  demand: 0,
                };
                lines.push(line);
              } else if (!line.id) {
                line.id = `rail-line-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
              }
                lines.push(line);
              line.demand = Math.min(6, (line.demand || 0) + demandLevel);
              if (path) {
                line.path = path;
              }
              const cityA = Number.isFinite(cityAId) ? cities[cityAId] : null;
              const cityB = Number.isFinite(cityBId) ? cities[cityBId] : null;
              [cityA, cityB].forEach(city => {
                if (!city) return;
                city.prosperity = clamp((city.prosperity || 1) + demandLevel * 0.15, 0, 12);
                city.stability = clamp((city.stability || 50) + demandLevel, 0, 120);
                city.military = clamp((city.military || 80) + demandLevel * 1.2, 20, 300);
              });
              adjustCharacterValue(actorId, 'support', 'merchants', demandLevel * 2);
              adjustCharacterValue(actorId, 'support', 'citizens', demandLevel);
              markMapDirty();
              break;
            }
          case 'road_construction': {
            const cityAId = Number(opts.cityAId);
            const cityBId = Number(opts.cityBId);
            if (cityAId === cityBId || !Number.isFinite(cityAId) || !Number.isFinite(cityBId)) break;
            const cityA = cities[cityAId];
            const cityB = cities[cityBId];
            if (!cityA || !cityB) break;
            
            const path = findPath({x:cityA.x, y:cityA.y}, {x:cityB.x, y:cityB.y});
            if (path) {
              let minLevel = 99;
              path.forEach(p => {
                const t = map[p.y][p.x];
                minLevel = Math.min(minLevel, t.road || 0);
              });
              const targetLevel = (minLevel >= 1) ? 2 : 1;
              path.forEach(p => {
                const t = map[p.y][p.x];
                t.road = Math.max(t.road || 0, targetLevel);
              });
              adjustCharacterValue(actorId, 'stats', 'infrastructure', +3);
              adjustCharacterValue(actorId, 'support', 'merchants', +3);
              adjustGlobalTrust(actorId, +2);
              const headline = targetLevel > 1 ? '主要街道の石畳化' : '新規街道の開通';
              const summary = `${cityA.name} と ${cityB.name} を結ぶ街道が${targetLevel > 1 ? '整備・強化' : '建設'}されました。物流の活性化が期待されます。`;
              showNewspaperHeadline(headline, summary);
            }
            break;
          }
          default:
            break;
        }
        if (actionId === 'security' && Array.isArray(opts.regionCouncil) && opts.regionCouncil.length) {
          const seen = new Set();
          opts.regionCouncil.forEach(rawId => {
            const cid = Number(rawId);
            if (!Number.isFinite(cid) || seen.has(cid)) return;
            seen.add(cid);
            const city = cities[cid];
            if (city) {
              city.stability = clamp((city.stability || 50) + 12, 0, 120);
              adjustCityTrust(actorId, cid, +4);
            }
          });
          adjustGlobalTrust(actorId, +2);
        }
        if (actionId === 'magic_research' && opts.largeInstitute && cityId != null) {
          const list = getResearchInstitutes();
          let institute = list.find(entry => entry.cityId === cityId);
          if (!institute) {
            institute = { cityId, progress: 0, breakthroughs: 0 };
            list.push(institute);
          }
          institute.progress = Math.min(100, (institute.progress || 0) + 30);
          const state = getWorldState();
          state.magicProgress = (state.magicProgress || 0) + 0.5;
          if (institute.progress >= 100) {
            institute.progress = 0;
            institute.breakthroughs = (institute.breakthroughs || 0) + 1;
            state.magicProgress = (state.magicProgress || 0) + 1;
            const city = cities[cityId];
            const headline = `魔法研究所：${city ? city.name : '都市'}`;
            const summary = `大規模研究所が新たな法術を発表し、民心と学派の信頼が増しました。`;
            showNewspaperHeadline(headline, summary);
          }
        }
      }

      // --- 行動システム: コスト計算・制限・クールダウン共通処理 ---
      const ACTION_DISPLAY_NAMES = {
        infrastructure: 'インフラ整備',
        security: '治安維持',
        magic_research: '魔法研究',
        horsecar_research: '馬車研究',
        horsecar_rail: '馬車鉄道',
        road_construction: '街道建設',
        frontier_development: '開拓',
        magic: '魔法研究',
        story_pre_succession: '王命前夜',
        story_prologue_failure: '去年の王の失策',
        story_building_era: '建設の時代',
        story_politics_era: '政治の時代',
        story_division_era: '分裂の時代',
        metropolitan_cluster: '都市圏成長',
        population_plan: '人口増加計画',
      };
      const ACTION_DEFS = {
        infrastructure: {
          id: 'infrastructure',
          scope: 'city',
          cooldownTurns: 2,
          phaseCosts: {
            succession: { time: 1 },
            governance: { time: 1, budget: 10, authority: 2 },
          },
        },
        security: {
          id: 'security',
          scope: 'city',
          cooldownTurns: 1,
          phaseCosts: {
            succession: { time: 1 },
            governance: { time: 1, authority: 3 },
          },
        },
        magic_research: {
          id: 'magic_research',
          scope: 'world',
          cooldownTurns: 0,
          phaseCosts: {
            succession: { time: 1 },
            governance: { time: 1, budget: 5 },
          },
        },
        horsecar_research: {
          id: 'horsecar_research',
          scope: 'world',
          cooldownTurns: 1,
          phaseCosts: {
            succession: { time: 1 },
            governance: { time: 1, authority: 4, budget: 8 },
          },
        },
        horsecar_rail: {
          id: 'horsecar_rail',
          scope: 'world',
          cooldownTurns: 2,
          phaseCosts: {
            succession: { time: 1 },
            governance: { time: 1, authority: 6, budget: 15 },
          },
        },
        road_construction: {
          id: 'road_construction',
          scope: 'world',
          cooldownTurns: 1,
          phaseCosts: {
            succession: { time: 1 },
            governance: { time: 1, authority: 3, budget: 10 },
          },
        },
        frontier_development: {
          id: 'frontier_development',
          scope: 'world',
          cooldownTurns: 3,
          phaseCosts: {
            succession: { time: 1 },
            governance: { time: 1, authority: 4, budget: 12 },
          },
        },
      };

      function getActionDef(actionId) {
        return ACTION_DEFS[actionId] || null;
      }

      function getActorSafe(id) {
        return ACTORS.includes(id) ? id : 'player';
      }

      function getCooldownKey(def, cityId) {
        if (!def) return '';
        if (def.scope === 'city' && cityId != null) return `${def.id}:${cityId}`;
        return def.id;
      }

      function getRemainingCooldown(actorId, def, cityId) {
        const id = getActorSafe(actorId);
        const table = actorCooldowns[id] || {};
        const key = getCooldownKey(def, cityId);
        const v = table[key];
        return typeof v === 'number' ? v : 0;
      }

      function setCooldown(actorId, def, cityId) {
        if (!def || !def.cooldownTurns) return;
        const id = getActorSafe(actorId);
        const table = actorCooldowns[id] || (actorCooldowns[id] = {});
        const key = getCooldownKey(def, cityId);
        table[key] = def.cooldownTurns;
      }

      function tickActionTurnIfNeeded() {
        const expected = Math.floor(Math.max(0, currentTurn) / ACTION_TURN_LENGTH);
        if (expected === actionTurnIndex) return;
        actionTurnIndex = expected;
        // 行動ポイントをリセットし、クールダウンを1減少
      ACTORS.forEach(id => {
        actorActionPoints[id] = 2;
        actorLastActionId[id] = null;
        const table = actorCooldowns[id] || {};
        for (const key in table) {
            if (!Object.prototype.hasOwnProperty.call(table, key)) continue;
            table[key] = Math.max(0, (table[key] | 0) - 1);
          if (table[key] === 0) delete table[key];
          }
        });
        // 権威と抽象予算を少しずつ回復（詰み防止）
        ACTORS.forEach(id => {
          actorAuthority[id] = Math.min(actorAuthority[id] + 2, 20);
        });
        abstractBudget = Math.min(abstractBudget + 5, 50);
        tickKingLawCooldowns();
      }

      function getPhaseCost(def) {
        if (!def || !def.phaseCosts) return null;
        const costs = def.phaseCosts[storyPhase] || null;
        return costs || null;
      }

      function canPayActionCost(actorId, def, cityId) {
        const id = getActorSafe(actorId);
        const cost = getPhaseCost(def);
        if (!cost) return false;
        if ((actorActionPoints[id] | 0) <= 0) return false;
        // 連続同一行動は禁止
        if (actorLastActionId[id] && actorLastActionId[id] === def.id) return false;
        // クールダウン中なら不可
        if (getRemainingCooldown(id, def, cityId) > 0) return false;
        const needAuth = cost.authority | 0;
        const needBudget = cost.budget | 0;
        if (needAuth > 0 && actorAuthority[id] < needAuth) return false;
        if (needBudget > 0 && abstractBudget < needBudget) return false;
        return true;
      }

      function payActionCost(actorId, def) {
        const id = getActorSafe(actorId);
        const cost = getPhaseCost(def);
        if (!cost) return;
        actorActionPoints[id] = Math.max(0, (actorActionPoints[id] | 0) - (cost.time || 1));
        if (cost.authority) {
          actorAuthority[id] = Math.max(0, actorAuthority[id] - cost.authority);
        }
        if (cost.budget) {
          abstractBudget = Math.max(0, abstractBudget - cost.budget);
        }
        actorLastActionId[id] = def.id;
      }

      // プレイヤー / AI 共通の行動実行ラッパー
      function tryExecuteStoryAction(actionId, actorId, cityId, options) {
        const opts = options || {};
        const logContext = { ...opts, cityId: cityId != null ? cityId : null };
        let shouldLogStoryAction = true;
        const id = getActorSafe(actorId);
        const def = getActionDef(actionId);
        if (!def) return false;
        tickActionTurnIfNeeded();
        if (!canPayActionCost(id, def, cityId)) {
          if (opts.showReason && tileInfoEl && id === 'player') {
            tileInfoEl.textContent = 'このターンではこれ以上その行動は実行できません（コスト・クールダウン・連続使用制限）';
          }
          return false;
        }
        // 実際の効果は既存の applyCandidateAction に委譲
        applyCandidateAction(actionId, id, cityId, opts);
        // 都市パラメータなど、簡単な効果を追加
        if (cityId != null && Array.isArray(cities) && cities[cityId]) {
          const city = cities[cityId];
          if (actionId === 'infrastructure') {
            city.infrastructure = (city.infrastructure || 0) + 1;
            city.growthRate = (city.growthRate || 0) + 0.05;
          } else if (actionId === 'security') {
            city.stability = (city.stability || 0) + 10;
          }
        }
        if (actionId === 'magic_research') {
          const w = getWorldState();
          const base = typeof w.magicProgress === 'number' ? w.magicProgress : 0;
          const bonus = base > 30 ? 0.5 : base > 10 ? 0.8 : 1;
          w.magicProgress = base + bonus + (opts.largeInstitute ? 0.5 : 0);
        }
        if (actionId === 'frontier_development' && opts.frontierTile) {
          const tile = opts.frontierTile;
          const created = createFrontierVillage(tile.x, tile.y);
          if (created) {
            const headline = `開拓地：${created.name || '新都市'}`;
            const summary = '未開の地に新たな拠点が築かれました。王の覇気が国境を押し広げます。';
            showNewspaperHeadline(headline, summary);
            markWorldDirty();
            if (tileInfoEl) {
              tileInfoEl.textContent = `幻の地が都市 ${created.name} に生まれました`;
            }
            updateHudStats();
            render();
            logContext.storyLabel = `${created.name || '新都市'} を開拓`;
            logContext.cityId = created.id;
            logContext.frontierTile = tile;
          } else if (tileInfoEl) {
            tileInfoEl.textContent = 'その場所は開拓できません';
            shouldLogStoryAction = false;
          }
        }
        if (shouldLogStoryAction) {
          recordStoryAction(id, actionId, logContext);
        }
        payActionCost(id, def);
        setCooldown(id, def, cityId);
        updateKingAIState();
        return true;
      }

      function resetActionSystem(forStory) {
        actionTurnIndex = Math.floor(Math.max(0, currentTurn) / ACTION_TURN_LENGTH);
        ACTORS.forEach(id => {
          actorActionPoints[id] = 2;
          actorLastActionId[id] = null;
          actorCooldowns[id] = {};
          actorAuthority[id] = 10;
        });
        abstractBudget = 20;
        if (forStory) {
          storyPhase = 'succession';
        }
        kingLawCooldowns = {};
        kingAI.skipLawThisTurn = false;
        kingAI.proposalsShown = false;
      }

      function getPlayerRoleFromRank(rank) {
        if (rank === 2) return 'chancellor';
        if (rank === 3) return 'governor';
        return 'advisor';
      }

      const KING_PERSONALITY = {
        default: { low: 30, mid: 55, high: 70, threatMultiplier: 1 },
        marshal: { low: 25, mid: 45, high: 60, threatMultiplier: 1.25 },
        princess: { low: 40, mid: 65, high: 75, threatMultiplier: 0.9, loyaltyFocus: 0.35 },
        council: { low: 35, mid: 55, high: 65, threatMultiplier: 1, competenceBonus: 5 },
      };

      const REGION_NAMES = ['アスティア', 'ノルドランド', 'ヴァレンシア', 'ルミニア', 'サバンナ', 'エルダーナ', 'コスタ', 'ハイランド', 'オリオン', 'セレシア'];
      const MAX_CITY_DEFENSE_CORPS = 120;
      const MAX_REGION_DIVISIONS = 5;
      const LAW_SEED = [
        { baseId:'centralized_tax', basePhrase:'王都の', category:'economy', effects:{taxEfficiency:0.15, unrest:5}, ideologyReq:{centralization:80}, supportFocus:{nobility:0.6, merchants:0.4}, cooldown:4, description:'税収を王都直轄に集中し、中央の権力基盤を固める。', descriptors:['執行税務','収支管理','国庫整備'] },
        { baseId:'stability_ordinance', basePhrase:'大臣会議の', category:'governance', effects:{stability:5, unrest:2}, ideologyReq:{centralization:60, traditionalism:60}, supportFocus:{citizens:0.5, clergy:0.3}, cooldown:3, description:'秩序と伝統を守るための規律を強化する。', descriptors:['秩序法案','清廉令','礼節規定'] },
        { baseId:'military_funding', basePhrase:'王立軍の', category:'military', effects:{military:10, unrest:4}, ideologyReq:{militarism:70}, supportFocus:{military:0.7, nobility:0.2}, cooldown:3, description:'国境防衛と訓練に資源を集中する。', descriptors:['防衛契約','訓練強化','軍備補充'] },
        { baseId:'local_freedom', basePhrase:'各都市の', category:'local', effects:{loyalty:5, unrest:-3}, ideologyReq:{liberalism:65}, supportFocus:{citizens:0.6, merchants:0.4}, cooldown:3, description:'自治を与えて資源循環を促す。', descriptors:['自治章','市民自治令','地域会議'] },
        { baseId:'border_defense', basePhrase:'辺境の', category:'military', effects:{military:6, unrest:2}, ideologyReq:{militarism:60}, supportFocus:{military:0.6, nobility:0.3}, cooldown:3, description:'要塞化して脅威を抑える。', descriptors:['砦整備','防衛線構築','境界砲座'] },
        { baseId:'trade_pact', basePhrase:'交易商会の', category:'diplomacy', effects:{taxEfficiency:0.1, loyalty:2}, ideologyReq:{liberalism:60}, supportFocus:{merchants:0.7, citizens:0.3}, cooldown:4, description:'隣国との貿易を拡充し商人層の支持を得る。', descriptors:['交易協定','友好条約','商路拡張'] },
        { baseId:'canal_project', basePhrase:'河川開発省の', category:'infrastructure', effects:{stability:3, military:2}, ideologyReq:{centralization:55}, supportFocus:{merchants:0.5, military:0.2}, cooldown:4, description:'物流網を整え軍移動も後押し。', descriptors:['運河計画','水路整備','航路整備'] },
        { baseId:'academy_funding', basePhrase:'学院運営の', category:'culture', effects:{loyalty:3, unrest:-2}, ideologyReq:{liberalism:50}, supportFocus:{clergy:0.3, citizens:0.4}, cooldown:3, description:'知識層と市民の信頼を得る。', descriptors:['教養支援','学府援助','儒学振興'] },
        { baseId:'public_housing', basePhrase:'都市居住の', category:'local', effects:{loyalty:4, unrest:-4}, ideologyReq:{liberalism:55}, supportFocus:{citizens:0.7}, cooldown:3, description:'公共住宅を整備して民心を安定。', descriptors:['住宅令','住居計画','民生支援'] },
        { baseId:'naval_patrol', basePhrase:'海軍部の', category:'military', effects:{military:4, unrest:1}, ideologyReq:{militarism:55}, supportFocus:{military:0.6, merchants:0.2}, cooldown:3, description:'沿岸を巡回し外敵をけん制。', descriptors:['巡察令','沿岸警備令','哨戒増強'] },
        { baseId:'neighbor_alliance', basePhrase:'隣国との', category:'diplomacy', effects:{loyalty:3, unrest:-1}, ideologyReq:{liberalism:60}, supportFocus:{merchants:0.5, citizens:0.3}, cooldown:4, description:'協調的外交で安全保障を固める。', descriptors:['協約締結','親善使節','条約調印'] },
      ];
      const KING_LAW_DB = [];
      LAW_SEED.forEach(seed => {
        seed.descriptors.forEach((desc, index) => {
          const region = REGION_NAMES[index % REGION_NAMES.length] || '無名';
          const multiplier = 1 + index * 0.08;
          const idSuffix = `${desc}-${region}`.replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
          KING_LAW_DB.push({
            id: `${seed.baseId}_${idSuffix}`,
            name: `${region}の${desc}`,
            category: seed.category,
            effects: Object.fromEntries(Object.entries(seed.effects || {}).map(([k,v]) => [k, v * multiplier])),
            ideologyReq: seed.ideologyReq,
            supportFocus: seed.supportFocus,
            cooldown: seed.cooldown,
            description: `【${region}】 ${seed.description}`,
          });
        });
      });

      const LAW_THRESHOLD = 45;
      let kingLawCooldowns = {};

      function getKingIdeology(kingId) {
        const char = characters[kingId];
        const stats = getCharacterEffectiveStats(kingId) || {};
        if (!char) return { centralization: 50, liberalism: 50, militarism: 50, traditionalism: 50 };
        const support = char.support || {};
        const behavior = char.behavior || {};
        return {
          centralization: clamp(
            (stats.administration ?? 0) * 0.4 +
            (support.nobility ?? 0) * 0.3 +
            (behavior.caution ?? 0) * 0.3,
            0,
            100),
          liberalism: clamp(
            (support.citizens ?? 0) * 0.5 +
            (support.merchants ?? 0) * 0.3 +
            (behavior.flexibility ?? 0) * 0.2,
            0,
            100),
          militarism: clamp(
            (stats.military ?? 0) * 0.5 +
            (support.military ?? 0) * 0.4 +
            (behavior.ambition ?? 0) * 0.1,
            0,
            100),
          traditionalism: clamp(
            (stats.legitimacy ?? 0) * 0.5 +
            (support.clergy ?? 0) * 0.4 +
            (behavior.caution ?? 0) * 0.1,
            0,
            100),
        };
      }

      function getLawSupportAlignment(kingId, law) {
        const char = characters[kingId];
        if (!char || !law.supportFocus) return 50;
        const support = char.support || {};
        let totalWeight = 0;
        let score = 0;
        Object.entries(law.supportFocus).forEach(([key, weight]) => {
          const value = support[key] ?? 50;
          score += value * (weight || 0);
          totalWeight += weight || 0;
        });
        if (!totalWeight) return 50;
        return clamp(score / totalWeight, 0, 100);
      }

      function getNationState() {
        const stabilitySum = cities.reduce((sum, city) => sum + (city.stability || 50), 0);
        const avgStability = cities.length ? stabilitySum / cities.length : 50;
        return {
          stability: avgStability,
          treasury: globalFunds,
          borderThreat: globalFunds < 1500,
          unrest: 100 - avgStability,
        };
      }

      function getPlayerCompetence() {
        const stats = getCharacterEffectiveStats('player') || {};
        return ((stats.infrastructure ?? 0) * 0.5) + ((stats.economy ?? 0) * 0.5);
      }

      function tickKingLawCooldowns() {
        Object.keys(kingLawCooldowns).forEach(id => {
          kingLawCooldowns[id] = Math.max(0, (kingLawCooldowns[id] || 0) - 1);
          if (kingLawCooldowns[id] === 0) delete kingLawCooldowns[id];
        });
      }

      function getKingLawScore(law, kingId) {
        const ideology = getKingIdeology(kingId);
        const situation = getNationState();
        const score = calculateLawScore(law, ideology, situation, kingId);
        return score;
      }

      function calculateLawScore(law, ideology, nationState, kingId) {
        let ideologyMatchScore = 0;
        let count = 0;
        if (law.ideologyReq) {
          Object.entries(law.ideologyReq).forEach(([key, value]) => {
            if (ideology[key] == null) return;
            ideologyMatchScore += Math.max(0, 100 - Math.abs((ideology[key] || 0) - value));
            count += 1;
          });
        }
        ideologyMatchScore = count ? Math.floor(ideologyMatchScore / count) : 50;
        let situationBonus = 0;
        if (nationState.stability < 40 && law.category === 'governance') situationBonus += 20;
        if (nationState.treasury < 1600 && law.category === 'economy') situationBonus += 15;
        if (nationState.borderThreat && law.category === 'military') situationBonus += 25;
        const supportAlignment = getLawSupportAlignment(kingId, law);
        const expectedUnrest = Math.max(0, law.effects?.unrest || 0);
        const resistancePenalty = expectedUnrest * (100 - supportAlignment) / 100;
        const kingChar = characters[kingId] || {};
        const behavior = kingChar.behavior || {};
        const riskPenalty = expectedUnrest * ((behavior.caution || 50) / 100);
        let score = ideologyMatchScore + situationBonus - resistancePenalty - riskPenalty;
        const playerProposal = player.proposedLaw;
        if (playerProposal && playerProposal.id === law.id) {
          score += getPlayerCompetence() * 0.2;
          if ((player.loyalty || characters.player?.loyalty || 50) > 60) score += 10;
        }
        return score;
      }

      function evaluateKingLawSelection() {
        if (!kingAI.id || kingAI.id === 'player') return;
        if (kingAI.skipLawThisTurn) {
          kingAI.skipLawThisTurn = false;
          return;
        }
        const availableLaws = KING_LAW_DB.filter(law => !kingLawCooldowns[law.id]);
        let candidate = null;
        let maxScore = -Infinity;
        availableLaws.forEach(law => {
          const score = getKingLawScore(law, kingAI.id);
          if (score > maxScore) {
            maxScore = score;
            candidate = law;
          }
        });
        if (!candidate || maxScore < LAW_THRESHOLD) {
          kingAI.skipLawThisTurn = true;
          return;
        }
        applyKingLaw(candidate, maxScore, kingAI.id);
      }

      function applyKingLaw(law, score, executorId) {
        const actorId = typeof executorId === 'string' ? executorId : 'player';
        const actorName = getCandidateName(actorId);
        const previousKingId = kingAI.id;
        if (actorId) kingAI.id = actorId;
        const headline = `${getCandidateName(kingAI.id)} は《${law.name}》を採択した`;
        const summary = `${law.description || ''}（評価: ${Math.round(score)})`;
        showNewspaperHeadline(headline, summary);
        if (actorId && actorId !== 'player') {
          recordAILog(`${actorName} は「${law.name}」を採択した（score ${Math.round(score)})`);
        }
        kingAI.id = previousKingId;
        if (law.effects?.taxEfficiency) {
          globalFunds += Math.round(globalFunds * law.effects.taxEfficiency * 0.4);
        }
        if (law.effects?.stability) {
          cities.forEach(city => {
            city.stability = clamp((city.stability || 50) + law.effects.stability, 0, 120);
          });
        }
        if (law.effects?.military) {
          cities.forEach(city => {
            city.military = clamp((city.military || 0) + law.effects.military * 0.4, 0, 260);
          });
        }
        if (law.effects?.unrest) {
          cities.forEach(city => {
            city.stability = clamp((city.stability || 50) - law.effects.unrest, 0, 120);
          });
        }
        kingLawCooldowns[law.id] = law.cooldown || 3;
      }

      function showNewspaperHeadline(headline, bodyText) {
        const overlayId = `law-news-${Date.now()}`;
        const body = `<div style="background:#f6f1e4; padding:12px; border:1px solid #444; line-height:1.6; font-family:'Times New Roman','ヒラギノ明朝 Pro','serif'; font-size:13px; color:#1a1a1a;">
            <p style="font-size:18px; font-weight:bold; margin:0 0 6px;">${headline}</p>
            <p style="margin:0 0 4px;">${bodyText}</p>
            <p style="font-size:11px; color:#555;">旧王都新聞・特別号</p>
          </div>`;
        const aiEntries = aiActionLog.filter(log => Number.isFinite(log.turn) && Math.floor(log.turn) === Math.floor(currentTurn));
        if (aiEntries.length) {
          const aiHeader = document.createElement('div');
          aiHeader.style.fontSize = '11px';
          aiHeader.style.opacity = '0.7';
          aiHeader.textContent = 'AIログ';
          container.appendChild(aiHeader);
          aiEntries.slice(0, 4).forEach(log => {
            const row = document.createElement('div');
            row.style.padding = '6px';
            row.style.borderBottom = '1px solid rgba(0,0,0,0.12)';
            row.style.lineHeight = '1.4';
            const time = document.createElement('div');
            time.style.fontSize = '10px';
            time.style.color = '#444';
            time.textContent = formatGameDate(log.turn);
            const body = document.createElement('div');
            body.style.fontSize = '13px';
            body.style.color = '#111';
            body.textContent = log.text;
            row.appendChild(time);
            row.appendChild(body);
            container.appendChild(row);
          });
        }
        showStoryOverlay({
          id: overlayId,
          title: '王令新聞',
          body,
          modal: false,
          buttons: [{ label: '了解', action: () => closeStoryOverlay(overlayId) }],
        });
      }

      function getActorDisplayName(actorId) {
        if (actorId === 'royal-newspaper') return '王令新聞';
        if (!actorId) return '王国';
        const label = getCandidateName(actorId);
        return label || actorId;
      }

      function buildStoryActionSummary(actionId, opts = {}) {
        const actionName = ACTION_DISPLAY_NAMES[actionId] || actionId;
        const parts = [];
        if (opts.cityId != null && Number.isFinite(opts.cityId) && cities[opts.cityId]) {
          const city = cities[opts.cityId];
          parts.push(city.name || `都市${city.id}`);
        }
        if (opts.frontierTile) {
          parts.push(`${opts.frontierTile.x},${opts.frontierTile.y}`);
        }
        if (opts.cityAId != null && opts.cityBId != null) {
          const cityA = Number.isFinite(opts.cityAId) ? cities[opts.cityAId] : null;
          const cityB = Number.isFinite(opts.cityBId) ? cities[opts.cityBId] : null;
          const nameA = cityA ? (cityA.name || `都市${cityA.id}`) : `都市${opts.cityAId}`;
          const nameB = cityB ? (cityB.name || `都市${cityB.id}`) : `都市${opts.cityBId}`;
          parts.push(`${nameA}⇔${nameB}`);
        }
        const context = parts.length ? `（${parts.join('・')}）` : '';
        if (typeof opts.storyLabel === 'string' && opts.storyLabel.trim().length) {
          return opts.storyLabel;
        }
        return `${actionName}${context}`;
      }

      function updateMobileNewsTicker() {
        if (!mobileTickerEl) return;
        const latest = monthlyNewspapers[0];
        mobileTickerEl.textContent = latest && latest.entries.length
          ? `${formatGameDate(latest.turn)} ${latest.entries[0].summary}`
          : '王令新聞・ストーリー';
      }

      function archiveMonthlyNewspaper(turn, entries) {
        const safeEntries = Array.isArray(entries)
          ? entries.map(entry => ({
              actorName: entry.actorName,
              summary: entry.summary,
              actionId: entry.actionId || '',
            }))
          : [];
        monthlyNewspapers.unshift({
          turn,
          entries: safeEntries,
          createdAt: Date.now(),
        });
        if (monthlyNewspapers.length > MONTHLY_ARCHIVE_LIMIT) {
          monthlyNewspapers.length = MONTHLY_ARCHIVE_LIMIT;
        }
        updateMobileNewsTicker();
      }

      function resetStoryJournal() {
        storyActionTimeline.length = 0;
        monthlyNewspapers.length = 0;
        updateMobileNewsTicker();
        lastMonthlyNewspaperTurn = -1;
        aiActionLog.length = 0;
      }

      function recordStoryAction(actorId, actionId, opts = {}) {
        if (!isStoryMode) return null;
        const entry = {
          turn: currentTurn,
        actorId,
        actorName: typeof opts.actorName === 'string' ? opts.actorName : getActorDisplayName(actorId),
        actionId,
          summary: buildStoryActionSummary(actionId, opts),
        };
        storyActionTimeline.push(entry);
        if (storyActionTimeline.length > STORY_TIMELINE_LIMIT) {
          storyActionTimeline.shift();
        }
        return entry;
      }

      function openRoyalNewsOverlay(entries, turn, monthLabel, topAlign = false) {
        if (!entries.length || !storyOverlayRoot) return;
        if (lastRoyalNewsOverlayId) {
          closeStoryOverlay(lastRoyalNewsOverlayId);
          lastRoyalNewsOverlayId = null;
        }
        const overlayId = `royal-news-${turn}-${Date.now()}`;
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';
        entries.forEach(entry => {
          const row = document.createElement('div');
          row.style.padding = '6px';
          row.style.borderBottom = '1px solid rgba(0,0,0,0.12)';
          row.style.lineHeight = '1.4';
          row.innerHTML = `<div style="font-size:11px; color:#444;">${formatGameDate(entry.turn)}</div>
            <div><strong>${entry.actorName}</strong> ${entry.summary}</div>`;
          container.appendChild(row);
        });
        showStoryOverlay({
          id: overlayId,
          title: `王令新聞 ${monthLabel}`,
          body: container,
          modal: false,
          buttons: [{ label: '了解', action: () => closeStoryOverlay(overlayId) }],
          topAlign,
          animate: topAlign,
          width: Math.min(520, window.innerWidth - 40),
        });
        lastRoyalNewsOverlayId = overlayId;
      }

      function showRoyalNewspaper(entries, turn, options = {}) {
        if (!entries.length) return;
        const monthLabel = formatGameDate(turn);
        archiveMonthlyNewspaper(turn, entries);
        updateMobileNewsTicker();
        const isMobileUI = !!(document.body && document.body.classList.contains('mobile-ui-enabled'));
        const autoPopupAllowed = options.forceOverlay || roles.player === 'king';
        if (isMobileUI || !autoPopupAllowed) {
          if (isMobileUI) {
            openMobileRoyalNewsPanel(entries, turn);
          }
          playSystemSound('news');
          return;
        }
        openRoyalNewsOverlay(entries, turn, monthLabel, true);
        playSystemSound('news');
      }
      function openNationOverviewOverlay() {
        if (!storyOverlayRoot) return;
        const overlayId = 'nation-overview';
        if (overlayStack.find(o => o.id === overlayId)) return;
        const metrics = calculateNationOverviewMetrics();
        const container = document.createElement('div');
        container.className = 'nation-overview';
        container.appendChild(buildNationMetricRow('独裁の傾向', metrics.dictatorship, metrics.dictatorshipNote));
        container.appendChild(buildNationMetricRow('民主的側面', metrics.democracy, metrics.democracyNote));
        container.appendChild(buildNationMetricRow('国家の富', metrics.wealth, metrics.wealthNote));
        if (metrics.cityStats) {
          const stabilityNote = document.createElement('div');
          stabilityNote.className = 'nation-metric-note';
          stabilityNote.style.marginTop = '4px';
          stabilityNote.textContent = `都市安定度：${metrics.cityStats.avgStability.toFixed(1)} / 開発度：${metrics.cityStats.development.toFixed(1)}。指導方針はこれらを伸ばすか抑えるかにも影響します。`;
          container.appendChild(stabilityNote);
        }
        showStoryOverlay({
          id: overlayId,
          title: '国家全体情報',
          body: container,
          modal: false,
          buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
          width: 360,
        });
      }

      function buildNationMetricRow(label, value, note) {
        const row = document.createElement('div');
        row.className = 'nation-metric-row';
        const labelRow = document.createElement('div');
        labelRow.className = 'nation-metric-label';
        const title = document.createElement('span');
        title.textContent = label;
        const valueLabel = document.createElement('span');
        valueLabel.textContent = `${Math.round(value)}%`;
        labelRow.appendChild(title);
        labelRow.appendChild(valueLabel);
        const track = document.createElement('div');
        track.className = 'nation-metric-track';
        const fill = document.createElement('div');
        fill.className = 'nation-metric-fill';
        fill.style.width = `${Math.min(100, Math.max(0, value))}%`;
        track.appendChild(fill);
        row.appendChild(labelRow);
        row.appendChild(track);
        if (note) {
          const noteEl = document.createElement('div');
          noteEl.className = 'nation-metric-note';
          noteEl.textContent = note;
          row.appendChild(noteEl);
        }
        return row;
      }

      function calculateCityStatOverview() {
        if (!cities.length) {
          return { avgStability: 50, development: 40 };
        }
        const totalStability = cities.reduce((sum, city) => sum + (city.stability || 50), 0);
        const avgStability = totalStability / cities.length;
        const totalDevelopment = cities.reduce((sum, city) => {
          const devScore = (city.level || 1) * 8 + (city.wealth || 0) * 0.02 + (city.pop || 0) * 0.002;
          return sum + devScore;
        }, 0);
        const avgDevelopment = Math.min(100, totalDevelopment / cities.length);
        return { avgStability, development: avgDevelopment };
      }

      function calculateNationOverviewMetrics() {
        const state = getNationState();
        const winnerEntry = Object.entries(roles).find(([, role]) => role === 'king');
        const kingId = winnerEntry ? winnerEntry[0] : null;
        const kingName = kingId ? getCandidateName(kingId) : '未定';
        const cityStats = calculateCityStatOverview();
        const baseScore = 42;
        const playerBonus = roles.player === 'king' ? 12 : roles.player === 'chancellor' ? 6 : 0;
        const npcKingBonus = kingAI.id && kingAI.id !== 'player' ? 10 : 0;
        const stabilityPenalty = Math.max(0, 50 - (state.stability || 50)) * 0.2;
        const dictatorship = clamp(baseScore + playerBonus + npcKingBonus + stabilityPenalty, 0, 100);
        const democracy = clamp(100 - dictatorship + (state.treasury > 2200 ? 6 : 0) - (state.unrest > 60 ? 4 : 0), 0, 100);
        const wealth = clamp(((state.treasury || 0) / 4000) * 100 + ((state.stability || 0) / 120) * 20, 0, 100);
        const councilRoleDesc = roles.council ? roleLabel(roles.council) : '未確認';
        return {
          state,
          kingName,
          dictatorship,
          democracy,
          wealth,
          cityStats,
          dictatorshipNote: `最高権力: ${kingName}${kingId === 'player' ? '（あなた）' : ''}`,
          democracyNote: `評議会: ${councilRoleDesc} / 都市安定度 ${cityStats.avgStability.toFixed(1)}%`,
          wealthNote: `国庫 ${Math.round(state.treasury || 0)} / 開発度 ${cityStats.development.toFixed(1)}`,
        };
      }

      function maybeShowMonthlyNewspaper() {
        if (!isStoryMode) return;
        const lastTurn = currentTurn - 1;
        if (lastTurn <= lastMonthlyNewspaperTurn) return;
        const entries = storyActionTimeline.filter(entry => entry.turn === lastTurn);
        if (!entries.length) return;
        lastMonthlyNewspaperTurn = lastTurn;
        showRoyalNewspaper(entries, lastTurn);
        archiveMonthlyNewspaper(lastTurn, entries);
      }

      function openStoryTimelineOverlay() {
        if (!storyOverlayRoot) return;
        const overlayId = 'story-timeline';
        if (overlayStack.find(o => o.id === overlayId)) return;
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '6px';
        container.style.maxHeight = '320px';
        container.style.overflowY = 'auto';
        container.style.paddingRight = '4px';
        const status = document.createElement('div');
        status.style.fontSize = '12px';
        status.style.opacity = '0.7';
        if (successionResult) {
          status.textContent = `王決定済: ${getCandidateName(successionResult.winnerId)}`;
        } else if (typeof successionTurnPlanned === 'number') {
          const remaining = Math.max(0, successionTurnPlanned - currentTurn);
          status.textContent = `王決定まで残り ${remaining}ターン`;
        } else {
          status.textContent = '王決定はまだ未定です';
        }
        container.appendChild(status);
        const monthlySection = document.createElement('div');
        monthlySection.style.display = 'flex';
        monthlySection.style.flexDirection = 'column';
        monthlySection.style.gap = '4px';
        monthlySection.style.marginTop = '4px';
        const monthlyHeader = document.createElement('strong');
        monthlyHeader.style.fontSize = '13px';
        monthlyHeader.textContent = '定期号アーカイブ';
        monthlySection.appendChild(monthlyHeader);
        if (!monthlyNewspapers.length) {
          const emptyIssue = document.createElement('div');
          emptyIssue.style.fontSize = '11px';
          emptyIssue.style.opacity = '0.6';
          emptyIssue.textContent = 'まだ定期号は発行されていません';
          monthlySection.appendChild(emptyIssue);
        } else {
          monthlyNewspapers.slice(0, MONTHLY_ARCHIVE_LIMIT).forEach(issue => {
            const issueRow = document.createElement('div');
            issueRow.style.display = 'flex';
            issueRow.style.justifyContent = 'space-between';
            issueRow.style.alignItems = 'center';
            issueRow.style.gap = '6px';
            issueRow.style.padding = '5px 6px';
            issueRow.style.border = '1px solid rgba(255,255,255,0.08)';
            issueRow.style.borderRadius = '6px';
            const label = document.createElement('div');
            label.style.fontSize = '12px';
            label.textContent = `${formatGameDate(issue.turn)}号`;
            const viewBtn = document.createElement('button');
            viewBtn.className = 'btn';
            viewBtn.style.padding = '3px 10px';
            viewBtn.style.fontSize = '11px';
            viewBtn.textContent = '閲覧';
            viewBtn.addEventListener('click', () => {
              showRoyalNewspaper(issue.entries, issue.turn, { forceOverlay: true });
            });
            issueRow.appendChild(label);
            issueRow.appendChild(viewBtn);
            monthlySection.appendChild(issueRow);
          });
        }
        container.appendChild(monthlySection);
        if (!storyActionTimeline.length) {
          const empty = document.createElement('div');
          empty.textContent = '記録がまだありません';
          empty.style.color = '#555';
          container.appendChild(empty);
        } else {
          const entries = [...storyActionTimeline].reverse();
          entries.forEach(entry => {
            const row = document.createElement('div');
            row.style.padding = '6px';
            row.style.borderBottom = '1px solid rgba(0,0,0,0.12)';
            row.style.fontSize = '12px';
            row.innerHTML = `<div style="font-size:10px; color:#666;">${formatGameDate(entry.turn)}</div>
              <div><strong>${entry.actorName}</strong> ${entry.summary}</div>`;
            container.appendChild(row);
          });
        }
      showStoryOverlay({
        id: overlayId,
        title: '王命履歴',
        body: container,
        modal: true,
        width: '420px',
        buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
        animate: true,
      });
    }

  function openGalleryOverlay() {
    if (!storyOverlayRoot) return;
    const overlayId = 'gallery-overlay';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const launchGalleryOpening = (variant = 'classic') => {
      closeStoryOverlay(overlayId);
      playOpening({
        mode: 'gallery',
        variant,
        skippable: true,
        onComplete: () => setTimeout(openGalleryOverlay, 30),
      });
    };
    const items = [
      {
        title: 'OPアニメーション（beta-2.0）',
        description: '新しい地図アニメと異世界感を楽しむ',
        action: () => launchGalleryOpening('beta'),
      },
      {
        title: '古いOPアニメーション',
        description: '従来のバージョンと演出をもう一度',
        action: () => launchGalleryOpening('classic'),
      },
      {
        title: '王命新聞（過去ログ）',
        description: '定期号アーカイブを見る（ネタバレ注意）',
        action: () => {
          closeStoryOverlay(overlayId);
          openGalleryNewsArchive();
        },
      },
      {
        title: 'タイトルロゴ',
        description: 'ロゴを眺めて余韻に浸る（準備中）',
      },
      {
        title: '主要SE / BGM',
        description: '音を試聴する（準備中）',
      },
    ];
    items.forEach(item => {
      const entry = document.createElement('div');
      entry.className = 'win98-gallery-entry';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const desc = document.createElement('span');
      desc.textContent = item.description;
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = item.action ? '再生' : '準備中';
      if (item.action) {
        btn.addEventListener('click', item.action);
      } else {
        btn.disabled = true;
      }
      entry.appendChild(title);
      entry.appendChild(desc);
      entry.appendChild(btn);
      container.appendChild(entry);
    });
    showStoryOverlay({
      id: overlayId,
      title: 'ギャラリー',
      body: container,
      modal: true,
      buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
      animate: true,
    });
  }

  function openGalleryNewsArchive() {
    if (!storyOverlayRoot) return;
    const overlayId = 'gallery-news-archive';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const warning = document.createElement('div');
    warning.style.fontSize = '12px';
    warning.style.color = '#140404';
    warning.style.fontWeight = '600';
    warning.textContent = 'ネタバレ注意：物語の進行やAIの判断が含まれます。';
    container.appendChild(warning);
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';
    const issues = monthlyNewspapers.slice(0, MONTHLY_ARCHIVE_LIMIT);
    if (!issues.length) {
      const empty = document.createElement('div');
      empty.textContent = 'まだ王命新聞の定期号は発行されていません。';
      empty.style.opacity = '0.7';
      list.appendChild(empty);
    } else {
      issues.forEach(issue => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '6px';
        row.style.padding = '8px';
        row.style.border = '1px solid rgba(255,255,255,0.15)';
        row.style.borderRadius = '10px';
        row.style.background = 'rgba(10,12,18,0.8)';
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'baseline';
        const label = document.createElement('strong');
        label.textContent = `${formatGameDate(issue.turn)}号`;
        label.style.fontSize = '13px';
        const timeLabel = document.createElement('span');
        timeLabel.style.fontSize = '11px';
        timeLabel.style.opacity = '0.7';
        timeLabel.textContent = issue.createdAt ? new Date(issue.createdAt).toLocaleString('ja-JP') : '発行日不明';
        header.appendChild(label);
        header.appendChild(timeLabel);
        row.appendChild(header);
        const preview = document.createElement('div');
        preview.style.fontSize = '12px';
        preview.style.opacity = '0.85';
        const snippets = (Array.isArray(issue.entries) ? issue.entries : [])
          .slice(0, 2)
          .map(entry => `${entry.actorName || '王国'} ${entry.summary || ''}`.trim())
          .filter(Boolean)
          .join(' / ');
        preview.textContent = snippets || '内容の詳細は全文表示で確認できます。';
        row.appendChild(preview);
        const actionRow = document.createElement('div');
        actionRow.style.display = 'flex';
        actionRow.style.justifyContent = 'flex-end';
        const viewBtn = document.createElement('button');
        viewBtn.className = 'btn';
        viewBtn.style.fontSize = '12px';
        viewBtn.style.padding = '4px 10px';
        viewBtn.textContent = '全文表示';
        viewBtn.addEventListener('click', () => {
          showRoyalNewspaper(issue.entries || [], issue.turn, { forceOverlay: true });
        });
        actionRow.appendChild(viewBtn);
        row.appendChild(actionRow);
        list.appendChild(row);
      });
    }
    container.appendChild(list);
    showStoryOverlay({
      id: overlayId,
      title: '王命新聞アーカイブ',
      body: container,
      modal: false,
      width: 420,
      buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
    });
  }

      function gatherNPCProposals() {
        const nationState = getNationState();
        const proposals = [];
        ['marshal','princess','council'].forEach(id => {
          if (roles[id] && id !== 'player') {
            let bestLaw = null;
            let bestScore = -Infinity;
            KING_LAW_DB.forEach(law => {
              const score = calculateLawScore(law, getKingIdeology(id), nationState, id);
              if (score > bestScore) {
                bestScore = score;
                bestLaw = law;
              }
            });
            if (bestLaw) {
              proposals.push({ candidate:id, law:bestLaw, score:Math.round(bestScore) });
            }
          }
        });
        return proposals;
      }

      function offerNPCProposals() {
        if (kingAI.proposalsShown) return;
        const proposals = gatherNPCProposals();
        if (!proposals.length) return;
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        proposals.forEach(entry => {
          const row = document.createElement('div');
          row.style.border = '1px solid #333';
          row.style.padding = '8px';
          row.style.background = '#1c2231';
          row.style.color = '#d8dee9';
          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'center';
          const candidateName = document.createElement('strong');
          candidateName.textContent = `${getCandidateName(entry.candidate)} の提案`;
          const score = document.createElement('span');
          score.style.opacity = '0.7';
          score.textContent = `評価 ${entry.score}`;
          header.appendChild(candidateName);
          header.appendChild(score);
          const lawName = document.createElement('div');
          lawName.textContent = `→ ${entry.law.name}`;
          lawName.style.marginTop = '4px';
          const desc = document.createElement('div');
          desc.textContent = entry.law.description;
          desc.style.fontSize = '12px';
          desc.style.opacity = '0.8';
          row.appendChild(header);
          row.appendChild(lawName);
          row.appendChild(desc);
          container.appendChild(row);
        });
        showStoryOverlay({
          id:'npc-proposals',
          title:'忠誠な候補者たちの提案',
          body:container,
          modal:false,
          buttons:[{ label:'受け止める', action: () => closeStoryOverlay('npc-proposals') }],
        });
        kingAI.proposalsShown = true;
      }

      function getNonplayerCandidateIds() {
        return ['marshal','princess','council'].filter(id => id !== 'player');
      }

      function getNPCDisplayNames() {
        return getNonplayerCandidateIds()
          .map(id => getCandidateName(id))
          .filter(Boolean);
      }

      function formatNPCSummary() {
        const names = getNPCDisplayNames();
        return names.length ? names.join('・') : '他の候補者たち';
      }

      function announceCapitalMove(city) {
        if (!city) return;
        const headline = `王都は ${city.name || '未知の都市'} に移転した`;
        const summary = `王都の移転告示が出た。王は新たな都市を中心に秩序と再構築を図る。`;
        showNewspaperHeadline(headline, summary);
      }

      const LAW_CATEGORIES = Array.from(new Set(KING_LAW_DB.map(l => l.category)));

      function openLawSelectionOverlay() {
        const overlayId = 'law-selection';
        const existing = document.getElementById(overlayId);
        if (existing) return;
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '8px';
        const kingId = roles.player === 'king' ? 'player' : kingAI.id;
        const tabsRow = document.createElement('div');
        tabsRow.style.display = 'flex';
        tabsRow.style.gap = '6px';
        tabsRow.style.flexWrap = 'wrap';
        const lawArea = document.createElement('div');
        lawArea.style.display = 'flex';
        lawArea.style.flexDirection = 'column';
        lawArea.style.gap = '6px';
        lawArea.style.maxHeight = '320px';
        lawArea.style.overflowY = 'auto';
        lawArea.style.paddingRight = '6px';
        let selectedCategory = LAW_CATEGORIES[0] || 'governance';

        function renderLawList(category) {
          lawArea.innerHTML = '';
          const nationState = getNationState();
          const filtered = KING_LAW_DB.filter(law => law.category === category);
          if (!filtered.length) {
            const empty = document.createElement('div');
            empty.textContent = '該当する法案がありません';
            lawArea.appendChild(empty);
            return;
          }
          filtered.forEach(law => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.padding = '8px';
            row.style.border = '1px solid #333';
            row.style.background = '#0f131d';
            row.style.color = '#e5e9f0';
            row.style.borderRadius = '6px';
            const header = document.createElement('div');
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            const title = document.createElement('strong');
            title.textContent = law.name;
            const score = Math.round(calculateLawScore(law, getKingIdeology(kingId), nationState, kingId));
            const scoreLabel = document.createElement('span');
            scoreLabel.style.fontSize = '11px';
            scoreLabel.style.opacity = '0.8';
            scoreLabel.textContent = `score: ${score}`;
            header.appendChild(title);
            header.appendChild(scoreLabel);
            const desc = document.createElement('div');
            desc.style.fontSize = '12px';
            desc.style.opacity = '0.9';
            desc.style.marginTop = '4px';
            desc.style.color = '#d8dee9';
            desc.textContent = law.description;
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.style.marginTop = '8px';
            btn.textContent = `制定 (${score})`;
            btn.disabled = score < LAW_THRESHOLD;
            btn.addEventListener('click', () => {
              applyKingLaw(law, score, 'player');
              closeStoryOverlay(overlayId);
            });
            row.appendChild(header);
            row.appendChild(desc);
            row.appendChild(btn);
            lawArea.appendChild(row);
          });
        }

        LAW_CATEGORIES.forEach(cat => {
          const tab = document.createElement('button');
          tab.type = 'button';
          tab.className = 'btn';
          tab.textContent = cat.toUpperCase();
          tab.style.fontSize = '11px';
          tab.addEventListener('click', () => {
            selectedCategory = cat;
            renderLawTabs();
            renderLawList(cat);
          });
          tabsRow.appendChild(tab);
        });

        function renderLawTabs() {
          Array.from(tabsRow.children).forEach(tab => {
            if (tab.textContent.toLowerCase() === selectedCategory) {
              tab.classList.add('active');
            } else {
              tab.classList.remove('active');
            }
          });
        }

        renderLawTabs();
        renderLawList(selectedCategory);
        container.appendChild(tabsRow);
        container.appendChild(lawArea);
        showStoryOverlay({
          id: overlayId,
          title: '法律制定',
          body: container,
          modal: true,
          buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
        });
      }

      function evaluatePlayerForKing() {
        const playerChar = characters.player;
        if (!playerChar) return { competence: 0, popularity: 0, threat: 0, loyalty: 50, loyaltyFactor: 0.5 };
        const stats = getCharacterEffectiveStats('player') || {};
        const competence = ((stats.infrastructure ?? 0) * 0.5) + ((stats.economy ?? 0) * 0.5);
        const popularity = sumSupportValues(playerChar.support);
        const loyaltyValue = typeof playerChar.loyalty === 'number' ? playerChar.loyalty : 50;
        const loyaltyFactor = clamp(loyaltyValue / 100, 0, 1);
        const threat = popularity * (1 - loyaltyFactor);
        return {
          competence,
          popularity,
          threat,
          loyalty: loyaltyValue,
          loyaltyFactor,
        };
      }

      function determineKingState(kingId, evaluation) {
        if (!kingId || kingId === 'player') return null;
        const personality = KING_PERSONALITY[kingId] || KING_PERSONALITY.default;
        const thresholds = {
          low: personality.low ?? KING_PERSONALITY.default.low,
          mid: personality.mid ?? KING_PERSONALITY.default.mid,
          high: personality.high ?? KING_PERSONALITY.default.high,
        };
        let threatScore = evaluation.threat * (personality.threatMultiplier || 1);
        if (personality.loyaltyFocus) {
          const discount = Math.max(0, 1 - (evaluation.loyaltyFactor * personality.loyaltyFocus));
          threatScore *= discount;
        }
        const competenceScore = evaluation.competence + (personality.competenceBonus || 0);
        if (threatScore < thresholds.low && competenceScore > thresholds.high) return 'utilize';
        if (threatScore < thresholds.mid) return 'monitor';
        return 'suppress';
      }

      function applyKingStateEffects(state) {
        const playerChar = characters.player;
        if (!playerChar) return;
        switch(state) {
          case 'utilize':
            actorAuthority.player = Math.min((actorAuthority.player || 0) + 2, 30);
            playerChar.loyalty = clamp((playerChar.loyalty || 50) + 1, 0, 100);
            break;
          case 'monitor':
            actorAuthority.player = Math.max((actorAuthority.player || 0) - 1, 0);
            break;
          case 'suppress':
            if (playerChar.support && typeof playerChar.support.citizens === 'number') {
              playerChar.support.citizens = Math.max(playerChar.support.citizens - 5, 0);
            }
            actorAuthority.player = Math.max((actorAuthority.player || 0) - 3, 0);
            break;
        }
      }

      function showKingAIStory(state) {
        if (!kingAI.id) return;
        const kingName = getCandidateName(kingAI.id);
        const playerName = player.profile.name || getCandidateName('player');
        const pronoun = kingAI.id === 'princess' ? '彼女' : '彼';
        let body = '';
        if (state === 'utilize') {
          body = `${pronoun}の手腕は確かだ。王として、それを使わぬ理由はない。<br>${playerName}には一定の権限が与えられ、成果は王の功績として扱われる。`;
        } else if (state === 'monitor') {
          body = `才覚はある。だが、近づけすぎるのは危険だ。<br>権限は制限され、他候補が要職に配置される。`;
        } else if (state === 'suppress') {
          body = `王は静かに命じた。“彼を遠ざけろ”。<br>${playerName}の支持を削り、提案は拒否される。`;
        } else {
          body = '王は静かな眼差しで国家を見守っている。';
        }
        const overlayId = `story-king-ai-${state || 'idle'}`;
        showStoryOverlay({
          id: overlayId,
          title: `${kingName} の思惑`,
          body,
          modal: false,
          buttons: [{ label: '理解', action: () => closeStoryOverlay(overlayId) }],
        });
      }

      function initKingAI(winnerId, playerRank) {
        if (!winnerId || winnerId === 'player') {
          kingAI.id = null;
          kingAI.state = null;
          kingAI.lastStoryState = null;
          return;
        }
        kingAI.id = winnerId;
        kingAI.playerRank = playerRank || 1;
        kingAI.state = null;
        kingAI.lastStoryState = null;
        updateKingAIState(true);
      }

      function updateKingAIState(forceNarrative = false) {
        if (!kingAI.id || kingAI.id === 'player') return;
        const evaluation = evaluatePlayerForKing();
        const nextState = determineKingState(kingAI.id, evaluation);
        const changed = nextState && nextState !== kingAI.state;
        if (changed) {
          kingAI.state = nextState;
          applyKingStateEffects(nextState);
        }
        if (forceNarrative || kingAI.lastStoryState !== nextState) {
          if (nextState) showKingAIStory(nextState);
          kingAI.lastStoryState = nextState;
        }
        evaluateKingLawSelection();
      }

      function formatCharacterMainStats(id) {
        const stats = getCharacterEffectiveStats(id);
        if (!stats) return '';
        const adm = stats.administration ?? 0;
        const mil = stats.military ?? 0;
        return `Adm ${adm} / Mil ${mil}`;
      }

  let successionResult = null; // { winnerId, support }
  let successionAftermathHandled = false;

  const storyFlags = {
    introShown:false,
    successionShown:false,
    firstCityInspect:false,
    firstCapitalSet:false,
  };

  const STORY_SCENARIOS = {
    ARRIVAL: 'arrival',
    INVESTIGATION: 'investigation',
    PRE_SUCCESSION: 'preSuccession',
    POST_SUCCESSION: 'postSuccession',
    LEGACY: 'legacy',
  };

  const ROMANCE_CANDIDATES = [
    {
      id: 'noble',
      label: '貴族の令嬢',
      name: '奏 (かなで)',
      note: '宮廷詩人として名を馳せる中性的な才媛。',
      initialAffection: 52,
      initialInfluence: 58,
      scandalRisk: 0.04,
      factionSupport: { nobility: 2, citizens: -1, clergy: 0, military: 0 },
    },
    {
      id: 'activist',
      label: '庶民出身の活動家',
      name: '律 (りつ)',
      note: '民衆の声を代弁する演説家。',
      initialAffection: 50,
      initialInfluence: 52,
      scandalRisk: 0.05,
      factionSupport: { citizens: 2, nobility: -1, clergy: -1, military: 0 },
    },
    {
      id: 'soldier',
      label: '主人公と同性の軍人',
      name: '優 (ゆう)',
      note: '軍籍を持つ親友のような存在。',
      initialAffection: 48,
      initialInfluence: 55,
      scandalRisk: 0.06,
      factionSupport: { military: 2, nobility: -1, clergy: -1, citizens: 0 },
    },
  ];
  const ROMANCE_INTERACTIONS = [
    {
      id: 'noble_dinner',
      candidateId: 'noble',
      offset: 3,
      title: '宮廷の晩餐',
      description: '貴族の令嬢・奏と隣席となった。インフラ会議の余韻を共有する。',
      choices: [
        {
          label: '優雅に会食を続ける',
          summary: 'ハウスイベントで奏と親しく振る舞い、貴族の信頼を得た。',
          effects: {
            affection: 6,
            influence: 2,
            support: { nobility: 4, citizens: -1 },
            stability: 1,
          },
        },
        {
          label: '治安会議へ向かい忙しく振る舞う',
          summary: '治安重視を優先した姿勢に、庶民層で好感が残る。',
          effects: {
            affection: 2,
            support: { citizens: 2 },
            scandal: 0.02,
          },
        },
      ],
    },
    {
      id: 'activist_visit',
      candidateId: 'activist',
      offset: 6,
      title: '草の根の火花',
      description: '活動家・律が市街地で移民支援の覚書を手渡す。',
      choices: [
        {
          label: '改革案に賛同する',
          summary: '民衆支持の高まりを実感し、律と距離を縮めた。',
          effects: {
            affection: 5,
            support: { citizens: 4, nobility: -2 },
            stability: 1,
            influence: 1,
          },
        },
        {
          label: '夜間の治安出動を命じる',
          summary: '治安優先を示しつつ律に力を貸さない姿勢を示した。',
          effects: {
            affection: 1,
            support: { military: 2 },
            scandal: 0.03,
          },
        },
      ],
    },
    {
      id: 'soldier_training',
      candidateId: 'soldier',
      offset: 8,
      title: '軍営の夜',
      description: '軍人・優に招かれ、訓練場で分隊を視察する。',
      choices: [
        {
          label: '士官と飲み交わす',
          summary: '軍の士気を重視し、優との約束を深めた。',
          effects: {
            affection: 5,
            influence: 2,
            support: { military: 4, clergy: -1 },
            stability: 2,
          },
        },
        {
          label: '静かに筆を取り戦略を吟味',
          summary: '軍と相談しつつ冷静な判断を見せた。',
          effects: {
            affection: 2,
            support: { nobility: 1 },
            scandal: 0.02,
          },
        },
      ],
    },
    {
      id: 'noble_progress',
      candidateId: 'noble',
      offset: 10,
      title: '庭園の対話',
      description: '奏と庭園を歩きながら魔法研究の展望を語る。',
      choices: [
        {
          label: '研究者たちを称える',
          summary: '魔法研究への理解を示し、奏と同じ視線を得た。',
          effects: {
            affection: 4,
            support: { citizens: 1, nobility: 2 },
            influence: 1,
          },
        },
        {
          label: '伝統と秩序を強調する',
          summary: '秩序を重んじる姿勢に、保守層が安心を感じた。',
          effects: {
            affection: 2,
            support: { nobility: 3 },
            scandal: 0.01,
          },
        },
      ],
    },
    {
      id: 'activist_campaign',
      candidateId: 'activist',
      offset: 14,
      title: '民衆の声',
      description: '律に誘われ、庶民地区で行動を共にする。',
      choices: [
        {
          label: '移民支援を約束',
          summary: '政策転換の兆しを見せ、律との結びつきが強まった。',
          effects: {
            affection: 4,
            support: { citizens: 3 },
            stability: 1,
          },
        },
        {
          label: '経済繁栄を優先',
          summary: '商人と共に繁栄策を語り、貴族の評価を維持した。',
          effects: {
            support: { nobility: 2 },
            scandal: 0.02,
          },
        },
      ],
    },
    {
      id: 'soldier_guard',
      candidateId: 'soldier',
      offset: 16,
      title: '忠誠の誓い',
      description: '優が前線指揮を終え帰還し、王へ忠誠を誓う。',
      choices: [
        {
          label: '軍務を祝し礼を返す',
          summary: '軍の絆が深まり、優との距離も縮まる。',
          effects: {
            affection: 4,
            influence: 2,
            support: { military: 3, clergy: -1 },
            stability: 2,
          },
        },
        {
          label: '冷静に戦況を分析',
          summary: '策士の目で情勢を読む姿勢が評価された。',
          effects: {
            support: { citizens: 1 },
            scandal: 0.02,
          },
        },
      ],
    },
  ];
  const ROMANCE_STAGES = [
    {
      id: 'romance_noble',
      offset: 6,
      candidateId: 'noble',
      title: '静かな挨拶',
      summary: '王令新聞「静かな挨拶」奏と王が視線を交わした。防衛団もその存在に目を向ける。',
      paragraphs: [
        '宮廷晩餐にて、貴族の令嬢・奏がギャラリー越しに穏やかな視線を送る。',
        '王令新聞は「静かな挨拶」と題し、王と奏の距離が少し縮まったことを伝えた。',
      ],
      actionId: 'story_romance_noble',
    },
    {
      id: 'romance_activist',
      offset: 12,
      candidateId: 'activist',
      title: '草の根の火花',
      summary: '王令新聞「草の根の火花」民衆の声を代弁する律と王が路地で言葉を交わした。',
      paragraphs: [
        '庶民出身の活動家・律が、街角の演説後に静かに王に語り掛けた。',
        '王令新聞は「草の根の火花」と記し、支持・勢力のバランスが新たな色を帯びたと報じる。',
      ],
      actionId: 'story_romance_activist',
    },
    {
      id: 'romance_soldier',
      offset: 18,
      candidateId: 'soldier',
      title: '戦友との夜',
      summary: '王令新聞「戦友との夜」優と共に訓練を見守った王の背中を、師団が追う。',
      paragraphs: [
        '王は軍営を訪れ、主人公と同性の軍人・優と訓練場を歩いた。',
        '王令新聞は「戦友との夜」と題し、同じ軍歌を口ずさむ二人の距離を伝えた。',
      ],
      actionId: 'story_romance_soldier',
    },
  ];
  const ROMANCE_ENGAGEMENT_OFFSET = 24;

  function ensureRomanceData(state) {
    if (!state) return null;
    if (!state.romanceData) {
      state.romanceData = createRomanceDataTemplate();
    }
    return state.romanceData;
  }

  function getRomanceCandidateData(state, candidateId) {
    const data = ensureRomanceData(state);
    return data && candidateId ? data[candidateId] : null;
  }

  function adjustPlayerSupport(faction, delta) {
    if (!faction || delta === 0) return;
    const playerChar = characters.player;
    if (!playerChar) return;
    if (!playerChar.support) playerChar.support = {};
    const current = Number(playerChar.support[faction]) || 50;
    playerChar.support[faction] = clamp(current + delta, 0, 100);
  }

  function adjustNationStability(delta) {
    if (!Number.isFinite(delta) || delta === 0) return;
    cities.forEach(city => {
      if (!city) return;
      city.stability = clamp((city.stability || 50) + delta, 0, 120);
    });
  }

  function createRomanceDataTemplate() {
    const template = {};
    ROMANCE_CANDIDATES.forEach(candidate => {
      template[candidate.id] = {
        affection: candidate.initialAffection ?? 50,
        politicalInfluence: candidate.initialInfluence ?? 50,
        scandalMomentum: 0,
        scandalTriggered: false,
        factionSupport: { ...(candidate.factionSupport || {}) },
      };
    });
    return template;
  }

  const METROPOLITAN_POP_THRESHOLD = 9000;
  const METROPOLITAN_DISTANCE = 10;
  const METROPOLITAN_GROWTH_BONUS = 0.02;
  const METROPOLITAN_MIN_CLUSTER = 2;

  const POPULATION_PLANS = [
    {
      id: 'immigration',
      label: '移民受け入れ計画',
      description: '外国人と新市民を受け入れ、都市の人口と繁栄を一気に押し上げます。',
      popBoost: 1200,
      stability: -4,
      prosperity: 1.4,
      summary: '王令新聞「移民受け入れ計画」{city}の人口は急増し、新たな活気を得た。',
    },
    {
      id: 'daemon_cohab',
      label: '魔族共生計画',
      description: '魔族を共生者として迎え、魔力と労働力を取り込む大胆な決断。',
      popBoost: 800,
      stability: -6,
      prosperity: 2.1,
      military: 5,
      summary: '王令新聞「魔族共生計画」{city}では魔力の奔流とともに人口が増えた。',
    },
  ];

  function createStoryPhaseFlags() {
    return {
      buildingEra: false,
      politicsEra: false,
      divisionEra: false,
    };
  }

  function getDefaultStoryChapterId() {
    return DEFAULT_STORY_CHAPTER_ID;
  }

  function getChapterDefinition(chapterId) {
    const id = chapterId || getDefaultStoryChapterId();
    return STORY_CHAPTERS[id] || STORY_CHAPTERS[getDefaultStoryChapterId()] || null;
  }

  function createChapterProgressState() {
    const defaultChapter = getChapterDefinition(getDefaultStoryChapterId());
    return {
      currentChapterId: defaultChapter ? defaultChapter.chapterId : null,
      chapterFlags: {},
      chapterMetrics: { uncertainty: 0 },
    };
  }

  function ensureChapterProgress(state) {
    if (!state) return null;
    if (!state.chapterProgress) {
      state.chapterProgress = createChapterProgressState();
    }
    if (!state.chapterProgress.chapterMetrics) {
      state.chapterProgress.chapterMetrics = { uncertainty: 0 };
    }
    return state.chapterProgress;
  }

  function ensureChapterFlags(state, chapterId) {
    const progress = ensureChapterProgress(state);
    if (!progress) return null;
    const id = chapterId || progress.currentChapterId;
    if (!id) return null;
    if (!progress.chapterFlags[id]) {
      const def = getChapterDefinition(id);
      progress.chapterFlags[id] = def && def.flags ? { ...def.flags } : {};
    }
    return progress.chapterFlags[id];
  }

  const PRE_SUCCESSION_NEWS_EVENTS = [
    {
      turn: 4,
      title: '王令新聞：候補者巡覧',
      summary: '王令新聞「候補者巡覧」防衛団と師団の編成が最初の注目点となる。',
      body: [
        '王候補たちは都市を巡り、防衛団ごとの強さと師団の配置を確認しながら歩を進めた。',
        'ラウル・グレイヴは砦の再編を誓い、リリア・アステルは魔法研究と民の対話を掲げ、あなたはその空気を見守る。',
      ],
    },
    {
      turn: 11,
      title: '王令新聞：軍備と魔法の綾',
      summary: '王令新聞「軍備と魔法の綾」防衛団を巡る発言と魔法研究の展開が交差する。',
      body: [
        '軍務の会議では都市の防衛団の動員法が語られ、師団の資源配分も併せて検討された。',
        '魔法研究所では研究者たちが防衛団と協調する模索を重ね、あなたは守るべきバランスを探る。',
      ],
    },
    {
      turn: 18,
      title: '王令新聞：NPC戦略会議',
      summary: '王令新聞「NPC戦略会議」ラウルもリリアも新たな策を練り、政治的火花が散る。',
      body: [
        '候補たちが酒宴を開き、師団の行動計画と魔法の支援をめぐって密談し始めた。',
        'セシルは法の整備を、リリアは穏健な改革を、ラウルは強硬な再編を主張し、あなたはそれぞれに立ち向かう。',
      ],
    },
    {
      turn: 25,
      title: '王令新聞：火種の兆し',
      summary: '王令新聞「火種の兆し」内戦と外征の両方がささやかれ、防衛団も緊張を抱える。',
      body: [
        '城下では防衛団が内戦の噂を払い、師団の配備が人々の目を集めた。',
        '隣国の圧力も聞こえ、あなたは双方の緊張を沈めつつ援軍を整えるよう命じる。',
      ],
    },
    {
      turn: 32,
      title: '王令新聞：推薦の行方',
      summary: '王令新聞「推薦の行方」最後の推薦と防衛団の整備が次の段階へ進む。',
      body: [
        '評議会は候補への推薦状を交換し、都市ごとの防衛団と師団の安定を重視し始めた。',
        '王令新聞はあなたの調停が決選の鍵になるとし、師団の整備点検を報じる。',
      ],
    },
    {
      turn: 38,
      title: '王令新聞：3年4月の前夜',
      summary: '王令新聞「3年4月の前夜」王命を決める最後の週、王位の火花が立ち昇る。',
      body: [
        '3年4月が迫り、都市ごとの防衛団と師団が整い、王命の儀式を控えて静謐な緊張が漂う。',
        '王令新聞はこの時点で最後の舌戦を伝え、あなたは世界の皮膚を再び辿る。',
      ],
    },
  ];

  const STORY_REIGN_MONTHS_FOR_END = 50 * 12;
  const STORY_STABILITY_THRESHOLD = 75;
  const STORY_STABILITY_STREAK_MONTHS = 5 * 12;
  const STORY_BUILDING_TURN = 4;
  const STORY_PROLOGUE_END_TURN = 1;
  const STORY_POLITICS_OFFSET = 2;
  const STORY_DIVISION_OFFSET = 6;
  const STORY_CHAPTERS = {
    chapter_01: {
      chapterId: 'chapter_01',
      title: '静かな継承',
      introText: 'ハルバート王国は平穏である。しかし、落ち着いてはいない。王は健在で、皇子たちは異なる未来を窺っている。',
      brokenEngagementText: 'エドワード皇子はルーン家との婚約解消を発表した。理由は「国家の事情を再考するため」だという。',
      worldReactionTexts: [
        'いま、王国の制度を支えているのは誰なのか？',
        'あの婚約は、想像以上の重みを抱えていたのだろうか？',
        '廷臣たちの足取りが静かになった。',
      ],
      thirdPrinceText: 'アルト皇子が非公式の面会を求めてきた。即位の話はせず、礼節ある会話だけを交わすという。',
      thirdPrinceChoices: [
        {
          id: 'courteous',
          label: '礼節ある応対',
          summary: '冷静な受け答えで礼節を保ちつつ、穏やかな空気をつくる。',
        },
        {
          id: 'distance',
          label: '一定の距離を置く',
          summary: '継承の香りがする話題は避け、距離を保った会話に徹する。',
        },
      ],
      choiceText: '誰を王にするかは決められない。でも、王国をどう支えるかなら決めることができる。',
      choiceOptions: [
        {
          id: 'stability',
          label: '治安と制度を優先する',
          summary: '軍と貴族への信頼を強め、秩序を堅固に守る方針。',
        },
        {
          id: 'reform',
          label: '改革と柔軟性を推進する',
          summary: '民衆に寄り添い、宮廷の監視を緩めて変化を示す。',
        },
      ],
      endText: '王国は今も立っている。人々は気づき始めた。誰が統治するかではなく、今それを支えている者が誰かを。',
      startTurn: 1,
      endTurn: 12,
      flags: {
        introShown: false,
        engagementBroken: false,
        worldReactionShown: false,
        altoContacted: false,
        chapterChoice: null,
        altoChoice: null,
        altoTrust: 0,
        lastPassiveTurn: null,
        endEventShown: false,
        runeHouseStatus: 'intact',
        princeFactionActive: false,
      },
    },
  };
  const DEFAULT_STORY_CHAPTER_ID = 'chapter_01';
  function createStoryScenarioState() {
    return {
      stage: STORY_SCENARIOS.ARRIVAL,
      arrivalAnnounced: false,
      investigationAnnounced: false,
      successionNarrativeShown: false,
      storyEventsUnlocked: false,
      oppositionMode: false,
      successionTurn: null,
      failureAnnounced: false,
      phaseFlags: createStoryPhaseFlags(),
      preSuccessionIndex: 0,
      stabilityStreakMonths: 0,
      storyEndReady: false,
      storyEndInvoked: false,
      legacyAnnounced: false,
      romanceStages: {},
      romanceEngagementAnnounced: false,
      romanceEngagedCandidate: null,
      romanceData: createRomanceDataTemplate(),
      romanceInteractions: {},
      romanceScandalTriggered: false,
      romanceMissedOpportunity: false,
      chapterProgress: createChapterProgressState(),
    };
  }

  let storyScenarioState = createStoryScenarioState();

  function ensureStoryScenarioState() {
    if (!storyScenarioState) {
      storyScenarioState = createStoryScenarioState();
    }
    return storyScenarioState;
  }

  function resetStoryScenarioState() {
    storyScenarioState = createStoryScenarioState();
  }

  function restoreStoryScenarioState(data) {
    if (data && typeof data === 'object') {
      const copy = { ...createStoryScenarioState(), ...data };
      const baseState = createStoryScenarioState();
      copy.phaseFlags = { ...createStoryPhaseFlags(), ...(data.phaseFlags || {}) };
      copy.romanceData = { ...baseState.romanceData, ...(data.romanceData || {}) };
      copy.romanceInteractions = { ...baseState.romanceInteractions, ...(data.romanceInteractions || {}) };
      copy.romanceScandalTriggered = typeof data.romanceScandalTriggered === 'boolean' ? data.romanceScandalTriggered : false;
      copy.romanceMissedOpportunity = typeof data.romanceMissedOpportunity === 'boolean' ? data.romanceMissedOpportunity : false;
      copy.chapterProgress = {
        ...baseState.chapterProgress,
        ...(data.chapterProgress || {}),
      };
      copy.chapterProgress.chapterMetrics = {
        ...baseState.chapterProgress.chapterMetrics,
        ...((data.chapterProgress && data.chapterProgress.chapterMetrics) || {}),
      };
      const validStages = new Set(Object.values(STORY_SCENARIOS));
      copy.stage = validStages.has(copy.stage) ? copy.stage : STORY_SCENARIOS.ARRIVAL;
      copy.romanceStages = { ...createStoryScenarioState().romanceStages, ...(data.romanceStages || {}) };
      copy.romanceEngagementAnnounced = typeof data.romanceEngagementAnnounced === 'boolean' ? data.romanceEngagementAnnounced : false;
      copy.romanceEngagedCandidate = data.romanceEngagedCandidate || null;
      storyScenarioState = copy;
    } else {
      resetStoryScenarioState();
    }
  }

  function publishStoryNews(summary, actorName = '王令新聞') {
    if (!summary || typeof summary !== 'string') return;
    const entry = [{ actorName, summary }];
    showRoyalNewspaper(entry, currentTurn);
  }

  function createStoryNarrativeContainer(paragraphs) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    (paragraphs || []).forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      container.appendChild(p);
    });
    return container;
  }

  function showStoryNarrativeOverlay(opts) {
    if (!storyOverlayRoot || !opts) return false;
    const { id, title, paragraphs, summary, actionId, buttonLabel } = opts;
    if (!id || overlayStack.find(o => o.id === id)) return false;
    const container = createStoryNarrativeContainer(paragraphs);
    const mobileUI = document.body && document.body.classList.contains('mobile-ui-enabled');
    if (mobileUI && openMobileRoyalNewsPanel(paragraphs.map(text => ({
      actorName: '王令新聞',
      summary: text,
      turn: currentTurn,
    })), currentTurn)) {
      if (summary) {
        publishStoryNews(summary);
        recordStoryAction('player', actionId, {
          actorName: '王令新聞',
          storyLabel: summary,
        });
      }
      return true;
    }
    showStoryOverlay({
      id,
      title,
      body: container,
      modal: false,
      buttons: [{ label: buttonLabel || '了解', action: () => closeStoryOverlay(id) }],
      animate: true,
      width: Math.min(520, window.innerWidth - 40),
    });
    if (summary) {
      publishStoryNews(summary);
      recordStoryAction('player', actionId, {
        actorName: '王令新聞',
        storyLabel: summary,
      });
    }
    return true;
  }

  function showStoryFailureOverlay(state) {
    if (!state || state.failureAnnounced) return false;
    const paragraphs = [
      '昨年の王は混迷を招き、市民は失政と暴政の名を囁いた。不満の火種は燻り続けていた。',
      '王令新聞「去年の王の失策」は、統治の裂け目を伝え、新たな旗手への期待を重ねている。',
      '現代からの転生者であるあなたは、沸き起こる喧騒の中心に召喚された。これが新しい歴史の胎動だ。',
    ];
    const summary = '王令新聞「去年の王の失策」混迷の一年を振り返る。';
    const shown = showStoryNarrativeOverlay({
      id: 'story-prologue-failure',
      title: '去年の王の失策',
      paragraphs,
      summary,
      actionId: 'story_prologue_failure',
    });
    if (shown) {
      state.failureAnnounced = true;
    }
    return shown;
  }

  function maybeTriggerStoryFailure(state) {
    if (!state) return false;
    if (state.failureAnnounced) return false;
    if (currentTurn > STORY_PROLOGUE_END_TURN) return false;
    return showStoryFailureOverlay(state);
  }

  function maybeTriggerBuildingEra(state) {
    if (!state || state.phaseFlags.buildingEra) return false;
    if (state.stage !== STORY_SCENARIOS.PRE_SUCCESSION) return false;
    if (!state.investigationAnnounced) return false;
    if (currentTurn !== STORY_BUILDING_TURN) return false;
    const paragraphs = [
      '序章で世界を視たあなたは、まずインフラ・治安・魔法に集中する「建設の時代」に身を置く。',
      '王令新聞は「建設の時代」と号し、都市ごとの防衛団・治安部隊・研究所の様子を細かく伝える。',
      'NPCたちの評価はこの時期に蓄積され、やがて政治の舞台をどう彩るかが見えてくる。',
    ];
    const summary = '王令新聞「建設の時代」インフラ・治安・魔法に集約された行動が続く。';
    const shown = showStoryNarrativeOverlay({
      id: 'story-era-building',
      title: '第一部：建設の時代',
      paragraphs,
      summary,
      actionId: 'story_building_era',
    });
    if (shown) {
      state.phaseFlags.buildingEra = true;
    }
    return shown;
  }

  function maybeTriggerPoliticalEra(state) {
    if (!state || state.phaseFlags.politicsEra) return false;
    if (!state.successionNarrativeShown || !state.storyEventsUnlocked) return false;
    if (state.successionTurn == null) return false;
    const triggerTurn = state.successionTurn + STORY_POLITICS_OFFSET;
    if (currentTurn !== triggerTurn) return false;
    const paragraphs = [
      '王令新聞「政治の時代」は、法律・派閥・外交が解禁されたことを伝える。',
      'NPCたちは能動的に動き出し、議会や外交使節の足跡が目立ち始めた。',
      'あなたも一歩踏み出し、支持・勢力のバランスを見定めながら、新たな方針を模索する。',
    ];
    const summary = '王令新聞「政治の時代」法律と外交が列島を揺るがす。';
    const shown = showStoryNarrativeOverlay({
      id: 'story-era-politics',
      title: '第二部：政治の時代',
      paragraphs,
      summary,
      actionId: 'story_politics_era',
    });
    if (shown) {
      state.phaseFlags.politicsEra = true;
    }
    return shown;
  }

  function showRomanceStageOverlay(state, stage) {
    if (!state || !stage) return false;
    const overlayId = `story-romance-${stage.id}`;
    if (overlayStack.find(o => o.id === overlayId)) return true;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    (stage.paragraphs || []).forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      container.appendChild(p);
    });
    timeControl.speed = 0;
    updateControlButtons();
    showStoryOverlay({
      id: overlayId,
      title: stage.title,
      body: container,
      modal: false,
      buttons: [{ label: 'その絆を感じる', action: () => closeStoryOverlay(overlayId) }],
      animate: true,
      width: Math.min(520, window.innerWidth - 40),
    });
    publishStoryNews(stage.summary);
    recordStoryAction('player', stage.actionId, {
      storyLabel: stage.summary,
    });
    state.romanceStages[stage.id] = true;
    return true;
  }

  function getRomanceCandidate(id) {
    return ROMANCE_CANDIDATES.find(entry => entry.id === id) || null;
  }

  function maybeTriggerRomanceStage(state) {
    if (!state || state.stage !== STORY_SCENARIOS.POST_SUCCESSION) return false;
    if (roles.player !== 'king') return false;
    if (state.successionTurn == null) return false;
    return ROMANCE_STAGES.some(stage => {
      if (state.romanceStages[stage.id]) return false;
      if (currentTurn !== (state.successionTurn + stage.offset)) return false;
      showRomanceStageOverlay(state, stage);
      return true;
    });
  }

  function showRomanceInteractionOverlay(state, interaction) {
    if (!storyOverlayRoot || !interaction) return false;
    const overlayId = `story-romance-interaction-${interaction.id}`;
    if (overlayStack.find(o => o.id === overlayId)) return true;
    const candidate = getRomanceCandidate(interaction.candidateId);
    if (!candidate) return false;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const desc = document.createElement('p');
    desc.textContent = interaction.description || `候補者 ${candidate.label} との面会。`;
    container.appendChild(desc);
    (interaction.choices || []).forEach(choice => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'flex-start';
      row.style.padding = '8px';
      row.style.borderRadius = '8px';
      row.style.border = '1px solid rgba(255,255,255,0.08)';
      row.style.background = 'rgba(255,255,255,0.03)';
      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '4px';
      const label = document.createElement('strong');
      label.textContent = choice.label;
      const summary = document.createElement('span');
      summary.style.fontSize = '12px';
      summary.style.opacity = '0.7';
      summary.textContent = choice.summary || '静かに選ぶ。';
      info.appendChild(label);
      info.appendChild(summary);
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.type = 'button';
      btn.textContent = 'その方向で進める';
      btn.addEventListener('click', () => {
        applyRomanceInteractionChoice(state, interaction, choice, candidate, overlayId);
      });
      row.appendChild(info);
      row.appendChild(btn);
      container.appendChild(row);
    });
    timeControl.speed = 0;
    updateControlButtons();
    showStoryOverlay({
      id: overlayId,
      title: interaction.title || `${candidate.label}との交流`,
      body: container,
      modal: false,
      buttons: [{ label: '少し時間をおく', action: () => closeStoryOverlay(overlayId) }],
      animate: true,
      width: Math.min(520, window.innerWidth - 40),
    });
    return true;
  }

  function applyRomanceInteractionChoice(state, interaction, choice, candidate, overlayId) {
    if (!state || !interaction || !choice || !candidate) return;
    const data = getRomanceCandidateData(state, interaction.candidateId);
    if (!data) return;
    const effects = choice.effects || {};
    data.affection = clamp((data.affection || 50) + (effects.affection || 0), 0, 100);
    data.politicalInfluence = clamp((data.politicalInfluence || 50) + (effects.influence || 0), 0, 100);
    if (effects.support) {
      Object.entries(effects.support).forEach(([faction, delta]) => {
        adjustPlayerSupport(faction, delta);
      });
    }
    if (effects.stability) {
      adjustNationStability(effects.stability);
    }
    if (effects.scandal) {
      data.scandalMomentum = Math.min(1, (data.scandalMomentum || 0) + effects.scandal);
    }
    state.romanceInteractions[interaction.id] = true;
    const summary = choice.summary || `${candidate.label}との時間が深まった。`;
    publishStoryNews(summary);
    recordStoryAction('player', interaction.id, { storyLabel: summary });
    if (tileInfoEl) {
      tileInfoEl.textContent = summary;
    }
    closeStoryOverlay(overlayId);
    maybeTriggerRomanceScandal(state);
  }

  function maybeTriggerRomanceInteraction(state) {
    if (!state || state.stage !== STORY_SCENARIOS.POST_SUCCESSION) return false;
    if (roles.player !== 'king') return false;
    if (state.successionTurn == null) return false;
    const relative = currentTurn - state.successionTurn;
    return ROMANCE_INTERACTIONS.some(interaction => {
      if (state.romanceInteractions[interaction.id]) return false;
      if (relative !== interaction.offset) return false;
      showRomanceInteractionOverlay(state, interaction);
      return true;
    });
  }

  function showRomanceScandalOverlay(state, candidate, data) {
    if (!storyOverlayRoot || !candidate || !state || !data) return false;
    const overlayId = `story-romance-scandal-${candidate.id}`;
    if (overlayStack.find(o => o.id === overlayId)) return true;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const paragraph = document.createElement('p');
    paragraph.textContent = `${candidate.label}との接近を「王令新聞」が好意的に伝えるも、スキャンダルの気配が漂った。`;
    container.appendChild(paragraph);
    const note = document.createElement('span');
    note.style.fontSize = '12px';
    note.style.opacity = '0.7';
    note.textContent = '諜報筋は「過去の関係性が掘り起こされる可能性がある」と報じている。';
    container.appendChild(note);
    timeControl.speed = 0;
    updateControlButtons();
    showStoryOverlay({
      id: overlayId,
      title: 'スキャンダルの兆し',
      body: container,
      modal: false,
      buttons: [{ label: '焦らず誠意を示す', action: () => closeStoryOverlay(overlayId) }],
      animate: true,
      width: Math.min(520, window.innerWidth - 40),
    });
    const summary = `王令新聞「スキャンダルの兆し」${candidate.label}への注目が一部勢力の反発を呼ぶ。`;
    publishStoryNews(summary);
    recordStoryAction('player', `story_romance_scandal_${candidate.id}`, { storyLabel: summary });
    adjustPlayerSupport('nobility', -2);
    adjustPlayerSupport('citizens', -2);
    adjustNationStability(-2);
    data.scandalTriggered = true;
    state.romanceScandalTriggered = true;
    if (tileInfoEl) {
      tileInfoEl.textContent = summary;
    }
    return true;
  }

  function maybeTriggerRomanceScandal(state) {
    if (!state || state.stage !== STORY_SCENARIOS.POST_SUCCESSION) return false;
    if (roles.player !== 'king') return false;
    if (state.successionTurn == null) return false;
    if (state.romanceScandalTriggered) return false;
    return ROMANCE_CANDIDATES.some(candidate => {
      const data = getRomanceCandidateData(state, candidate.id);
      if (!data || data.scandalTriggered) return false;
      const chance = (candidate.scandalRisk || 0.02) + (data.scandalMomentum || 0);
      if (Math.random() < chance) {
        showRomanceScandalOverlay(state, candidate, data);
        return true;
      }
      return false;
    });
  }

  function applyRomanceEngagementEffects(candidate) {
    if (!candidate) return;
    const factions = candidate.factionSupport || {};
    Object.entries(factions).forEach(([faction, weight]) => {
      adjustPlayerSupport(faction, weight * 2);
    });
    adjustNationStability(3);
  }

  function finalizeRomanceEngagement(overlayId, state, candidate) {
    if (!state || !candidate) return;
    applyRomanceEngagementEffects(candidate);
    state.romanceEngagedCandidate = candidate.id;
    state.romanceEngagementAnnounced = true;
    const summary = `王令新聞「婚約の鐘」${candidate.label}（${candidate.name}）との婚約を決めた。`;
    publishStoryNews(summary);
    recordStoryAction('player', 'story_romance_engaged', {
      storyLabel: summary,
    });
    if (tileInfoEl) {
      tileInfoEl.textContent = `${candidate.label}（${candidate.name}）との婚約が発表された。`;
    }
    closeStoryOverlay(overlayId);
  }

  function handleRomancePostpone(state, overlayId) {
    if (!state || !overlayId) return;
    state.romanceMissedOpportunity = true;
    if (!state.romanceEngagementAnnounced) {
      state.romanceEngagementAnnounced = true;
    }
    const summary = '王令新聞「婚約の余白」婚約の決断を後回しにしたことで、一部勢力に不信が広がる。';
    publishStoryNews(summary);
    recordStoryAction('player', 'story_romance_postpone', { storyLabel: summary });
    adjustPlayerSupport('nobility', -2);
    adjustPlayerSupport('citizens', -2);
    adjustNationStability(-2);
    if (tileInfoEl) {
      tileInfoEl.textContent = summary;
    }
    closeStoryOverlay(overlayId);
  }

  function openRomanceEngagementOverlay(state) {
    if (!state || state.romanceEngagementAnnounced) return false;
    const overlayId = 'story-romance-engagement';
    if (overlayStack.find(o => o.id === overlayId)) return true;
    state.romanceEngagementAnnounced = true;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const intro = document.createElement('p');
    intro.textContent = '王令新聞「婚約の鐘」— 王は候補たちとの絆を選び、国家に新しい物語を刻もうとしている。';
    container.appendChild(intro);
    ROMANCE_CANDIDATES.forEach(candidate => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '8px';
      row.style.borderRadius = '10px';
      row.style.background = 'rgba(255,255,255,0.02)';
      row.style.border = '1px solid rgba(255,255,255,0.08)';
      const info = document.createElement('div');
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '4px';
      const title = document.createElement('strong');
      title.textContent = `${candidate.label} (${candidate.name})`;
      const detail = document.createElement('span');
      detail.style.fontSize = '12px';
      detail.style.opacity = '0.7';
      detail.textContent = candidate.note;
      info.appendChild(title);
      info.appendChild(detail);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = '婚約する';
      btn.addEventListener('click', () => finalizeRomanceEngagement(overlayId, state, candidate));
      row.appendChild(info);
      row.appendChild(btn);
      container.appendChild(row);
    });
    timeControl.speed = 0;
    updateControlButtons();
    showStoryOverlay({
      id: overlayId,
      title: '婚約の決断',
      body: container,
      modal: false,
      buttons: [{ label: '後で考える', action: () => handleRomancePostpone(state, overlayId) }],
      animate: true,
      mobileTitle: '婚約候補',
      width: Math.min(520, window.innerWidth - 40),
    });
    return true;
  }

  function maybeTriggerRomanceEngagement(state) {
    if (!state || state.stage !== STORY_SCENARIOS.POST_SUCCESSION) return false;
    if (roles.player !== 'king') return false;
    if (state.successionTurn == null) return false;
    if (state.romanceEngagementAnnounced) return false;
    if (currentTurn < state.successionTurn + ROMANCE_ENGAGEMENT_OFFSET) return false;
    return openRomanceEngagementOverlay(state);
  }

  function maybeTriggerDivisionEra(state) {
    if (!state || state.phaseFlags.divisionEra) return false;
    if (!state.phaseFlags.politicsEra) return false;
    if (state.successionTurn == null) return false;
    const triggerTurn = state.successionTurn + STORY_DIVISION_OFFSET;
    if (currentTurn !== triggerTurn) return false;
    const rulerLine = roles.player === 'king'
      ? '王であってもすべてを決められない孤独と無力感が胸を締めつける。'
      : '王でなくとも、王位の影を背負って抗う掌握感が薄い。';
    const paragraphs = [
      '王令新聞「分裂の時代」は、内戦か権力闘争の火花が再び燃え上がったことを伝える。',
      '師団と防衛団の一部は異なる旗の元に動き、都市間の緊張が高まる。',
      rulerLine,
    ];
    const summary = '王令新聞「分裂の時代」内戦と権力闘争の火花が舞う。';
    const shown = showStoryNarrativeOverlay({
      id: 'story-era-division',
      title: '第三部：分裂の時代',
      paragraphs,
      summary,
      actionId: 'story_division_era',
    });
    if (shown) {
      state.phaseFlags.divisionEra = true;
    }
    return shown;
  }

  function triggerStoryWorldEvent(eventId) {
    if (!eventId) return;
    const event = WORLD_EVENTS.find(evt => evt && evt.id === eventId);
    if (!event) return;
    applyWorldEvent(event);
  }

  function maybeTriggerPreSuccessionNews(state) {
    if (!state || state.stage !== STORY_SCENARIOS.PRE_SUCCESSION) return false;
    const idx = Number.isFinite(state.preSuccessionIndex) ? state.preSuccessionIndex : 0;
    if (!PRE_SUCCESSION_NEWS_EVENTS.length || idx >= PRE_SUCCESSION_NEWS_EVENTS.length) return false;
    const nextEvent = PRE_SUCCESSION_NEWS_EVENTS[idx];
    if (currentTurn !== nextEvent.turn) return false;
    const overlayId = `story-pre-succession-${idx}`;
    if (overlayStack.find(o => o.id === overlayId)) return true;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    (nextEvent.body || []).forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      container.appendChild(p);
    });
    showStoryOverlay({
      id: overlayId,
      title: nextEvent.title,
      body: container,
      modal: false,
      animate: true,
      buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
      width: Math.min(520, window.innerWidth - 40),
    });
    publishStoryNews(nextEvent.summary);
    recordStoryAction('player', 'story_pre_succession', {
      actorName: '王令新聞',
      storyLabel: nextEvent.summary,
    });
    state.preSuccessionIndex = idx + 1;
    return true;
  }

  function announceStoryEndReady(state, reason) {
    if (!state) return;
    const summary = reason === 'time'
      ? '王令新聞「長き治世の区切り」即位50年を経て譲位を問いかける。'
      : '王令新聞「安定の継承」国家安定度が5年連続で高水準を保持し、譲位の扉が開く。';
    publishStoryNews(summary);
    recordStoryAction('player', 'story_end_ready', {
      actorName: '王令新聞',
      storyLabel: summary,
    });
    if (tileInfoEl) {
      tileInfoEl.textContent = '王令新聞が譲る時が来たと報じています。';
    }
  }

  function updateStoryEndCondition() {
    if (!isStoryMode) return;
    const state = ensureStoryScenarioState();
    if (!state || state.storyEndReady) return;
    if (state.successionTurn == null) return;
    const stability = (getNationState().stability || 0);
    if (stability >= STORY_STABILITY_THRESHOLD) {
      state.stabilityStreakMonths = Math.min((state.stabilityStreakMonths || 0) + 1, STORY_STABILITY_STREAK_MONTHS);
    } else {
      state.stabilityStreakMonths = 0;
    }
    const reignMonths = Math.max(0, currentTurn - state.successionTurn);
    const stabilityReady = state.stabilityStreakMonths >= STORY_STABILITY_STREAK_MONTHS;
    if (reignMonths >= STORY_REIGN_MONTHS_FOR_END || stabilityReady) {
      state.storyEndReady = true;
      const reason = reignMonths >= STORY_REIGN_MONTHS_FOR_END ? 'time' : 'stability';
      announceStoryEndReady(state, reason);
    }
  }

  function showStoryArrivalOverlay(state) {
    const overlayId = 'story-arrival';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const paragraphs = [
      '現代からの旅人であるあなたは、失政を重ねて王都を去った前王のあとを受けて召喚され、混乱に満ちた城塞の中で身を起こした。',
      '王令新聞は「王位の空白」と大見出しを打ち、都市の民衆は怯えと希望を同時に抱いている。前王の顔はどこにもなく、灰色の霧が街を覆う。',
      'まずはこの国を歩き、インフラ、研究、そして民の声に触れること。王に相応しい姿を見せる前に、世界の皮膚を知るのだ。'
    ];
    paragraphs.forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      container.appendChild(p);
    });
    showStoryOverlay({
      id: overlayId,
      title: '召喚の瞬間',
      body: container,
      modal: false,
      buttons: [{ label: '理解した', action: () => closeStoryOverlay(overlayId) }],
    });
    publishStoryNews('前王の失政と失踪、国は混乱の縁に立っている。新たな治世の候補としてあなたが召喚された。');
    recordStoryAction('player', 'story_arrival', { storyLabel: '現代から召喚され、王都の混乱を初めて視る' });
    state.arrivalAnnounced = true;
    state.stage = STORY_SCENARIOS.INVESTIGATION;
  }

  function showStoryInvestigationOverlay(state) {
    const overlayId = 'story-investigation';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const paragraphs = [
      'インフラ省の工房を歩き、放置された道路、疲弊した港、そして馬車鉄道の痕跡を目にした。整備しようにも資源は限られており、焦燥が匠の顔を覆っている。',
      '魔法研究所では、炎をまとった試験管と古の碑文の破片が並んでいた。魔力はまだ頼りないが、そこには可能性の光も確かに存在する。',
      '王令新聞は「候補者たちの提案の行列は尽きず、王推薦は進行中」と報じる。ラウル・グレイヴは軍備を掲げ、リリア・アステルは慈悲と学びを説き、セシル・ヴァレンは法整備を訴えている。'
    ];
    paragraphs.forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      container.appendChild(p);
    });
    showStoryOverlay({
      id: overlayId,
      title: '世界の皮膚を知る',
      body: container,
      modal: false,
      buttons: [{ label: '調査を続ける', action: () => closeStoryOverlay(overlayId) }],
    });
    publishStoryNews('現地視察を続ける中、候補者たちの提案は止まらず、王の推薦はゆっくりと進んでいる。');
    recordStoryAction('player', 'story_investigation', { storyLabel: 'インフラと魔法研究を巡り、候補者の提案が続くのを見守る' });
    state.investigationAnnounced = true;
    state.stage = STORY_SCENARIOS.PRE_SUCCESSION;
  }

  function handleStorySuccessionNarrative(state) {
    if (!successionResult) return;
    const playerIsKing = successionResult.winnerId === 'player';
    const overlayId = playerIsKing ? 'story-king-rule' : 'story-opposition';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const paragraphs = [];
    if (playerIsKing) {
      paragraphs.push(
        '多くの候補者が肩を並べた中、あなたが王となった。王位に立つと、無数の視線があなたの判断を求めた。',
        '王令新聞は「新王と内紛」と題して、未だ燻る不満と、防衛団・師団の再編の必要性を伝えている。王国はあなたの盾を求める。',
        '内戦の火種がくすぶる中、あなたは敵を抑えるため防衛団を引き締め、忠誠ある師団に目を向ける。'
      );
    } else {
      const winnerName = getCandidateName(successionResult.winnerId);
      paragraphs.push(
        `${winnerName} が王位に就いた。彼は強権的な姿勢を見せ、王令新聞も「新王の専制」だと騒ぎ立てる。`,
        'あなたはリリア・アステルと共に政権に対抗する道を選ぶ。反体制派の結束を固め、次の転機を探る。',
        '王令新聞は「反体制は暗渠の中で語られる」と伝え、あなたとリリアの名前を記事で探し始めている。'
      );
    }
    paragraphs.forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      container.appendChild(p);
    });
    showStoryOverlay({
      id: overlayId,
      title: playerIsKing ? '即位後の初陣' : '反体制の誓い',
      body: container,
      modal: false,
      buttons: [{ label: '未来へ', action: () => closeStoryOverlay(overlayId) }],
    });
    const newsSummary = playerIsKing
      ? '新王が即位した。王令新聞は内紛の気配を伝え、防衛団と師団を見直すよう促している。'
      : '強権的なラウル・グレイヴが王位に就いた。リリア・アステルとあなたが反体制の火種を燃やしている。';
    publishStoryNews(newsSummary);
    const actionId = playerIsKing ? 'story_succession_win' : 'story_succession_loss';
    recordStoryAction('player', actionId, { storyLabel: newsSummary });
    state.successionNarrativeShown = true;
    state.storyEventsUnlocked = true;
    state.oppositionMode = !playerIsKing;
    state.successionTurn = currentTurn;
    state.stage = STORY_SCENARIOS.POST_SUCCESSION;
    const primaryEvent = playerIsKing ? 'internal_tension_seed' : 'border_tension_seed';
    setTimeout(() => triggerStoryWorldEvent(primaryEvent), 800);
    setTimeout(() => triggerStoryWorldEvent('npc_strategy_session'), 1400);
  }

  function showStoryLegacyOverlay(state) {
    const overlayId = 'story-prelude';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const paragraphs = [];
    if (!state.oppositionMode) {
      paragraphs.push(
        '政権はわずかに安定を見せつつある。内戦の炎をいくつか押し込み、民衆は再び日常を取り戻した。',
        '王令新聞は「王は未来の世代を選ぶ」と見出しを打つ。あなたは次にこの国を託す者を心に描き、次の長を選ぶ準備を始める。'
      );
    } else {
      paragraphs.push(
        '反体制派としてのネットワークが育ちつつある。リリア・アステルは民衆に語り掛け、あなたは再び王位を目指す盟友を探している。',
        '王令新聞は「反体制の選択肢」と題して、あなたとリリアの動きを追う。次の長を決めるのは、この抵抗の中心になるだろう。'
      );
    }
    paragraphs.forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      container.appendChild(p);
    });
    showStoryOverlay({
      id: overlayId,
      title: '次の長の構想',
      body: container,
      modal: false,
      buttons: [{ label: 'その日を迎える', action: () => closeStoryOverlay(overlayId) }],
    });
    const summary = state.oppositionMode
      ? '反体制の候補が台頭し、王令新聞は次の長を誰が担うのかを煽っている。'
      : '政権安定の兆し。王令新聞は次の長を選ぶ準備を進めていると報じる。';
    publishStoryNews(summary);
    recordStoryAction('player', 'story_legacy', { storyLabel: summary });
    state.legacyAnnounced = true;
    state.stage = STORY_SCENARIOS.LEGACY;
  }

  const overlayStack = []; // { id, title, body, buttons:[{label, action}], modal:boolean, el }
  let overlayCounter = 0;
  let lastRoyalNewsOverlayId = null;

  const SE_SOURCES = {
    major: './music/se/fanfare.wav',
    news: './music/se/news.wav',
    decision: './music/se/news.wav',
    chain: './music/se/news.wav',
  };
  const seCache = {};

  let sysAudioCtx = null;
  function playSystemSound(type) {
    try {
      if (!sysAudioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) sysAudioCtx = new Ctx();
      }
      if (!sysAudioCtx) return;
      if (sysAudioCtx.state === 'suspended') sysAudioCtx.resume().catch(()=>{});
      
      const srcUrl = SE_SOURCES[type];
      if (!srcUrl) return;

      if (seCache[type]) {
        playSoundBuffer(seCache[type]);
        return;
      }

      fetch(srcUrl)
        .then(r => r.arrayBuffer())
        .then(buf => sysAudioCtx.decodeAudioData(buf))
        .then(decoded => {
          seCache[type] = decoded;
          playSoundBuffer(decoded);
        })
        .catch(err => console.warn('SE load error:', err));

      function playSoundBuffer(buffer) {
        const source = sysAudioCtx.createBufferSource();
        source.buffer = buffer;
        const gain = sysAudioCtx.createGain();
        gain.gain.value = 0.3; 
        source.connect(gain);
        gain.connect(sysAudioCtx.destination);
        source.start(0);
      }
    } catch(e) { console.warn('Audio error', e); }
  }

  function makeDraggable(el, handle) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    handle.style.cursor = 'move';
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return; // Don't drag if clicking a button in titlebar
      e.preventDefault();
      if (el.style.transform) {
        const rect = el.getBoundingClientRect();
        el.style.transform = 'none';
        el.style.left = `${rect.left}px`;
        el.style.top = `${rect.top}px`;
      }
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = `${initialLeft + dx}px`;
      el.style.top = `${initialTop + dy}px`;
    });
    handle.addEventListener('pointerup', (e) => {
      isDragging = false;
      handle.releasePointerCapture(e.pointerId);
    });
  }

  function appendContentTo(target, payload) {
    if (!target) return;
    target.innerHTML = '';
    if (!payload) return;
    const resolved = typeof payload === 'function' ? payload() : payload;
    if (!resolved) return;
    if (resolved instanceof Node) {
      target.appendChild(resolved);
      return;
    }
    const div = document.createElement('div');
    div.innerHTML = String(resolved);
    target.appendChild(div);
  }

  function showStoryOverlayMobile(options, overlayId) {
    if (!mobileModalShell) return null;
    const {
      title,
      body,
      buttons = [],
      modal=false,
      mobileTitle,
    } = options || {};
    const modalContainer = document.createElement('div');
    modalContainer.className = 'mobile-modal-window';
    const bodyEl = document.createElement('div');
    bodyEl.className = 'mobile-modal-body';
    appendContentTo(bodyEl, body);
    modalContainer.appendChild(bodyEl);
    const buttonRow = document.createElement('div');
    buttonRow.className = 'mobile-modal-buttons';
    const effectiveButtons = buttons && buttons.length ? buttons : [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }];
    effectiveButtons.forEach(cfg => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = cfg.label || 'OK';
      b.addEventListener('click', () => {
        if (typeof cfg.action === 'function') {
          cfg.action();
        }
      });
      buttonRow.appendChild(b);
    });
    modalContainer.appendChild(buttonRow);
    mobileModalShell.appendChild(modalContainer);
    const overlay = { id: overlayId, title, modal, el: modalContainer };
    overlayStack.push(overlay);
    const caption = typeof mobileTitle === 'string' ? mobileTitle : (typeof title === 'string' ? title : '');
    if (caption) {
      registerMobileOverlayEntry(overlayId, caption, () => closeStoryOverlay(overlayId));
    }
    updateMobileOverlayHeader();
    return overlayId;
  }

  function showStoryOverlay(options) {
    if (!storyOverlayRoot) return null;
    const {
      id,
      title,
      body,
      buttons=[],
      modal=false,
      onCreate,
      animate=false,
      tabs,
      initialTabId,
      topAlign=false,
      center=false,
      width,
      mobileTitle,
    } = options || {};
    const overlayId = id || `story-${++overlayCounter}`;
    const existing = overlayStack.find(o => o.id === overlayId);
    if (existing) {
      return overlayId;
    }
    const useMobileModal = document.body?.classList.contains('mobile-ui-enabled') && mobileModalShell;
    if (useMobileModal) {
      return showStoryOverlayMobile(options, overlayId);
    }
    const win = document.createElement('div');
    win.className = 'win98-window';
    const mobileOverlayOffset = document.body?.classList.contains('mobile-ui-enabled') ? 500 : 0;
    if (topAlign) {
      win.classList.add('news-overlay');
      win.style.left = '50%';
      win.style.top = '0';
      win.style.zIndex = String(200 + overlayStack.length + mobileOverlayOffset);
      win.style.animation = 'newsDrop 0.4s ease forwards';
    } else {
      if (animate) {
        win.style.animation = 'popIn 0.25s ease';
        win.style.animationFillMode = 'both';
      }
      const offset = overlayStack.length * 18;
      win.style.left = `${40 + offset}px`;
      win.style.top = `${40 + offset}px`;
      if (center) {
        win.style.left = '50%';
        win.style.top = '50%';
        win.style.transform = 'translate(-50%, -50%)';
      }
      win.style.zIndex = String(100 + overlayStack.length + mobileOverlayOffset);
    }
    if (width) win.style.width = width;

    const bar = document.createElement('div');
    bar.className = 'win98-titlebar';
    const titleSpan = document.createElement('div');
    titleSpan.className = 'win98-title';
    titleSpan.textContent = title || '';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'win98-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => closeStoryOverlay(overlayId));
    bar.appendChild(titleSpan);
    bar.appendChild(closeBtn);
    
    makeDraggable(win, bar);
    win.addEventListener('pointerdown', () => {
      // Bring to front
      const highest = Math.max(...Array.from(document.querySelectorAll('.win98-window')).map(e => parseFloat(e.style.zIndex)||0), 100);
      win.style.zIndex = highest + 1;
    });

    const bodyEl = document.createElement('div');
    bodyEl.className = 'win98-body';
    const tabList = Array.isArray(tabs) && tabs.length ? tabs : null;
    if (tabList) {
      let activeTabId = initialTabId || tabList[0].id;
      const navRow = document.createElement('div');
      navRow.className = 'win98-tab-row';
      const tabContentEl = document.createElement('div');
      tabContentEl.className = 'win98-tab-content';
      const tabButtons = [];
      function renderActiveTab() {
        const activeTab = tabList.find(tab => tab.id === activeTabId) || tabList[0];
        if (!activeTab) return;
        tabButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tabId === activeTab.id);
        });
        appendContentTo(tabContentEl, activeTab.body ?? activeTab.content ?? activeTab.render);
      }
      tabList.forEach(tab => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'win98-tab-btn';
        btn.dataset.tabId = tab.id;
        btn.textContent = tab.label || tab.title || tab.id || 'Tab';
        btn.addEventListener('click', () => {
          if (activeTabId === tab.id) return;
          activeTabId = tab.id;
          renderActiveTab();
        });
        navRow.appendChild(btn);
        tabButtons.push(btn);
      });
      bodyEl.appendChild(navRow);
      bodyEl.appendChild(tabContentEl);
      renderActiveTab();
    } else {
      appendContentTo(bodyEl, body);
    }

    const buttonRow = document.createElement('div');
    buttonRow.className = 'win98-buttons';
    const effectiveButtons = buttons && buttons.length ? buttons : [{ label:'閉じる', action: () => closeStoryOverlay(overlayId) }];
    effectiveButtons.forEach(cfg => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'win98-btn';
      b.textContent = cfg.label || 'OK';
      b.addEventListener('click', () => {
        if (typeof cfg.action === 'function') {
          cfg.action();
        }
      });
      buttonRow.appendChild(b);
    });

    const modalMask = document.createElement('div');
    if (modal) {
      modalMask.style.position = 'absolute';
      modalMask.style.inset = '0';
      modalMask.style.pointerEvents = 'auto';
    } else {
      modalMask.style.position = 'absolute';
      modalMask.style.inset = '0';
      modalMask.style.pointerEvents = 'none';
    }

    win.appendChild(bar);
    win.appendChild(bodyEl);
    win.appendChild(buttonRow);

    storyOverlayRoot.appendChild(win);
    const overlay = { id:overlayId, title, modal, el:win };
    overlayStack.push(overlay);
    const caption = typeof mobileTitle === 'string' ? mobileTitle : (typeof title === 'string' ? title : '');
    if (caption) {
      registerMobileOverlayEntry(overlayId, caption, () => closeStoryOverlay(overlayId));
    }

    if (typeof onCreate === 'function') {
      onCreate({ root:win, bodyEl });
    }

    return overlayId;
  }

  function closeStoryOverlay(id) {
      removeMobileOverlayEntry(id);
      if (id && lastRoyalNewsOverlayId === id) {
        lastRoyalNewsOverlayId = null;
      }
      const idx = overlayStack.findIndex(o => o.id === id);
      if (idx === -1) return;
      const overlay = overlayStack[idx];
      overlayStack.splice(idx, 1);
      if (overlay && overlay.el && overlay.el.parentNode) {
        overlay.el.parentNode.removeChild(overlay.el);
      }
      if (railOverlayContext && railOverlayContext.overlayId === id) {
        deactivateRailMode();
        railOverlayContext = null;
      }
      railScheduleStateRefresher = null;
    }

  function openStorySetupWindow(options = {}) {
    if (isMobileUIEnabled()) {
      openMobileStorySetup(options);
      return;
    }
    const container = document.createElement('div');
    const onComplete = typeof options.afterSetup === 'function' ? options.afterSetup : null;

    const rowName = document.createElement('div');
    rowName.className = 'win98-field-row';
    const labelName = document.createElement('label');
    labelName.textContent = '名前';
    const inputName = document.createElement('input');
    inputName.type = 'text';
    inputName.maxLength = 12;
    inputName.value = player.profile.name || '';
    rowName.appendChild(labelName);
    rowName.appendChild(inputName);

    const rowGender = document.createElement('div');
    rowGender.className = 'win98-field-row';
    const labelGender = document.createElement('label');
    labelGender.textContent = '性別';
    const selectGender = document.createElement('select');
    [
      { value:'male', label:'male' },
      { value:'female', label:'female' },
      { value:'other', label:'other' },
      { value:'undisclosed', label:'undisclosed' },
    ].forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (player.profile.gender === opt.value) o.selected = true;
      selectGender.appendChild(o);
    });
    rowGender.appendChild(labelGender);
    rowGender.appendChild(selectGender);

    const errorEl = document.createElement('div');
    errorEl.className = 'win98-error';

    container.appendChild(rowName);
    container.appendChild(rowGender);
    container.appendChild(errorEl);

    const overlayId = showStoryOverlay({
      id:'story-setup',
      title:'ストーリーモード設定',
      body:container,
      modal:true,
      buttons:[
        {
          label:'開始',
          action: () => {
            const rawName = inputName.value.trim();
            if (!rawName) {
              errorEl.textContent = '名前を入力してください（必須）';
              inputName.focus();
              return;
            }
            if (rawName.length > 12) {
              errorEl.textContent = '名前は12文字以内で入力してください';
              inputName.focus();
              return;
            }
            errorEl.textContent = '';
            player.profile.name = rawName;
            player.profile.gender = selectGender.value || 'undisclosed';
            const playerCandidate = CANDIDATES.find(c => c.id === 'player');
            if (playerCandidate) {
              playerCandidate.name = player.profile.name;
            }
            closeStoryOverlay(overlayId);
            if (onComplete) {
              onComplete();
            } else {
              startStoryMode();
            }
          },
        },
      ],
    });
    if (overlayId && inputName) {
      setTimeout(() => {
        inputName.focus();
        inputName.select();
      }, 0);
    }
  }

  tileInfoEl.addEventListener('click', (e) => {
    const target = e.target;
    if (!target || !target.dataset) return;
    const action = target.dataset.action;
    if (action === 'toggle-city-detail') {
      const id = Number(target.dataset.city);
      if (!Number.isFinite(id)) return;
      if (detailCityId === id && showCityStats) {
        showCityStats = false;
      } else {
        detailCityId = id;
        showCityStats = true;
      }
      if (lastTileInfo) updateTileInfo({ x:lastTileInfo.x, y:lastTileInfo.y });
    }
  });
  hudButtons.forEach(btn => btn.addEventListener('click', handleHUDAction));
  if (newWorldBtn) newWorldBtn.addEventListener('click', () => {
      if (appState !== 'title') return;
      isStoryMode = false;
      generate();
      // 新規開始時は時間を「停止」からスタート
      timeControl.speed = 0;
      resetActionSystem(false);
    markMapDirty();
    setTitleStatus('');
      switchToMap('新しい世界を生成しました');
    });
  if (storyModeBtn) storyModeBtn.addEventListener('click', () => {
    if (appState !== 'title' || openingState.playing) return;
    const galleryOverlay = overlayStack.find(o => o.id === 'gallery-overlay');
    if (galleryOverlay) closeStoryOverlay('gallery-overlay');
    openStorySetupWindow({
      afterSetup: () => {
        const firstTime = !hasOpeningWatchedFlag();
        playOpening({
          mode: 'story',
          variant: 'beta',
          skippable: !firstTime,
          onComplete: () => {
            startStoryMode();
          },
        });
      },
    });
  });
  if (galleryBtn) galleryBtn.addEventListener('click', () => {
    if (appState !== 'title' || openingState.playing) return;
    openGalleryOverlay();
  });
  if (loadWorldBtn) loadWorldBtn.addEventListener('click', () => {
    if (appState !== 'title') return;
    setTitleStatus('JSONファイルを選択してください');
    importWorldFromJson('title');
  });
  if (bgmToggleBtn) bgmToggleBtn.addEventListener('click', toggleBGM);
  if (overlaySaveBtn) overlaySaveBtn.addEventListener('click', () => {
    if (saveWorldToSlot()) {
      hideConfirmOverlay();
      completeReturnToTitle();
    }
  });
  if (overlayDiscardBtn) overlayDiscardBtn.addEventListener('click', () => {
    worldDirty = false;
    hideConfirmOverlay();
    completeReturnToTitle();
  });
  if (overlayCancelBtn) overlayCancelBtn.addEventListener('click', hideConfirmOverlay);
  if (cityListCloseBtn) cityListCloseBtn.addEventListener('click', hideCityListOverlay);
  if (cityListOverlay) cityListOverlay.addEventListener('click', (event) => {
    if (event.target === cityListOverlay) hideCityListOverlay();
  });
  if (cityListContainer) cityListContainer.addEventListener('click', handleCityListSelection);
  if (btnGoTitle) btnGoTitle.addEventListener('click', () => {
    hideGameOver();
    completeReturnToTitle();
  });
  if (btnGoLoad) btnGoLoad.addEventListener('click', () => {
    hideGameOver();
    importWorldFromJson('map');
  });
  updateBgmControls();

    function startStoryMode() {
      resetStoryJournal();
      resetStoryScenarioState();
      isStoryMode = true;
      currentTurn = 0;
      successionTurnPlanned = 40;
    initCharacters();
    generate();
    resetActionSystem(true);
    markMapDirty();
    setTitleStatus('');
    timeControl.speed = 0; // Pause at start
    updateControlButtons();
    playSystemSound('major');
      switchToMap('ストーリーモードを開始しました');
      if (!storyFlags.introShown) {
        storyFlags.introShown = true;
        showIntroStoryOverlay();
      }
      maybeTriggerStorySequence();
    }

        const candidateActionLog = [];
        // 各ターン（1か月）に実行できる王候補行動は 1 回まで
        let lastCandidateActionTurn = -1;

        function formatGameDate(turnValue = currentTurn) {
          const baseYear = 1;
          const monthsPerYear = 12;
          const turn = Math.max(0, Math.floor(turnValue));
          const year = baseYear + Math.floor(turn / monthsPerYear);
          const month = (turn % monthsPerYear) + 1;
          return `${year}年${month}月`;
        }

  function formatSuccessionCountdown() {
    if (!isStoryMode || successionTurnPlanned == null) {
      return '王決定予定: 未定';
    }
    if (successionResult) {
      const elapsed = Math.max(0, currentTurn - successionTurnPlanned);
      const years = Math.floor(elapsed / 12);
      const months = elapsed % 12;
      return `王即位後: ${years}年${months}か月`;
    }
    const left = successionTurnPlanned - currentTurn;
    if (left <= 0) return '王決定: まもなく';
    return `王決定まで: 残り${left}ターン`;
  }

      function pushCandidateLogEntry(kind, city, customLabel) {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2,'0');
        const mm = String(now.getMinutes()).padStart(2,'0');
        let label = '';
        if (kind === 'infrastructure') label = 'インフラ整備';
        else if (kind === 'security') label = '治安維持';
        else if (kind === 'magic') label = '魔法研究';
        if (customLabel) label = customLabel;
        const cityName = city && city.name ? city.name : (city ? `都市#${city.id}` : '全土');
        candidateActionLog.unshift(`${hh}:${mm} ${label} @ ${cityName}`);
      if (candidateActionLog.length > 5) candidateActionLog.pop();
      updateCandidateLogUI();
    }

    function updateCandidateLogUI() {
      if (!candidateLogEl) return;
      if (!candidateActionLog.length) {
        candidateLogEl.textContent = '';
        candidateLogEl.style.display = 'none';
        return;
      }
      candidateLogEl.style.display = 'block';
      candidateLogEl.innerHTML = candidateActionLog.map(line => {
        return line.replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }).join('<br>');
    }

        const ACTION_UI_CONFIG = {
          'candidate-infra': {
            title: 'インフラ整備',
            prompt: '整備したい都市を選択してください',
            action: 'infrastructure',
          },
          'candidate-security': {
            title: '治安維持',
            prompt: '治安ターゲットを選んでください',
            action: 'security',
          },
          'candidate-magic': {
            title: '魔法研究',
            prompt: '研究テーマを選択してください',
            action: 'magic_research',
            options: [
              { label: '結界防衛研究', logLabel: '魔法研究（結界）', description: '治安向上を狙う防衛魔法' },
              { label: '資源生成研究', logLabel: '魔法研究（資源）', description: '都市繁栄に資する魔力増幅' },
              { label: '治癒魔法研究', logLabel: '魔法研究（治癒）', description: '民心に働きかける癒しの魔法' },
            ],
          },
        };

        function getTopCities(limit = 6) {
          return cities
            .filter(c => c)
            .sort((a,b) => (b.pop || 0) - (a.pop || 0))
            .slice(0, limit);
        }

        function createActionOverlay(actionId) {
          const config = ACTION_UI_CONFIG[actionId];
          if (!config) return;
          const overlayId = `action-target-${actionId}`;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '8px';
          container.style.color = '#111';
          const prompt = document.createElement('p');
          prompt.style.margin = '0 0 4px';
          prompt.textContent = config.prompt;
          prompt.style.fontSize = '14px';
          container.appendChild(prompt);
        if (config.options) {
          config.options.forEach(option => {
            const btn = document.createElement('button');
              btn.className = 'btn';
              btn.textContent = option.label;
              if (option.description) {
                const desc = document.createElement('div');
                desc.style.fontSize = '12px';
                desc.style.opacity = '0.8';
                desc.textContent = option.description;
                container.appendChild(desc);
              }
              btn.addEventListener('click', () => {
                const executed = tryExecuteStoryAction(
                  config.action,
                  'player',
                  null,
                  { showReason:true }
                );
                if (executed) {
                  pushCandidateLogEntry('magic', null, option.logLabel || option.label);
                  markMapDirty();
                  updateHudStats();
                }
                closeStoryOverlay(overlayId);
              });
            container.appendChild(btn);
          });
        }
        if (actionId === 'candidate-security') {
            container.appendChild(createRegionCouncilSection(overlayId));
            const list = createCityListForAction(actionId, config.action, overlayId);
            container.appendChild(list);
        } else if (actionId === 'candidate-magic') {
            const researchSection = createMagicResearchSection(overlayId);
            container.appendChild(researchSection);
        } else {
            if (actionId === 'candidate-infra') {
                container.appendChild(createHorsecarResearchPanel(overlayId));
                container.appendChild(createRoadConstructionPanel(overlayId));
            }
            const list = createCityListForAction(actionId, config.action, overlayId);
            container.appendChild(list);
        }
          showStoryOverlay({
            id: overlayId,
            title: config.title,
            body: container,
            modal: true,
            buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
            animate:true,
          });
          }

        function createCityListForAction(actionId, actionName) {
          const fragment = document.createElement('div');
          fragment.style.display = 'flex';
          fragment.style.flexDirection = 'column';
          fragment.style.gap = '6px';
          const cityList = getTopCities(8);
          cityList.forEach(city => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.padding = '6px';
            row.style.borderBottom = '1px solid rgba(255,255,255,0.15)';
            const label = document.createElement('span');
            label.textContent = `${city.name || '都市'}（${Math.round(city.pop)}人 / 安定${Math.round(city.stability)}）`;
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = actionId === 'candidate-infra' ? '整備' : '治安';
            btn.addEventListener('click', () => {
              const executed = tryExecuteStoryAction(
                actionName,
                'player',
                city.id,
                { showReason:true }
              );
              if (executed) {
                pushCandidateLogEntry(actionId === 'candidate-infra' ? 'infrastructure' : 'security', city);
                markMapDirty();
                updateHudStats();
              }
              closeStoryOverlay(`action-target-${actionId}`);
            });
            row.appendChild(label);
            row.appendChild(btn);
            fragment.appendChild(row);
          });
          if (!cityList.length) {
            const empty = document.createElement('div');
            empty.textContent = '対象都市がありません';
            fragment.appendChild(empty);
          }
          return fragment;
        }

        function createRegionCouncilSection(overlayId) {
          const section = document.createElement('div');
          section.style.border = '1px solid rgba(255,255,255,0.1)';
          section.style.borderRadius = '8px';
          section.style.padding = '10px';
          section.style.background = '#0f1421';
          section.style.color = '#d8dee9';
          section.style.display = 'flex';
          section.style.flexDirection = 'column';
          section.style.gap = '6px';

          const heading = document.createElement('strong');
          heading.textContent = '地域会議';
          const summary = document.createElement('div');
          summary.style.fontSize = '12px';
          summary.style.opacity = '0.7';
          summary.textContent = '選んだ都市を召集し、支援層の対立を和らげる会議を開きます。';
          section.appendChild(heading);
          section.appendChild(summary);

          const cityWrap = document.createElement('div');
          cityWrap.style.display = 'flex';
          cityWrap.style.flexDirection = 'column';
          cityWrap.style.gap = '4px';
          cityWrap.style.maxHeight = '140px';
          cityWrap.style.overflowY = 'auto';
          cityWrap.style.paddingRight = '4px';
          const selection = new Set();
          const cityCandidates = getTopCities(6);
          cityCandidates.forEach(city => {
            const row = document.createElement('label');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.fontSize = '13px';
            row.style.gap = '6px';
            row.style.padding = '6px 10px';
            row.style.borderRadius = '6px';
            row.style.background = 'rgba(255,255,255,0.04)';
            row.style.color = '#d8dee9';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = city.id;
            checkbox.addEventListener('change', () => {
              if (checkbox.checked) selection.add(city.id);
              else selection.delete(city.id);
              actionButton.disabled = selection.size === 0;
            });
            const label = document.createElement('span');
            label.textContent = `${city.name || '都市'} / ${Math.round(city.stability)}安定`;
            label.style.color = '#d8dee9';
            row.appendChild(checkbox);
            row.appendChild(label);
            cityWrap.appendChild(row);
          });
          if (!cityCandidates.length) {
            const empty = document.createElement('div');
            empty.textContent = '対象都市がありません';
            empty.style.color = '#0d0f14';
            cityWrap.appendChild(empty);
          }
          section.appendChild(cityWrap);

          const actionButton = document.createElement('button');
          actionButton.className = 'btn';
          actionButton.textContent = '地域会議を開く';
          actionButton.disabled = true;
          actionButton.addEventListener('click', () => {
            const citiesSelected = Array.from(selection);
            if (!citiesSelected.length) return;
            const executed = tryExecuteStoryAction('security', 'player', null, {
              showReason: true,
              regionCouncil: citiesSelected,
            });
            if (executed) {
              const names = citiesSelected
                .map(id => (cities[id] && cities[id].name) || `都市#${id}`)
                .join('・');
              pushCandidateLogEntry('security', null, `地域会議 (${names})`);
              markMapDirty();
              updateHudStats();
            }
            closeStoryOverlay(overlayId);
          });
          section.appendChild(actionButton);
          return section;
        }

        const envRoot = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
        function cloneStateData(data) {
          if (!data || typeof data !== 'object') return {};
          try {
            return JSON.parse(JSON.stringify(data));
          } catch {
            return {};
          }
        }
        function getWorldState() {
          if (!envRoot.worldState) envRoot.worldState = {};
          return envRoot.worldState;
        }
        function snapshotWorldState() {
          return cloneStateData(getWorldState());
        }
        function resetWorldState(data) {
          envRoot.worldState = cloneStateData(data);
        }
        function restoreWorldState(data) {
          resetWorldState(data);
        }

        function getMetropolitanState() {
          const state = getWorldState();
          if (!state.metropolitan || typeof state.metropolitan !== 'object') {
            state.metropolitan = { reportedClusters: [] };
          }
          if (!Array.isArray(state.metropolitan.reportedClusters)) {
            state.metropolitan.reportedClusters = [];
          }
          return state.metropolitan;
        }

        function detectMetropolitanClusters() {
          const heavyCities = cities
            .filter(city => city && Number.isFinite(city.id) && Number.isFinite(city.pop) && city.pop >= METROPOLITAN_POP_THRESHOLD);
          if (!heavyCities.length) return [];
          const clusters = [];
          const visited = new Set();
          heavyCities.forEach(city => {
            if (visited.has(city.id)) return;
            const stack = [city];
            visited.add(city.id);
            const cluster = [];
            while (stack.length) {
              const current = stack.pop();
              cluster.push(current);
              heavyCities.forEach(other => {
                if (visited.has(other.id) || other.id === current.id) return;
                const dx = current.x - other.x;
                const dy = current.y - other.y;
                if (Math.hypot(dx, dy) <= METROPOLITAN_DISTANCE) {
                  visited.add(other.id);
                  stack.push(other);
                }
              });
            }
            if (cluster.length >= METROPOLITAN_MIN_CLUSTER) {
              clusters.push(cluster);
            }
          });
          return clusters;
        }

        function applyMetropolitanGrowth() {
          if (!Array.isArray(cities) || !cities.length) return;
          const clusters = detectMetropolitanClusters();
          if (!clusters.length) return;
          const metroState = getMetropolitanState();
          const knownKeys = new Set(metroState.reportedClusters);
          clusters.forEach(cluster => {
            const ids = cluster
              .map(entry => entry && Number.isFinite(entry.id) ? entry.id : null)
              .filter(Number.isFinite);
            if (!ids.length) return;
            ids.sort((a, b) => a - b);
            const key = ids.join(',');
            cluster.forEach(city => {
              if (!city) return;
              const boost = Math.max(1, Math.round((city.pop || 0) * METROPOLITAN_GROWTH_BONUS));
              city.pop = Math.round((city.pop || 0) + boost);
              city.pop = Math.max(city.pop, 150);
            });
            if (!knownKeys.has(key)) {
              knownKeys.add(key);
              if (isStoryMode) {
                const names = cluster.map(entry => entry.name || `都市${entry.id}`).join('・');
                const summary = `王令新聞「都市圏の形成」${names}が連携を強め、人口と繁栄が膨らむ。`;
                publishStoryNews(summary);
                recordStoryAction('royal-newspaper', 'metropolitan_cluster', {
                  storyLabel: summary,
                });
              }
            }
          });
          const trimmed = Array.from(knownKeys);
          metroState.reportedClusters = trimmed.length > 12 ? trimmed.slice(-12) : trimmed;
        }

        function getResearchInstitutes() {
          const state = getWorldState();
          if (!state.researchInstitutes) state.researchInstitutes = [];
          return state.researchInstitutes;
        }

        function getResearchInstituteForCity(cityId) {
          const list = getResearchInstitutes();
          return list.find(entry => entry.cityId === cityId);
        }

        function normalizeRegionIndex(regionIndex) {
          const count = Math.max(1, REGION_NAMES.length);
          if (!Number.isFinite(regionIndex)) return 0;
          const normalized = Math.floor(regionIndex);
          return ((normalized % count) + count) % count;
        }

        function getCityRegionIndex(cityOrId) {
          if (!cityOrId) return 0;
          const rawId = typeof cityOrId === 'number' ? cityOrId : (cityOrId.id ?? null);
          if (!Number.isFinite(rawId)) return 0;
          return normalizeRegionIndex(Math.floor(rawId));
        }

        function getRegionLabel(regionIndex) {
          const idx = normalizeRegionIndex(regionIndex);
          return REGION_NAMES[idx] || `地方${idx + 1}`;
        }

        function getMilitaryState() {
          const state = getWorldState();
          if (!state.military || typeof state.military !== 'object') {
            state.military = {};
          }
          if (!state.military.cities || typeof state.military.cities !== 'object') {
            state.military.cities = {};
          }
          if (!state.military.regions || typeof state.military.regions !== 'object') {
            state.military.regions = {};
          }
          return state.military;
        }

        function getCityDefenseCorps(cityId) {
          if (!Number.isFinite(cityId)) return 0;
          const military = getMilitaryState();
          const value = Number(military.cities[String(cityId)]);
          if (!Number.isFinite(value)) return 0;
          return clamp(value, 0, MAX_CITY_DEFENSE_CORPS);
        }

        function setCityDefenseCorps(cityId, amount, options) {
          if (!Number.isFinite(cityId)) return false;
          const military = getMilitaryState();
          const key = String(cityId);
          const sanitized = clamp(Math.round(amount || 0), 0, MAX_CITY_DEFENSE_CORPS);
          if (military.cities[key] === sanitized && !(options && options.force)) {
            return false;
          }
          military.cities[key] = sanitized;
          if (!options || !options.silent) {
            markWorldDirty();
          }
          return true;
        }

        function adjustCityDefenseCorps(cityId, delta) {
          const current = getCityDefenseCorps(cityId);
          return setCityDefenseCorps(cityId, current + (delta || 0));
        }

        function getRegionDivisions(regionIndex) {
          const idx = normalizeRegionIndex(regionIndex);
          const military = getMilitaryState();
          const value = Number(military.regions[String(idx)]);
          if (!Number.isFinite(value)) return 0;
          return clamp(value, 0, MAX_REGION_DIVISIONS);
        }

        function setRegionDivisions(regionIndex, amount, options) {
          const idx = normalizeRegionIndex(regionIndex);
          const military = getMilitaryState();
          const key = String(idx);
          const sanitized = clamp(Math.round(amount || 0), 0, MAX_REGION_DIVISIONS);
          if (military.regions[key] === sanitized && !(options && options.force)) {
            return false;
          }
          military.regions[key] = sanitized;
          if (!options || !options.silent) {
            markWorldDirty();
          }
          return true;
        }

        function adjustRegionDivisions(regionIndex, delta) {
          const current = getRegionDivisions(regionIndex);
          return setRegionDivisions(regionIndex, current + (delta || 0));
        }

        function createMagicResearchSection(overlayId) {
          const section = document.createElement('div');
          section.style.border = '1px solid rgba(255,255,255,0.1)';
          section.style.borderRadius = '8px';
          section.style.padding = '10px';
          section.style.background = '#0f1421';
          section.style.color = '#d8dee9';
          section.style.display = 'flex';
          section.style.flexDirection = 'column';
          section.style.gap = '8px';

          const header = document.createElement('strong');
          header.textContent = '大規模研究';
          section.appendChild(header);

          const instituteInfo = document.createElement('div');
          instituteInfo.style.fontSize = '12px';
          instituteInfo.style.opacity = '0.7';
          instituteInfo.textContent = '研究所を設置すると魔法進行が加速し、都市の信頼も深まります。';
          section.appendChild(instituteInfo);

          const listLabel = document.createElement('div');
          listLabel.style.fontSize = '12px';
          listLabel.textContent = '現在の研究所';
          section.appendChild(listLabel);

          const instituteList = document.createElement('div');
          instituteList.style.display = 'flex';
          instituteList.style.flexDirection = 'column';
          instituteList.style.gap = '4px';
        const currentInstitutes = getResearchInstitutes();
        if (currentInstitutes.length) {
          currentInstitutes.forEach(entry => {
            const city = cities[entry.cityId];
            const row = document.createElement('div');
            const cityName = city && city.name ? city.name : `City ${entry.cityId}`;
            const progress = Math.round(entry.progress || 0);
            const breakthroughs = entry.breakthroughs || 0;
            row.textContent = `${cityName} - Progress ${progress}% / Breakthroughs ${breakthroughs}`;
            row.style.fontSize = '12px';
            row.style.color = '#d8dee9';
            row.style.background = 'rgba(255,255,255,0.04)';
            row.style.borderRadius = '5px';
            row.style.padding = '4px 6px';
            instituteList.appendChild(row);
          });
        } else {
          const empty = document.createElement('div');
          empty.textContent = 'No research institutes configured yet.';
          empty.style.fontSize = '12px';
          empty.style.opacity = '0.8';
          instituteList.appendChild(empty);
        }
        section.appendChild(instituteList);

          const cityLabel = document.createElement('div');
          cityLabel.style.fontSize = '12px';
          cityLabel.textContent = '研究所候補都市';
          section.appendChild(cityLabel);

          const picker = document.createElement('div');
          picker.style.display = 'flex';
          picker.style.flexDirection = 'column';
          picker.style.gap = '4px';
          picker.style.maxHeight = '140px';
          picker.style.overflowY = 'auto';
          picker.style.paddingRight = '4px';
          const candidateCities = getTopCities(6);
          candidateCities.forEach(city => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.fontSize = '12px';
            row.style.background = 'rgba(255,255,255,0.04)';
            row.style.borderRadius = '6px';
            row.style.padding = '4px 6px';
            row.style.color = '#d8dee9';
            const desc = document.createElement('span');
            const institute = getResearchInstituteForCity(city.id);
            desc.textContent = `${city.name || '都市'} – ${institute ? `進捗 ${institute.progress || 0}%` : '未設置'}`;
            desc.style.color = '#d8dee9';
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = institute ? '研究強化' : '研究所設置';
            btn.addEventListener('click', () => {
              const executed = tryExecuteStoryAction('magic_research', 'player', city.id, {
                showReason: true,
                largeInstitute: true,
              });
              if (executed) {
                pushCandidateLogEntry('magic', city, '大規模魔法研究');
                markMapDirty();
                updateHudStats();
                closeStoryOverlay(overlayId);
              }
            });
            row.appendChild(desc);
            row.appendChild(btn);
            picker.appendChild(row);
          });
          if (!candidateCities.length) {
            const empty = document.createElement('div');
            empty.textContent = '都市が足りません';
            empty.style.fontSize = '12px';
            empty.style.opacity = '0.8';
            picker.appendChild(empty);
          }
          section.appendChild(picker);
          return section;
        }

        function ensureHorsecarResearch() {
          const state = getWorldState();
          if (!state.horsecarResearch) {
            state.horsecarResearch = { progress: 0, completed: false };
          }
          if (!state.horsecarLines) {
            state.horsecarLines = [];
          }
          return state.horsecarResearch;
        }

function getHorsecarLines() {
  const state = getWorldState();
  if (!state.horsecarLines) state.horsecarLines = [];
  state.horsecarLines.forEach(line => {
    if (line && !line.id) {
      line.id = `rail-line-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    }
  });
  return state.horsecarLines;
}

function renderHorsecarLineList() {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap = '4px';
            wrapper.style.fontSize = '12px';
            wrapper.style.maxHeight = '160px';
            wrapper.style.overflowY = 'auto';
            const label = document.createElement('strong');
            label.textContent = '敷設路線';
            label.style.fontSize = '13px';
            label.style.marginBottom = '4px';
            wrapper.appendChild(label);
            const lines = getHorsecarLines();
            if (!lines.length) {
                const empty = document.createElement('div');
                empty.textContent = 'まだ敷設された路線がありません';
                empty.style.opacity = '0.7';
                wrapper.appendChild(empty);
                return wrapper;
            }
            lines.forEach(line => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.flexDirection = 'column';
                row.style.gap = '4px';
                row.style.background = 'rgba(255,255,255,0.04)';
                row.style.border = '1px solid rgba(255,255,255,0.1)';
                row.style.borderRadius = '8px';
                row.style.padding = '6px 8px';
                const titleRow = document.createElement('div');
                titleRow.style.display = 'flex';
                titleRow.style.justifyContent = 'space-between';
                titleRow.style.alignItems = 'center';
                const title = document.createElement('div');
                title.textContent = getLineLabel(line);
                title.style.fontSize = '12px';
                title.style.fontWeight = '600';
                titleRow.appendChild(title);
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn';
                removeBtn.textContent = '路線を廃止';
                removeBtn.addEventListener('click', () => {
                  if (removeHorsecarLine(line.id)) {
                    updateRailOverlayList();
                    updateRailOverlayStatus('路線を廃止しました');
                    if (tileInfoEl) tileInfoEl.textContent = '路線を廃止しました';
                    if (typeof railScheduleStateRefresher === 'function') {
                      railScheduleStateRefresher();
                    }
                    render();
                  }
                });
                titleRow.appendChild(removeBtn);
                const meta = document.createElement('div');
                meta.style.fontSize = '11px';
                meta.style.opacity = '0.8';
                meta.textContent = `需要 ${line.demand || 1}本`;
                row.appendChild(titleRow);
                row.appendChild(meta);
                wrapper.appendChild(row);
            });
            return wrapper;
        }

        function buildRailScheduleList(onUpdate) {
          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.flexDirection = 'column';
          wrapper.style.gap = '6px';
          const schedules = getRailSchedules();
          if (!schedules.length) {
            const empty = document.createElement('div');
            empty.textContent = 'まだ鉄道ダイヤは設定されていません';
            empty.style.fontSize = '12px';
            empty.style.opacity = '0.7';
            wrapper.appendChild(empty);
            return wrapper;
          }
          schedules.forEach(entry => {
            const line = getLineById(entry.lineId);
            const row = document.createElement('div');
            row.style.border = '1px solid rgba(255,255,255,0.12)';
            row.style.borderRadius = '6px';
            row.style.padding = '6px';
            row.style.background = 'rgba(255,255,255,0.03)';
            const title = document.createElement('div');
            title.textContent = line ? getLineLabel(line) : `${getCityDisplayName(entry.originId)} → ${getCityDisplayName(entry.destinationId)}`;
            title.style.fontSize = '12px';
            title.style.fontWeight = '600';
            row.appendChild(title);
            const meta = document.createElement('div');
            meta.textContent = `タイプ ${getTrainTypeLabel(entry.trainType)} / 輸送 ${entry.capacity || 0} / 頻度 ${entry.frequency || 1}`;
            meta.style.fontSize = '11px';
            meta.style.opacity = '0.8';
            row.appendChild(meta);
            const rawStops = Array.isArray(entry.stops) ? entry.stops : [];
            const formattedStops = rawStops
              .map(stop => {
                const cityId = stop && typeof stop === 'object' ? stop.cityId : stop;
                const cityName = getCityDisplayName(cityId);
                if (!cityName) return null;
                const loopText = (stop && typeof stop === 'object' && stop.passingLoop) ? '（行き違いあり）' : '';
                return `${cityName}${loopText}`;
              })
              .filter(Boolean)
              .join(' / ');
            const stopsRow = document.createElement('div');
            stopsRow.textContent = `中間駅: ${formattedStops || '直通'}`;
            stopsRow.style.fontSize = '11px';
            stopsRow.style.opacity = '0.8';
            row.appendChild(stopsRow);
            const economy = estimateScheduleEconomy(entry);
            const profitLabel = economy.profit >= 0 ? `黒字 ${economy.profit}` : `赤字 ${economy.profit}`;
            const econRow = document.createElement('div');
            econRow.textContent = `乗客見込 ${economy.passengers}人 / 収入 ${economy.revenue} / 維持 ${economy.maintenance} / ${profitLabel}`;
            econRow.style.fontSize = '11px';
            econRow.style.opacity = '0.8';
            row.appendChild(econRow);
            const buttonRow = document.createElement('div');
            buttonRow.style.display = 'flex';
            buttonRow.style.gap = '6px';
            buttonRow.style.marginTop = '4px';
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn';
            removeBtn.textContent = '削除';
            removeBtn.addEventListener('click', () => {
              if (removeRailSchedule(entry.id) && typeof onUpdate === 'function') {
                onUpdate();
              }
            });
            buttonRow.appendChild(removeBtn);
            row.appendChild(buttonRow);
            wrapper.appendChild(row);
          });
          return wrapper;
        }

        function openRailScheduleOverlay() {
          const research = ensureHorsecarResearch();
          if (!research.completed) return;
          const overlayId = 'rail-schedule-overlay';
          if (overlayStack.find(o => o.id === overlayId)) return;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '12px';
          container.style.color = '#111';
          const heading = document.createElement('strong');
          heading.textContent = '鉄道ダイヤの制定';
          container.appendChild(heading);
          const intro = document.createElement('div');
          intro.textContent = '運ぶ都市・速度・中間駅を決めて、国家の鉄道を動かしましょう';
          intro.style.fontSize = '12px';
          intro.style.opacity = '0.8';
          container.appendChild(intro);
          const scheduleListWrapper = document.createElement('div');
          const refreshSchedules = () => {
            scheduleListWrapper.innerHTML = '';
            scheduleListWrapper.appendChild(buildRailScheduleList(refreshSchedules));
          };
          refreshSchedules();
          container.appendChild(scheduleListWrapper);
          const form = document.createElement('div');
          form.style.display = 'flex';
          form.style.flexDirection = 'column';
          form.style.gap = '8px';
          const lineLabel = document.createElement('div');
          lineLabel.textContent = '敷設済みの路線からダイヤを決定';
          lineLabel.style.fontSize = '11px';
          lineLabel.style.opacity = '0.8';
          form.appendChild(lineLabel);
          const lineSelect = document.createElement('select');
          lineSelect.style.padding = '6px';
          lineSelect.style.borderRadius = '6px';
          lineSelect.style.border = '1px solid rgba(255,255,255,0.15)';
          form.appendChild(lineSelect);
          const emptyLineNote = document.createElement('div');
          emptyLineNote.textContent = 'まず馬車鉄道を敷設してください';
          emptyLineNote.style.fontSize = '11px';
          emptyLineNote.style.opacity = '0.7';
          emptyLineNote.style.display = 'none';
          form.appendChild(emptyLineNote);
          const lines = getHorsecarLines();
          const refreshLineOptions = () => {
            lineSelect.innerHTML = '';
            if (!lines.length) {
              lineSelect.disabled = true;
              emptyLineNote.style.display = 'block';
              return false;
            }
            emptyLineNote.style.display = 'none';
            lines.forEach(line => {
              const option = document.createElement('option');
              option.value = line.id;
              option.textContent = getLineLabel(line);
              lineSelect.appendChild(option);
            });
            lineSelect.value = lines[0].id;
            lineSelect.disabled = false;
            return true;
          };
          refreshLineOptions();
          const routeSummary = document.createElement('div');
          routeSummary.style.fontSize = '12px';
          routeSummary.style.opacity = '0.8';
          form.appendChild(routeSummary);
          const stopsWrapper = document.createElement('div');
          stopsWrapper.style.display = 'flex';
          stopsWrapper.style.flexDirection = 'column';
          stopsWrapper.style.gap = '6px';
          stopsWrapper.style.minHeight = '30px';
          form.appendChild(stopsWrapper);
          const typeRow = document.createElement('div');
          typeRow.style.display = 'flex';
          typeRow.style.gap = '6px';
          const typeSelect = document.createElement('select');
          TRAIN_TYPE_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.id;
            option.textContent = opt.label;
            typeSelect.appendChild(option);
          });
          typeRow.appendChild(typeSelect);
          const capacitySlider = document.createElement('input');
          capacitySlider.type = 'range';
          capacitySlider.min = '1';
          capacitySlider.max = '6';
          capacitySlider.value = '3';
          const capacityLabel = document.createElement('span');
          capacityLabel.textContent = '輸送力: 3';
          capacitySlider.addEventListener('input', () => {
            capacityLabel.textContent = `輸送力: ${capacitySlider.value}`;
          });
          typeRow.appendChild(capacityLabel);
          form.appendChild(typeRow);
          const freqRow = document.createElement('div');
          freqRow.style.display = 'flex';
          freqRow.style.alignItems = 'center';
          freqRow.style.gap = '6px';
          const freqLabel = document.createElement('span');
          freqLabel.textContent = '頻度: 2';
          const freqSlider = document.createElement('input');
          freqSlider.type = 'range';
          freqSlider.min = '1';
          freqSlider.max = '4';
          freqSlider.value = '2';
          freqSlider.addEventListener('input', () => {
            freqLabel.textContent = `頻度: ${freqSlider.value}`;
          });
          freqRow.appendChild(freqLabel);
          freqRow.appendChild(freqSlider);
          form.appendChild(freqRow);
          const createBtn = document.createElement('button');
          createBtn.className = 'btn';
          createBtn.textContent = 'ダイヤを保存';
          createBtn.disabled = !lines.length;
          form.appendChild(createBtn);
          container.appendChild(form);
          const stopControls = [];
          const getSelectedLine = () => {
            if (!lines.length) return null;
            const value = lineSelect.value || (lineSelect.options[0] && lineSelect.options[0].value);
            return lines.find(line => line.id === value) || null;
          };
          const updateStops = () => {
            stopsWrapper.innerHTML = '';
            stopControls.length = 0;
            const line = getSelectedLine();
            if (!line) {
              const placeholder = document.createElement('div');
              placeholder.textContent = '路線を選択すると中間駅候補を表示します';
              placeholder.style.fontSize = '11px';
              placeholder.style.opacity = '0.6';
              stopsWrapper.appendChild(placeholder);
              return;
            }
            const candidates = getLineStopCandidates(line);
            if (!candidates.length) {
              const placeholder = document.createElement('div');
              placeholder.textContent = 'この路線には中間駅候補がありません';
              placeholder.style.fontSize = '11px';
              placeholder.style.opacity = '0.6';
              stopsWrapper.appendChild(placeholder);
              return;
            }
            candidates.forEach(city => {
              const row = document.createElement('div');
              row.style.display = 'flex';
              row.style.alignItems = 'center';
              row.style.gap = '8px';
              const checkbox = document.createElement('input');
              checkbox.type = 'checkbox';
              checkbox.value = city.id;
              const span = document.createElement('span');
              span.textContent = city.name || `都市 ${city.id}`;
              span.style.fontSize = '11px';
              span.style.flex = '1';
              const loopBtn = document.createElement('button');
              loopBtn.type = 'button';
              loopBtn.className = 'btn';
              loopBtn.style.fontSize = '11px';
              loopBtn.style.padding = '2px 8px';
              loopBtn.textContent = '行き違いなし';
              row.appendChild(checkbox);
              row.appendChild(span);
              row.appendChild(loopBtn);
              stopsWrapper.appendChild(row);
              const control = {
                cityId: city.id,
                checkbox,
                loopToggle: loopBtn,
                loopEnabled: false,
              };
              loopBtn.addEventListener('click', () => {
                control.loopEnabled = !control.loopEnabled;
                loopBtn.textContent = control.loopEnabled ? '行き違いあり' : '行き違いなし';
                loopBtn.classList.toggle('active', control.loopEnabled);
              });
              stopControls.push(control);
            });
          };
          const updateRouteDisplay = () => {
            const line = getSelectedLine();
            if (!line) {
              routeSummary.textContent = '路線を選択してください';
              createBtn.disabled = true;
              updateStops();
              return;
            }
            const originId = getLineEndpointId(line, 'start');
            const destinationId = getLineEndpointId(line, 'end');
            routeSummary.textContent = `経路: ${getCityDisplayName(originId)} → ${getCityDisplayName(destinationId)}`;
            createBtn.disabled = false;
            updateStops();
          };
          const refreshRailScheduleState = () => {
            refreshLineOptions();
            updateRouteDisplay();
          };
          railScheduleStateRefresher = refreshRailScheduleState;
          lineSelect.addEventListener('change', updateRouteDisplay);
          updateRouteDisplay();
          createBtn.addEventListener('click', () => {
            const line = getSelectedLine();
            if (!line) {
              if (tileInfoEl) tileInfoEl.textContent = '先に路線を選択してください';
              return;
            }
            const originId = ensureLineEndpointCity(line, 'start');
            const destinationId = ensureLineEndpointCity(line, 'end');
            updateRouteDisplay();
            if (!originId || !destinationId || originId === destinationId) {
              if (tileInfoEl) tileInfoEl.textContent = 'この路線は有効な起点・終点を持っていません';
              return;
            }
            const stops = stopControls
              .filter(control => control.checkbox.checked)
              .map(control => ({
                cityId: control.cityId,
                passingLoop: !!control.loopEnabled,
              }));
            const schedule = addRailSchedule({
              originId,
              destinationId,
              stops,
              trainType: typeSelect.value,
              capacity: Number(capacitySlider.value),
              frequency: Number(freqSlider.value),
              lineId: line.id,
            });
            globalFunds = Math.max(0, globalFunds - schedule.capacity * schedule.frequency * 4);
            adjustCharacterValue('player', 'stats', 'infrastructure', 1 + Math.floor(schedule.capacity / 2));
            if (tileInfoEl) {
              tileInfoEl.textContent = `鉄道ダイヤを設定しました（${getTrainTypeLabel(schedule.trainType)}）`;
            }
            pushCandidateLogEntry('infrastructure', null, `鉄道ダイヤ ${getCityDisplayName(originId)}→${getCityDisplayName(destinationId)}`);
            markMapDirty();
            updateHudStats();
            refreshSchedules();
            updateRouteDisplay();
          });
          showStoryOverlay({
            id: overlayId,
            title: '鉄道ダイヤの制定',
            body: container,
            modal: true,
            buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
            animate: true,
          });
        }

        function createHorsecarResearchPanel(overlayId) {
          const section = document.createElement('div');
          section.style.border = '1px solid rgba(255,255,255,0.15)';
          section.style.borderRadius = '8px';
          section.style.padding = '10px';
          section.style.background = 'rgba(0,0,0,0.3)';
          section.style.color = '#d8dee9';
          section.style.display = 'flex';
          section.style.flexDirection = 'column';
          section.style.gap = '8px';
          const research = ensureHorsecarResearch();
          const heading = document.createElement('strong');
          heading.textContent = '馬車交通研究';
          const progress = document.createElement('div');
          progress.style.fontSize = '12px';
          progress.style.color = '#d8dee9';
          progress.textContent = `進捗: ${Math.round(research.progress || 0)}%`;
          const progressBar = document.createElement('div');
          progressBar.style.height = '8px';
          progressBar.style.borderRadius = '4px';
          progressBar.style.background = 'rgba(255,255,255,0.15)';
          const fill = document.createElement('div');
          fill.style.height = '100%';
          fill.style.borderRadius = 'inherit';
          fill.style.background = '#7fb3ff';
          fill.style.width = `${Math.min(100, research.progress || 0)}%`;
          progressBar.appendChild(fill);
          section.appendChild(heading);
          section.appendChild(progress);
          section.appendChild(progressBar);
          const researchButton = document.createElement('button');
          researchButton.className = 'btn';
          researchButton.textContent = research.completed ? '研究完了' : '馬車交通の研究';
          researchButton.disabled = research.completed;
          const railButton = document.createElement('button');
          railButton.className = 'btn';
          railButton.textContent = '馬車鉄道の敷設';
          railButton.style.display = research.completed ? 'inline-flex' : 'none';
          railButton.addEventListener('click', () => {
            openHorsecarRailOverlay();
          });
          const note = document.createElement('div');
          note.textContent = '研究完了後に都市間馬車鉄道を敷設できます';
          note.style.fontSize = '11px';
          note.style.opacity = '0.7';
          researchButton.addEventListener('click', () => {
            const executed = tryExecuteStoryAction('horsecar_research', 'player', null, { showReason: true });
            if (executed) {
              pushCandidateLogEntry('infrastructure', null, '馬車交通研究');
              updateHudStats();
              markMapDirty();
              const updated = ensureHorsecarResearch();
              progress.textContent = `進捗: ${Math.round(updated.progress || 0)}%`;
              fill.style.width = `${Math.min(100, updated.progress || 0)}%`;
              if (updated.completed) {
                researchButton.textContent = '研究完了';
                researchButton.disabled = true;
                railButton.style.display = 'inline-flex';
                if (note.parentNode) note.parentNode.removeChild(note);
              }
            }
          });
          section.appendChild(researchButton);
          section.appendChild(railButton);
          if (!research.completed) {
            section.appendChild(note);
          }
          section.appendChild(renderHorsecarLineList());
          return section;
        }

        function createRoadConstructionPanel(overlayId) {
          const section = document.createElement('div');
          section.style.border = '1px solid rgba(255,255,255,0.15)';
          section.style.borderRadius = '8px';
          section.style.padding = '10px';
          section.style.background = 'rgba(0,0,0,0.3)';
          section.style.color = '#d8dee9';
          section.style.display = 'flex';
          section.style.flexDirection = 'column';
          section.style.gap = '8px';
          
          const heading = document.createElement('strong');
          heading.textContent = '道路整備局';
          section.appendChild(heading);
          
          const desc = document.createElement('div');
          desc.textContent = '都市間を結ぶ道路を建設、または既存の道路を石畳に強化します。';
          desc.style.fontSize = '12px';
          desc.style.opacity = '0.8';
          section.appendChild(desc);

          const btn = document.createElement('button');
          btn.className = 'btn';
          btn.textContent = '都市間道路の敷設（自動）';
          btn.addEventListener('click', () => openRoadConstructionOverlay());
          section.appendChild(btn);

          const manualBtn = document.createElement('button');
          manualBtn.className = 'btn';
          manualBtn.textContent = '手動敷設モード';
          manualBtn.addEventListener('click', () => {
            pendingRoadMode = !pendingRoadMode;
            pendingCapitalSelection = false;
            pendingDevelopment = false;
            updateUIState();
            closeStoryOverlay(overlayId);
            if (tileInfoEl) tileInfoEl.textContent = pendingRoadMode ? '道路敷設モード: タイルをクリックして建設・強化 (10資金)' : '道路敷設モードを終了しました';
          });
          section.appendChild(manualBtn);
          
          return section;
        }

        function openRoadConstructionOverlay() {
          const overlayId = 'road-construct-overlay';
          if (overlayStack.find(o => o.id === overlayId)) return;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '10px';
          
          const info = document.createElement('div');
          info.textContent = '道路を敷設・強化する2つの都市を選択してください';
          info.style.fontSize = '12px';
          info.style.opacity = '0.8';
          container.appendChild(info);

          const selectionRow = document.createElement('div');
          selectionRow.style.display = 'flex';
          selectionRow.style.gap = '6px';
          const selectA = document.createElement('select');
          const selectB = document.createElement('select');
          const citiesList = getTopCities(12); // More candidates
          citiesList.forEach(city => {
            const optionA = document.createElement('option');
            optionA.value = String(city.id);
            optionA.textContent = `${city.name || '都市'}`;
            const optionB = optionA.cloneNode(true);
            selectA.appendChild(optionA);
            selectB.appendChild(optionB);
          });
          selectionRow.appendChild(selectA);
          selectionRow.appendChild(selectB);
          container.appendChild(selectionRow);

          const confirmButton = document.createElement('button');
          confirmButton.className = 'btn';
          confirmButton.textContent = '工事開始';
          confirmButton.addEventListener('click', () => {
            const cityAId = Number(selectA.value);
            const cityBId = Number(selectB.value);
            if (cityAId === cityBId) {
              if (tileInfoEl) tileInfoEl.textContent = '異なる都市を選んでください';
              return;
            }
            const executed = tryExecuteStoryAction('road_construction', 'player', null, {
              showReason: true,
              cityAId,
              cityBId,
            });
            if (executed) {
              pushCandidateLogEntry('infrastructure', null, '道路整備');
              markMapDirty();
              updateHudStats();
              closeStoryOverlay(overlayId);
            }
          });
          container.appendChild(confirmButton);

          showStoryOverlay({
            id: overlayId,
            title: '道路敷設工事',
            body: container,
            modal: true,
            buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
            animate: true,
          });
        }

        function openHorsecarRailOverlay() {
            const research = ensureHorsecarResearch();
            if (!research.completed) return;
            const overlayId = 'horsecar-rail-overlay';
            if (overlayStack.find(o => o.id === overlayId)) return;
            const container = document.createElement('div');
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';
            container.style.color = '#111';
            const info = document.createElement('div');
            info.textContent = '地図上でクリックして路線を引き、分岐は既存のノードをタップしてください。';
            info.style.fontSize = '12px';
            info.style.opacity = '0.8';
            container.appendChild(info);
            const sliderRow = document.createElement('div');
            sliderRow.style.display = 'flex';
            sliderRow.style.flexDirection = 'column';
            sliderRow.style.gap = '4px';
            const sliderLabel = document.createElement('span');
            sliderLabel.style.fontSize = '12px';
            sliderLabel.textContent = '需要レベル: 3';
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '1';
            slider.max = '6';
            slider.value = '3';
            slider.addEventListener('input', () => {
                sliderLabel.textContent = `需要レベル: ${slider.value}`;
            });
            sliderRow.appendChild(sliderLabel);
            sliderRow.appendChild(slider);
            container.appendChild(sliderRow);
            const buttonsRow = document.createElement('div');
            buttonsRow.style.display = 'flex';
            buttonsRow.style.gap = '6px';
            const drawBtn = document.createElement('button');
            drawBtn.className = 'btn';
            drawBtn.textContent = pendingRailMode ? '描画を終了' : '路線を描く';
            drawBtn.addEventListener('click', () => {
                toggleRailMode();
                updateRailOverlayControls();
            });
            const commitBtn = document.createElement('button');
            commitBtn.className = 'btn';
            commitBtn.textContent = '路線を確定する';
            commitBtn.disabled = true;
            commitBtn.addEventListener('click', finalizeRailDraft);
            buttonsRow.appendChild(drawBtn);
            buttonsRow.appendChild(commitBtn);
            container.appendChild(buttonsRow);
            const scheduleBtn = document.createElement('button');
            scheduleBtn.className = 'btn';
            scheduleBtn.textContent = '鉄道ダイヤの制定';
            scheduleBtn.addEventListener('click', () => {
                openRailScheduleOverlay();
            });
            container.appendChild(scheduleBtn);
            const status = document.createElement('div');
            status.style.fontSize = '12px';
            status.style.opacity = '0.75';
            status.textContent = '描画モードでクリックして路線を引いてください。';
            container.appendChild(status);
            const listWrapper = document.createElement('div');
            listWrapper.appendChild(renderHorsecarLineList());
            container.appendChild(listWrapper);
            showStoryOverlay({
                id: overlayId,
                title: '馬車鉄道の敷設',
                body: container,
                modal: false,
                buttons: [
                    {
                        label: '閉じる',
                        action: () => {
                            closeStoryOverlay(overlayId);
                            deactivateRailMode();
                        },
                    },
                    {
                        label: '描画をキャンセル',
                        action: () => {
                            cancelRailDraft();
                            updateRailOverlayList();
                            updateRailOverlayStatus('描画をリセットしました。');
                        },
                    },
                ],
                animate: true,
            });
            railOverlayContext = {
                overlayId,
                slider,
                statusEl: status,
                listEl: listWrapper,
                drawBtn,
                commitBtn,
            };
            updateRailOverlayControls();
            updateRailOverlayStatus('描画モードを開始して路線を引いてください。');
            updateRailOverlayList();
        }
        function sampleCities(count = 1, filter) {
          const pool = cities.filter(c => c && (!filter || filter(c)));
          const picked = [];
          const limit = Math.min(count, pool.length);
          for (let i = 0; i < limit; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            picked.push(pool[idx]);
            pool.splice(idx, 1);
          }
          return picked;
        }

        function areStoryEventsUnlocked() {
          return storyScenarioState && !!storyScenarioState.storyEventsUnlocked;
        }

        function createEventContext() {
          const affectedCities = new Set();
          return {
            adjustGlobalFunds(delta) {
              globalFunds = Math.max(0, globalFunds + (delta || 0));
            },
            adjustCityStat(cityId, key, delta, min = 0, max = 200) {
              const city = cities[cityId];
              if (!city) return;
              city[key] = clamp((city[key] || 0) + (delta || 0), min, max);
            },
            adjustCityPopulation(cityId, delta) {
              const city = cities[cityId];
              if (!city) return;
              city.pop = Math.max(150, Math.round((city.pop || 0) + (delta || 0)));
            },
            adjustActorAuthority(actorId, delta) {
              if (actorAuthority[actorId] == null) return;
              actorAuthority[actorId] = clamp((actorAuthority[actorId] || 0) + (delta || 0), 0, 40);
            },
            pickCities(count = 1, filter) {
              const picked = sampleCities(count, filter);
              picked.forEach(city => {
                if (city && city.id != null) {
                  affectedCities.add(city.id);
                }
              });
              return picked;
            },
            forEachCity(callback) {
              if (typeof callback !== 'function') return;
              cities.forEach(city => {
                if (city) callback(city);
              });
            },
            describeAffectedCities() {
              if (!affectedCities.size) return '';
              const names = Array.from(affectedCities)
                .map(id => {
                  const city = cities[id];
                  return city ? city.name : `都市#${id}`;
                })
                .filter(Boolean);
              return names.join(' / ');
            },
            adjustCityDefense(cityId, delta) {
              if (!Number.isFinite(cityId)) return;
              const current = getCityDefenseCorps(cityId);
              setCityDefenseCorps(cityId, current + (delta || 0));
            },
            getCityDefense(cityId) {
              return getCityDefenseCorps(cityId);
            },
            adjustRegionDivisions(regionIndex, delta) {
              if (!Number.isFinite(regionIndex)) return;
              return adjustRegionDivisions(regionIndex, delta);
            },
            getRegionDivisions(regionIndex) {
              return getRegionDivisions(regionIndex);
            },
            getRegionLabel(regionIndex) {
              return getRegionLabel(regionIndex);
            },
            worldState: getWorldState(),
          };
        }

        function forcePlayerKinghood() {
          const savedResult = successionResult;
          successionResult = { winnerId: 'player', playerRank: 1 };
          applySuccessionRoles();
          successionResult = savedResult;
          adjustGlobalTrust('player', 20);
          markWorldDirty();
          updateControlButtons();
          if (tileInfoEl) {
            tileInfoEl.textContent = 'クーデターが成功し、あなたが新たな王となった。';
          }
        }

        const CIVIL_WAR_EVENT = {
          id: 'civil-war',
          title: '内戦の危機',
          description: '国内の勢力がそれぞれ正統性を振りかざし、民の間で武装蜂起が始まった。',
          choices: [
            {
              label: '忠誠軍を投入',
              description: '皇都から重装歩兵と騎兵を派遣し、混乱を封じる。',
              handler: (ctx) => {
                ctx.adjustGlobalFunds(-180);
                ctx.pickCities(2).forEach(c => ctx.adjustCityStat(c.id, 'military', 18));
                ctx.pickCities(2).forEach(c => ctx.adjustCityStat(c.id, 'stability', -5));
              },
            },
            {
              label: '自治制を尊重',
              description: '軍事力より講和と自治を重視する。',
              handler: (ctx) => {
                ctx.adjustGlobalFunds(-60);
                ctx.forEachCity(c => {
                  ctx.adjustCityStat(c.id, 'stability', 5);
                });
              },
            },
          ],
        };
        const FOREIGN_WAR_EVENT = {
          id: 'foreign-war',
          title: '戦争の兆候',
          description: '隣国が国境を越え、正式に戦端を開いた。兵站と国家の名誉が問われる。',
          choices: [
            {
              label: '前線を押し上げる',
              description: '敵地に深入りし、勢いを見せる。',
              handler: (ctx) => {
                ctx.adjustGlobalFunds(-220);
                ctx.pickCities(2).forEach(c => ctx.adjustCityStat(c.id, 'military', 20));
                ctx.pickCities(2).forEach(c => ctx.adjustCityStat(c.id, 'stability', -6));
              },
              nextEvent: CIVIL_WAR_EVENT,
            },
            {
              label: '防衛に徹する',
              description: '城塞防衛と連携を重視し、領土を固める。',
              handler: (ctx) => {
                ctx.adjustGlobalFunds(-120);
                ctx.pickCities(3).forEach(c => ctx.adjustCityStat(c.id, 'military', 12));
                ctx.pickCities(2).forEach(c => ctx.adjustCityStat(c.id, 'stability', 4));
              },
            },
          ],
        };
        const WORLD_EVENTS = [
          {
            id: 'harvest_fair',
            title: '王国大収穫祭',
            description: '田畑が豊かに実り、地方の安定と税収がふくらんだ。この恵みをどう扱うか、王の判断が待たれている。',
            choices: [
              { label: '盛大に祝う', description: '国庫を開き、民と喜びを分かち合う。', handler: (ctx) => { ctx.adjustGlobalFunds(-50); ctx.forEachCity(c => ctx.adjustCityStat(c.id, 'stability', 8)); } },
              { label: '備蓄と輸出', description: '余剰分を管理し、国の富として蓄える。', handler: (ctx) => { ctx.adjustGlobalFunds(250); ctx.pickCities(2).forEach(c => ctx.adjustCityStat(c.id, 'prosperity', 0.5)); } },
            ]
          },
          {
            id: 'caravan_arrival',
            title: '交易隊の到来',
            description: '東方より大規模な隊商が到着した。彼らは珍しい品々と共に、独自の商習慣を持ち込んでいるようだ。',
            choices: [
              { label: '自由交易を許可', description: '関税を下げ、市場の活性化を促す。', handler: (ctx) => { ctx.pickCities(2).forEach(c => { ctx.adjustCityStat(c.id, 'prosperity', 0.8); ctx.adjustCityStat(c.id, 'stability', -2); }); } },
              { label: '厳格な管理', description: '治安を優先し、取引を監視下で行わせる。', handler: (ctx) => { ctx.adjustGlobalFunds(100); ctx.pickCities(1).forEach(c => ctx.adjustCityStat(c.id, 'stability', 3)); } },
            ]
          },
          {
            id: 'border_dispute',
            title: '国境の不穏',
            description: '国境付近の村で、隣国の兵士が目撃されたとの報告がある。単なる迷走か、偵察か。',
            choices: [
              { 
                label: '使節を派遣', 
                description: '外交ルートを通じて真意を問いただす。', 
                handler: (ctx) => { ctx.adjustGlobalFunds(-30); },
                nextEvent: {
                  title: '隣国の回答',
                  description: '隣国は兵士の迷走を認め、謝罪と共に賠償金を提示してきた。',
                  choices: [
                    { label: '受け入れる', description: '関係悪化を避け、賠償金を受け取る。', handler: (ctx) => { ctx.adjustGlobalFunds(80); ctx.adjustActorAuthority('princess', 2); } },
                    { label: '強く抗議', description: '管理体制の甘さを糾弾し、優位に立つ。', handler: (ctx) => { ctx.adjustActorAuthority('marshal', 2); ctx.pickCities(1).forEach(c => ctx.adjustCityStat(c.id, 'legitimacy', 2)); } }
                  ]
                }
              },
              { 
                label: '国境警備強化', 
                description: '即座に軍を配備し、威圧する。', 
                handler: (ctx) => { ctx.adjustGlobalFunds(-80); ctx.pickCities(1).forEach(c => ctx.adjustCityStat(c.id, 'military', 10)); },
                nextEvent: {
                  title: '緊張の高まり',
                  description: 'こちらの軍事行動に対し、隣国も部隊を展開させた。一触即発の事態だ。',
                  choices: [
                    { label: '対話に切り替え', description: 'これ以上のエスカレートを避ける。', handler: (ctx) => { ctx.adjustCityStat(null, 'stability', -5); } },
                    { label: '防衛戦準備', description: '砦を築き、徹底抗戦の構えを見せる。', handler: (ctx) => { ctx.adjustGlobalFunds(-150); ctx.pickCities(1).forEach(c => { ctx.adjustCityStat(c.id, 'military', 15); ctx.adjustCityStat(c.id, 'stability', 5); }); } }
                  ]
                }
              },
            ]
          },
          {
            id: 'mining_accident',
            title: '鉱山の落盤',
            description: '主要な鉱山で落盤事故が発生した。救助には多額の費用と人手が必要となる。',
            choices: [
              { 
                label: '全力で救助', 
                description: '予算を度外視し、人命を最優先する。', 
                handler: (ctx) => { ctx.adjustGlobalFunds(-150); },
                nextEvent: {
                  title: '奇跡の生還',
                  description: '迅速な救助により、多くの作業員が助かった。彼らは感謝し、新たな鉱脈の情報を明かした。',
                  choices: [
                    { label: '鉱脈開発', description: '新たな富の源泉となる。', handler: (ctx) => { ctx.adjustGlobalFunds(200); ctx.pickCities(1).forEach(c => ctx.adjustCityStat(c.id, 'prosperity', 2)); } }
                  ]
                }
              },
              { 
                label: '操業優先', 
                description: '被害を最小限に抑え、採掘を継続させる。', 
                handler: (ctx) => { ctx.pickCities(1).forEach(c => { ctx.adjustCityStat(c.id, 'prosperity', 1); ctx.adjustCityStat(c.id, 'stability', -10); }); } 
              },
            ]
          },
          {
            id: 'magician_proposal',
            title: '魔術師の提案',
            description: '宮廷魔術師が、天候を操作する大規模な儀式を提案している。成功すれば豊作だが、失敗のリスクもある。',
            choices: [
              { 
                label: '儀式を許可', 
                description: '魔力と資金を投じ、賭けに出る。', 
                handler: (ctx) => { ctx.adjustGlobalFunds(-100); },
                nextEvent: {
                  title: '儀式の結果',
                  description: '空が輝き、恵みの雨が降り注いだ！...しかし、魔力の反動で一部の家畜が暴れている。',
                  choices: [
                    { label: '被害を補償', handler: (ctx) => { ctx.adjustGlobalFunds(-50); ctx.forEachCity(c => ctx.adjustCityStat(c.id, 'prosperity', 2)); } },
                    { label: '豊作を祝う', handler: (ctx) => { ctx.forEachCity(c => { ctx.adjustCityStat(c.id, 'prosperity', 3); ctx.adjustCityStat(c.id, 'stability', -2); }); } }
                  ]
                }
              },
              { label: '却下', description: '自然の摂理に任せる。', handler: (ctx) => { ctx.adjustActorAuthority('council', 1); } }
            ]
          },
          {
            id: 'refugee_wave',
            title: '難民の到来',
            description: '隣国の紛争から逃れた人々が国境に押し寄せている。労働力となるか、治安の脅威となるか。',
            choices: [
              {
                label: '受け入れ',
                description: '人道支援を行い、都市へ定住させる。',
                handler: (ctx) => {
                  const selectedCity = ctx.pickCities(1)[0];
                  const campCityId = selectedCity ? selectedCity.id : null;
                  if (selectedCity) {
                    ctx.adjustGlobalFunds(-120);
                    ctx.adjustCityStat(campCityId, 'stability', -5);
                    ctx.adjustCityPopulation(campCityId, 1200);
                  } else {
                    ctx.adjustGlobalFunds(-120);
                  }
                  if (campCityId != null) {
                    ctx.nextEvent = {
                      id: `refugee-camp-${campCityId}`,
                      title: '難民キャンプの開設',
                      description: '受け入れた人々のため、一時的な難民キャンプを構築する必要が生まれた。',
                      choices: [
                        {
                          label: '仮設施設を整備',
                          description: '専用のキャンプで受け入れ、人口を抑制する。',
                          handler: () => {
                            const city = cities[campCityId];
                            if (city) {
                              city.pop = Math.round((city.pop || 0) + 800);
                              ctx.adjustCityStat(campCityId, 'stability', 4);
                            }
                          },
                        },
                        {
                          label: '定住支援に切り替え',
                          description: '都市に吸収し、インフラを整える。',
                          handler: () => {
                            ctx.adjustCityStat(campCityId, 'stability', 6);
                          },
                        },
                      ],
                    };
                  }
                },
                nextEvent: null, // will be injected via ctx.nextEvent
              },
              {
                label: '国境封鎖',
                description: '入国を拒否し、国内の安定を守る。',
                handler: (ctx) => {
                  ctx.pickCities(1).forEach(c => ctx.adjustCityStat(c.id, 'military', 5));
                },
              },
            ],
          },
          {
            id: 'player_coup',
            enabled: () => roles.player !== 'king',
            title: 'クーデターの機運',
            description: '周辺の役人たちが民衆を扇動し、王城での血みどろの政変が囁かれている。自らの手で王座を掴むのか、それとも秩序を守るのか。',
            choices: [
              {
                label: '動乱を避ける',
                description: '静観し、他の勢力が先に動くのを待つ。',
                handler: (ctx) => {
                  ctx.adjustActorAuthority('council', 5);
                  ctx.adjustGlobalFunds(-30);
                },
              },
              {
                label: '兵を率いて進軍',
                description: '忠誠心の高い部隊を集めて王城へ突入する。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-140);
                  ctx.pickCities(2).forEach(c => ctx.adjustCityStat(c.id, 'military', 18));
                  ctx.adjustActorAuthority('marshal', -12);
                  forcePlayerKinghood();
                },
                nextEvent: CIVIL_WAR_EVENT,
              },
            ],
          },
          {
            id: 'foreign-invasion',
            title: '隣国の侵攻',
            description: '敵国の主力が国境を押し上げてきた。師団と都市の防衛団をどう活かすかが勝敗を分ける。',
            choices: [
              {
                label: '師団を前線へ',
                description: '脆弱な地方師団を集めて敵を押し戻す。',
                handler: (ctx) => {
                  const regionCount = Math.max(1, REGION_NAMES.length);
                  const regionEntries = [];
                  for (let idx = 0; idx < regionCount; idx++) {
                    regionEntries.push({ idx, divisions: ctx.getRegionDivisions(idx) });
                  }
                  regionEntries.sort((a, b) => a.divisions - b.divisions);
                  const target = regionEntries[0];
                  ctx.adjustGlobalFunds(-180 - Math.max(0, 20 - target.divisions) * 4);
                  ctx.adjustRegionDivisions(target.idx, -1);
                  const regionCities = cities.filter(city => city && getCityRegionIndex(city) === target.idx);
                  if (!regionCities.length) {
                    ctx.pickCities(2).forEach(city => {
                      ctx.adjustCityStat(city.id, 'military', 12);
                      ctx.adjustCityStat(city.id, 'stability', 4);
                    });
                  } else {
                    regionCities.forEach(city => {
                      ctx.adjustCityStat(city.id, 'military', 15 + target.divisions * 2);
                      ctx.adjustCityStat(city.id, 'stability', 6);
                      ctx.adjustCityDefense(city.id, -3);
                    });
                  }
                  ctx.adjustActorAuthority('marshal', -4);
                },
              },
              {
                label: '防衛団を動員',
                description: '都市単位の防衛団で侵攻を遅らせる。',
                handler: (ctx) => {
                  const defenders = ctx.pickCities(2);
                  if (!defenders.length) {
                    ctx.forEachCity(c => ctx.adjustCityStat(c.id, 'stability', 2));
                    return;
                  }
                  defenders.forEach(city => {
                    const defense = ctx.getCityDefense(city.id);
                    ctx.adjustCityStat(city.id, 'military', 10 + Math.floor(defense * 0.5));
                    ctx.adjustCityStat(city.id, 'stability', 5);
                    ctx.adjustCityDefense(city.id, -Math.min(defense, 4));
                  });
                  ctx.adjustGlobalFunds(-120);
                },
              },
              {
                label: '外交で時間稼ぎ',
                description: '補給を遅らせ、外政で危機を引き延ばす。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-70);
                  ctx.adjustActorAuthority('council', 2);
                  ctx.pickCities(3).forEach(city => {
                    ctx.adjustCityStat(city.id, 'stability', 3);
                    ctx.adjustCityStat(city.id, 'military', -6);
                  });
                },
              },
            ],
          },
          {
            id: 'internal-strife',
            title: '地方の内戦',
            description: '有力者間の反目が武装闘争に発展しそうだ。師団と防衛団をどう調停するかが問われる。',
            choices: [
              {
                label: '軍と防衛団を派遣',
                description: '師団と防衛団の共闘で秩序を守る。',
                handler: (ctx) => {
                  const city = ctx.pickCities(1)[0];
                  if (!city) {
                    ctx.adjustGlobalFunds(-90);
                    return;
                  }
                  const regionIndex = getCityRegionIndex(city);
                  const defense = ctx.getCityDefense(city.id);
                  const divisionBonus = ctx.getRegionDivisions(regionIndex);
                  ctx.adjustCityStat(city.id, 'military', 12 + Math.floor(defense * 0.5) + divisionBonus * 2);
                  ctx.adjustCityStat(city.id, 'stability', 8 + divisionBonus * 2);
                  ctx.adjustCityDefense(city.id, -Math.min(defense, 6));
                  ctx.adjustRegionDivisions(regionIndex, -1);
                  ctx.adjustGlobalFunds(-130);
                  ctx.adjustActorAuthority('marshal', -2);
                },
              },
              {
                label: '説得と譲歩',
                description: '講和と改革で民心を取り戻す。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-90);
                  ctx.adjustActorAuthority('council', 3);
                  ctx.pickCities(3).forEach(city => {
                    ctx.adjustCityStat(city.id, 'stability', 4);
                  });
                  ctx.forEachCity(c => ctx.adjustCityStat(c.id, 'military', -3));
                },
              },
              {
                label: '武力で一掃',
                description: '軍を投入し、犠牲を厭わず鎮圧する。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-40);
                  ctx.adjustActorAuthority('marshal', 5);
                  ctx.pickCities(2).forEach(city => {
                    ctx.adjustCityStat(city.id, 'stability', -11);
                    ctx.adjustCityStat(city.id, 'military', 9);
                    ctx.adjustCityDefense(city.id, -2);
                  });
                },
              },
            ],
          },
          {
            id: 'border_tension_seed',
            title: '国境での密談',
            description: () => `${formatNPCSummary()} が国境の幕営で軍備の配分を論じている。火種を払うか、そのまま炎上させるか、王の判断が必要だ。`,
            storyOnly: true,
            choices: [
              {
                label: 'Marshalの先制案',
                description: '秘策をいち早く取り、威勢を見せる。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-100);
                  ctx.adjustActorAuthority('marshal', 3);
                  ctx.adjustRegionDivisions(0, 1);
                  const city = ctx.pickCities(1)[0];
                  if (city) {
                    ctx.adjustCityStat(city.id, 'military', 12);
                    ctx.adjustCityStat(city.id, 'stability', -3);
                    ctx.adjustCityDefense(city.id, -2);
                  }
                },
                nextEvent: FOREIGN_WAR_EVENT,
              },
              {
                label: 'Princessの外交',
                description: '対話と贈り物で火を消す。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-65);
                  ctx.adjustActorAuthority('princess', 4);
                  ctx.adjustRegionDivisions(0, -1);
                  ctx.pickCities(2).forEach(city => {
                    ctx.adjustCityStat(city.id, 'stability', 5);
                  });
                },
              },
              {
                label: '評議会の策動',
                description: '評議会候補が逆に威嚇し、敵の警戒を煽る。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-50);
                  ctx.adjustActorAuthority('council', 2);
                  ctx.adjustRegionDivisions(1, 1);
                  const city = ctx.pickCities(1)[0];
                  if (city) {
                    ctx.adjustCityStat(city.id, 'military', 8);
                    ctx.adjustCityStat(city.id, 'stability', 3);
                  }
                  ctx.nextEvent = FOREIGN_WAR_EVENT;
                },
              },
            ],
          },
          {
            id: 'internal_tension_seed',
            title: '内紛の火種',
            description: () => `${formatNPCSummary()} が地方で反逆の噂を交わし、民心が揺らいでいる。`,
            storyOnly: true,
            choices: [
              {
                label: 'Marshalが鎮圧',
                description: '武力で沈めるが、反感も誘う。',
                handler: (ctx) => {
                  const city = ctx.pickCities(1)[0];
                  ctx.adjustGlobalFunds(-90);
                  ctx.adjustActorAuthority('marshal', -2);
                  if (city) {
                    ctx.adjustCityStat(city.id, 'military', 14);
                    ctx.adjustCityStat(city.id, 'stability', -8);
                    ctx.adjustCityDefense(city.id, -4);
                  }
                  ctx.nextEvent = CIVIL_WAR_EVENT;
                },
              },
              {
                label: 'Princessが妥協',
                description: '法と恩赦で和らげる。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-70);
                  ctx.adjustActorAuthority('princess', 3);
                  ctx.pickCities(3).forEach(city => {
                    ctx.adjustCityStat(city.id, 'stability', 6);
                  });
                  ctx.forEachCity(city => {
                    ctx.adjustCityStat(city.id, 'military', -2);
                  });
                  ctx.adjustRegionDivisions(1, -1);
                },
              },
              {
                label: '評議会の扇動',
                description: '分断でおとり、勢いを盗む。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-40);
                  ctx.adjustActorAuthority('council', 4);
                  ctx.pickCities(2).forEach(city => {
                    ctx.adjustCityStat(city.id, 'stability', -6);
                    ctx.adjustCityStat(city.id, 'military', 9);
                    ctx.adjustCityDefense(city.id, -1);
                  });
                  ctx.nextEvent = CIVIL_WAR_EVENT;
                },
              },
            ],
          },
          {
            id: 'npc_strategy_session',
            title: '候補者たちの軍略会議',
            description: () => `${formatNPCSummary()} が軍略会議を開き、火花が散っている。`,
            storyOnly: true,
            choices: [
              {
                label: '共闘して計画を利用',
                description: '彼らを抑え込みつつ軍備を使わせる。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-80);
                  ctx.adjustActorAuthority('marshal', 2);
                  const city = ctx.pickCities(1)[0];
                  if (city) {
                    ctx.adjustCityDefense(city.id, 3);
                    ctx.adjustCityStat(city.id, 'military', 7);
                  }
                  ctx.nextEvent = Math.random() < 0.6 ? FOREIGN_WAR_EVENT : CIVIL_WAR_EVENT;
                },
              },
              {
                label: '陰謀を暴露',
                description: '評議会候補を牽制し、威信を高める。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-40);
                  ctx.adjustActorAuthority('council', -2);
                  ctx.adjustActorAuthority('marshal', 3);
                  ctx.pickCities(2).forEach(city => {
                    ctx.adjustCityStat(city.id, 'stability', 4);
                    ctx.adjustCityStat(city.id, 'military', 3);
                  });
                },
              },
              {
                label: '知恵を吸収',
                description: '彼らの焦点を利用して対抗策を仕込む。',
                handler: (ctx) => {
                  ctx.adjustGlobalFunds(-60);
                  ctx.adjustActorAuthority('player', 2);
                  const city = ctx.pickCities(1)[0];
                  if (city) {
                    ctx.adjustCityDefense(city.id, 2);
                    ctx.adjustCityStat(city.id, 'stability', 5);
                  }
                  ctx.nextEvent = CIVIL_WAR_EVENT;
                },
              },
            ],
          },
        ];

        function maybeTriggerStorySequence() {
          if (!isStoryMode) return;
          const state = ensureStoryScenarioState();
          if (maybeTriggerStoryChapterEvents(state)) return;
          if (maybeTriggerStoryFailure(state)) return;
          if (!state.arrivalAnnounced) {
            showStoryArrivalOverlay(state);
            return;
          }
          if (!state.investigationAnnounced &&
            state.stage === STORY_SCENARIOS.INVESTIGATION &&
            currentTurn >= 2) {
            showStoryInvestigationOverlay(state);
            return;
          }
          if (maybeTriggerBuildingEra(state)) {
            return;
          }
          if (state.stage === STORY_SCENARIOS.PRE_SUCCESSION && maybeTriggerPreSuccessionNews(state)) {
            return;
          }
          if (!state.successionNarrativeShown && successionResult) {
            handleStorySuccessionNarrative(state);
            return;
          }
          if (maybeTriggerPoliticalEra(state)) {
            return;
          }
          if (maybeTriggerDivisionEra(state)) {
            return;
          }
          if (maybeTriggerRomanceStage(state)) {
            return;
          }
          if (maybeTriggerRomanceInteraction(state)) {
            return;
          }
          if (maybeTriggerRomanceScandal(state)) {
            return;
          }
          if (maybeTriggerRomanceEngagement(state)) {
            return;
          }
          if (state.successionNarrativeShown &&
            !state.legacyAnnounced &&
            state.successionTurn != null &&
            currentTurn >= state.successionTurn + 6) {
            showStoryLegacyOverlay(state);
            return;
          }
        }


        function maybeTriggerStoryChapterEvents(state) {
          if (!state) return false;
          const progress = ensureChapterProgress(state);
          if (!progress || !progress.currentChapterId) return false;
          const chapter = getChapterDefinition(progress.currentChapterId);
          if (!chapter) return false;
          const flags = ensureChapterFlags(state, chapter.chapterId);
          if (!flags) return false;
          applyChapterPassiveEffects(state, chapter, flags, progress);
          const startTurn = chapter.startTurn || 1;
          const endTurn = chapter.endTurn || (startTurn + 11);
          if (currentTurn === startTurn && !flags.introShown) {
            showChapterIntroOverlay(state, chapter, flags, progress);
            return true;
          }
          if (currentTurn === startTurn + 2 && !flags.engagementBroken) {
            showChapterEngagementOverlay(state, chapter, flags, progress);
            return true;
          }
          if (currentTurn === startTurn + 3 && flags.engagementBroken && !flags.worldReactionShown) {
            showChapterWorldReactionOverlay(state, chapter, flags, progress);
            return true;
          }
          if (
            currentTurn >= startTurn + 4 &&
            currentTurn <= startTurn + 5 &&
            flags.engagementBroken &&
            !flags.altoContacted
          ) {
            showChapterThirdPrinceOverlay(state, chapter, flags, progress);
            return true;
          }
          if (currentTurn === startTurn + 5 && !flags.chapterChoice) {
            showChapterChoiceOverlay(state, chapter, flags, progress);
            return true;
          }
          if (currentTurn === endTurn && !flags.endEventShown) {
            showChapterEndOverlay(state, chapter, flags, progress);
            return true;
          }
          return false;
        }

        function showChapterIntroOverlay(state, chapter, flags, progress) {
          if (!chapter || !flags) return false;
          const overlayId = `chapter-intro-${chapter.chapterId}`;
          if (overlayStack.find(entry => entry.id === overlayId)) return false;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '10px';
          const paragraph = document.createElement('p');
          paragraph.textContent = chapter.introText || '';
          paragraph.style.fontSize = '13px';
          container.appendChild(paragraph);
          timeControl.speed = 0;
          updateControlButtons();
          const overlay = showStoryOverlay({
            id: overlayId,
            title: chapter.title || '物語の章',
            body: container,
            modal: true,
            buttons: [{ label: '続ける', action: () => closeStoryOverlay(overlayId) }],
            animate: true,
          });
          flags.introShown = true;
          flags.princeFactionActive = true;
          recordStoryAction('story', 'chapter1_intro', { storyLabel: chapter.introText });
          return !!overlay;
        }

        function showChapterEngagementOverlay(state, chapter, flags, progress) {
          if (!chapter || !flags) return false;
          const overlayId = `chapter-engagement-${chapter.chapterId}`;
          if (overlayStack.find(entry => entry.id === overlayId)) return false;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '10px';
          const paragraph = document.createElement('p');
          paragraph.textContent = chapter.brokenEngagementText || '';
          paragraph.style.fontSize = '13px';
          container.appendChild(paragraph);
          timeControl.speed = 0;
          updateControlButtons();
          let applied = false;
          const applyEffects = () => {
            if (applied) return;
            applied = true;
            adjustNationStability(-2);
            adjustPlayerSupport('nobility', -6);
            if (progress && progress.chapterMetrics) {
              progress.chapterMetrics.uncertainty = (progress.chapterMetrics.uncertainty || 0) + 2;
            }
            flags.runeHouseStatus = 'floating';
            markWorldDirty();
            recordStoryAction('story', 'chapter1_engagement', { storyLabel: chapter.brokenEngagementText });
          };
          applyEffects();
          flags.engagementBroken = true;
          showStoryOverlay({
            id: overlayId,
            title: '婚約解消',
            body: container,
            modal: true,
            buttons: [{
              label: '理解した',
              action: () => {
                closeStoryOverlay(overlayId);
              },
            }],
            animate: true,
          });
          return true;
        }

        function showChapterWorldReactionOverlay(state, chapter, flags, progress) {
          if (!chapter || !flags) return false;
          const overlayId = `chapter-world-${chapter.chapterId}`;
          if (overlayStack.find(entry => entry.id === overlayId)) return false;
          const textPool = Array.isArray(chapter.worldReactionTexts) ? chapter.worldReactionTexts : [];
          const message = textPool[Math.floor(Math.random() * textPool.length)] || chapter.worldReactionTexts[0] || '';
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '10px';
          const paragraph = document.createElement('p');
          paragraph.textContent = message;
          paragraph.style.fontSize = '13px';
          container.appendChild(paragraph);
          timeControl.speed = 0;
          updateControlButtons();
          showStoryOverlay({
            id: overlayId,
            title: '宮廷の反応',
            body: container,
            modal: true,
            buttons: [{ label: '了解', action: () => closeStoryOverlay(overlayId) }],
            animate: true,
          });
          flags.worldReactionShown = true;
          if (progress && progress.chapterMetrics) {
            progress.chapterMetrics.uncertainty = (progress.chapterMetrics.uncertainty || 0) + 1;
          }
          recordStoryAction('story', 'chapter1_reaction', { storyLabel: message });
          return true;
        }

        function showChapterThirdPrinceOverlay(state, chapter, flags, progress) {
          if (!chapter || !flags) return false;
          const overlayId = `chapter-thirdprince-${chapter.chapterId}`;
          if (overlayStack.find(entry => entry.id === overlayId)) return false;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '10px';
          const paragraph = document.createElement('p');
          paragraph.textContent = chapter.thirdPrinceText || '';
          paragraph.style.fontSize = '13px';
          container.appendChild(paragraph);
          const list = document.createElement('div');
          list.style.display = 'flex';
          list.style.flexDirection = 'column';
          list.style.gap = '6px';
          (chapter.thirdPrinceChoices || []).forEach(choice => {
            const entry = document.createElement('div');
            entry.style.display = 'flex';
            entry.style.flexDirection = 'column';
            const label = document.createElement('strong');
            label.textContent = choice.label;
            const summary = document.createElement('span');
            summary.textContent = choice.summary || '';
            summary.style.fontSize = '12px';
            summary.style.opacity = '0.7';
            entry.appendChild(label);
            entry.appendChild(summary);
            list.appendChild(entry);
          });
          container.appendChild(list);
          timeControl.speed = 0;
          updateControlButtons();
          const applyChoice = (choice) => {
            if (!choice || flags.altoContacted) return;
            flags.altoContacted = true;
            flags.altoChoice = choice.id;
            if (choice.id === 'courteous') {
              flags.altoTrust = (flags.altoTrust || 0) + 6;
              adjustPlayerSupport('nobility', 2);
              adjustPlayerSupport('citizens', 1);
              if (progress && progress.chapterMetrics) {
                progress.chapterMetrics.uncertainty = Math.max(0, (progress.chapterMetrics.uncertainty || 0) - 1);
              }
            } else {
              flags.altoTrust = (flags.altoTrust || 0);
              adjustNationStability(1);
            }
            recordStoryAction('story', `chapter1_alto_${choice.id}`, { storyLabel: choice.summary || choice.id });
            markWorldDirty();
            closeStoryOverlay(overlayId);
          };
          const buttons = (chapter.thirdPrinceChoices || []).map(choice => ({
            label: choice.label,
            action: () => applyChoice(choice),
          }));
          if (!buttons.length) buttons.push({ label: '了解', action: () => closeStoryOverlay(overlayId) });
          showStoryOverlay({
            id: overlayId,
            title: '第一接触',
            body: container,
            modal: true,
            buttons,
            animate: true,
          });
          return true;
        }

        function showChapterChoiceOverlay(state, chapter, flags, progress) {
          if (!chapter || !flags) return false;
          const overlayId = `chapter-choice-${chapter.chapterId}`;
          if (overlayStack.find(entry => entry.id === overlayId)) return false;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '10px';
          const paragraph = document.createElement('p');
          paragraph.textContent = chapter.choiceText || '';
          paragraph.style.fontSize = '13px';
          container.appendChild(paragraph);
          const optionsWrapper = document.createElement('div');
          optionsWrapper.style.display = 'flex';
          optionsWrapper.style.flexDirection = 'column';
          optionsWrapper.style.gap = '8px';
          const applyChoice = (option) => {
            if (!option || flags.chapterChoice) return;
            flags.chapterChoice = option.id;
            if (option.id === 'stability') {
              adjustNationStability(2);
              adjustPlayerSupport('nobility', 3);
              adjustPlayerSupport('citizens', -1);
              if (progress && progress.chapterMetrics) {
                progress.chapterMetrics.uncertainty = Math.max(0, (progress.chapterMetrics.uncertainty || 0) - 1);
              }
            } else {
              adjustNationStability(-2);
              adjustPlayerSupport('citizens', 3);
              adjustPlayerSupport('nobility', -2);
              if (progress && progress.chapterMetrics) {
                progress.chapterMetrics.uncertainty = (progress.chapterMetrics.uncertainty || 0) + 1;
              }
            }
            recordStoryAction('player', `chapter1_choice_${option.id}`, { storyLabel: option.summary });
            markWorldDirty();
            closeStoryOverlay(overlayId);
          };
          (chapter.choiceOptions || []).forEach(option => {
            const block = document.createElement('div');
            block.style.display = 'flex';
            block.style.flexDirection = 'column';
            block.style.gap = '4px';
            block.style.borderTop = '1px solid rgba(0,0,0,0.1)';
            block.style.paddingTop = '6px';
            const title = document.createElement('strong');
            title.textContent = option.label;
            const summary = document.createElement('span');
            summary.textContent = option.summary || '';
            summary.style.fontSize = '12px';
            summary.style.opacity = '0.7';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn';
            button.textContent = 'これを選ぶ';
            button.addEventListener('click', () => applyChoice(option));
            block.appendChild(title);
            block.appendChild(summary);
            block.appendChild(button);
            optionsWrapper.appendChild(block);
          });
          container.appendChild(optionsWrapper);
          timeControl.speed = 0;
          updateControlButtons();
          showStoryOverlay({
            id: overlayId,
            title: '王国の方針',
            body: container,
            modal: true,
            buttons: [],
            animate: true,
          });
          return true;
        }

        function showChapterEndOverlay(state, chapter, flags, progress) {
          if (!chapter || !flags) return false;
          const overlayId = `chapter-end-${chapter.chapterId}`;
          if (overlayStack.find(entry => entry.id === overlayId)) return false;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '10px';
          const paragraph = document.createElement('p');
          paragraph.textContent = chapter.endText || '';
          paragraph.style.fontSize = '13px';
          container.appendChild(paragraph);
          timeControl.speed = 0;
          updateControlButtons();
          showStoryOverlay({
            id: overlayId,
            title: '章の終わり',
            body: container,
            modal: true,
            buttons: [{ label: '次へ', action: () => closeStoryOverlay(overlayId) }],
            animate: true,
          });
          flags.endEventShown = true;
          flags.chapterCompletedAt = currentTurn;
          if (progress) {
            progress.currentChapterId = null;
          }
          recordStoryAction('story', 'chapter1_end', { storyLabel: chapter.endText });
          return true;
        }

        function applyChapterPassiveEffects(state, chapter, flags, progress) {
          if (!state || !chapter || !flags || !flags.chapterChoice) return;
          const startTurn = chapter.startTurn || 1;
          const endTurn = chapter.endTurn || (startTurn + 11);
          const passiveStart = startTurn + 6;
          const passiveEnd = endTurn - 1;
          if (currentTurn < passiveStart || currentTurn > passiveEnd) return;
          if (flags.lastPassiveTurn === currentTurn) return;
          const choice = flags.chapterChoice;
          const delta = choice === 'stability' ? 1 : -1;
          adjustNationStability(delta);
          if (choice === 'stability') {
            adjustPlayerSupport('nobility', 1);
            adjustPlayerSupport('citizens', -1);
          } else {
            adjustPlayerSupport('citizens', 1);
            adjustPlayerSupport('nobility', -1);
          }
          if (progress && progress.chapterMetrics) {
            const currentUncertainty = progress.chapterMetrics.uncertainty || 0;
            const change = choice === 'stability' ? -1 : 1;
            progress.chapterMetrics.uncertainty = Math.max(0, currentUncertainty + change);
          }
          flags.lastPassiveTurn = currentTurn;
          markWorldDirty();
          recordStoryAction('system', `chapter1_passive_${choice}`, { storyLabel: `Passive turn ${currentTurn}` });
        }
        function applyWorldEvent(event) {
          if (!event) return;
          timeControl.speed = 0;
          updateControlButtons();
          playSystemSound('news');
          
          const overlayId = `event-${event.id || Date.now()}`;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '12px';
          
          // Newspaper body
          const paper = document.createElement('div');
          paper.style.background = '#f6f1e4';
          paper.style.color = '#1a1a1a';
          paper.style.padding = '14px';
          paper.style.border = '1px solid #444';
          paper.style.fontFamily = "'Times New Roman', serif";
          const descriptionText = typeof event.description === 'function'
            ? event.description()
            : (event.description || '');
          paper.innerHTML = `
            <div style="font-size:18px; font-weight:bold; margin-bottom:8px; border-bottom:2px double #333; padding-bottom:4px;">${event.title}</div>
            <div style="font-size:14px; line-height:1.6;">${descriptionText}</div>
          `;
          container.appendChild(paper);

          const choicesContainer = document.createElement('div');
          choicesContainer.style.display = 'flex';
          choicesContainer.style.flexDirection = 'column';
          choicesContainer.style.gap = '8px';

          if (event.choices && event.choices.length) {
            event.choices.forEach(choice => {
              const btn = document.createElement('button');
              btn.className = 'btn';
              btn.style.textAlign = 'left';
              btn.style.padding = '8px 12px';
              btn.innerHTML = `<strong style="display:block; font-size:13px; margin-bottom:2px;">${choice.label}</strong><span style="font-size:11px; opacity:0.8;">${choice.description || ''}</span>`;
              btn.addEventListener('click', () => {
                const ctx = createEventContext();
                if (choice.handler) choice.handler(ctx);
                markWorldDirty();
                updateHudStats();
                closeStoryOverlay(overlayId);
                
                const next = choice.nextEvent || ctx.nextEvent;
                if (next) {
                  setTimeout(() => {
                    applyWorldEvent(next);
                  }, 500);
                }
              });
              choicesContainer.appendChild(btn);
            });
          } else {
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = '了解';
            btn.addEventListener('click', () => closeStoryOverlay(overlayId));
            choicesContainer.appendChild(btn);
          }
          container.appendChild(choicesContainer);

          showStoryOverlay({
            id: overlayId,
            title: '王命新聞・号外',
            body: container,
            modal: false,
            center: true,
            width: '400px',
            buttons: [] 
          });
        }

        function maybeTriggerWorldEvent() {
          if (!successionResult) return;
          if (Math.random() > 0.08) return;
          const available = WORLD_EVENTS.filter(evt => (
            (!evt.storyOnly || areStoryEventsUnlocked()) &&
            (!evt.enabled || evt.enabled())
          ));
          if (!available.length) return;
          const event = available[Math.floor(Math.random() * available.length)];
          applyWorldEvent(event);
        }

        function openFrontierOverlay() {
          const overlayId = 'frontier-overlay';
          if (overlayStack.find(o => o.id === overlayId)) return;
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          container.style.gap = '8px';
          container.style.color = '#111';
          const description = document.createElement('div');
          description.textContent = '選択肢から候補地を確認し、開拓を進める場所を決定してください。';
          description.style.fontSize = '12px';
          description.style.opacity = '0.7';
          container.appendChild(description);

          const tileList = document.createElement('div');
          tileList.style.display = 'flex';
          tileList.style.flexDirection = 'column';
          tileList.style.gap = '6px';
          tileList.style.maxHeight = '260px';
          tileList.style.overflowY = 'auto';
          tileList.style.paddingRight = '4px';
          const tiles = getUnchartedTiles(6);
          if (!tiles.length) {
            const empty = document.createElement('div');
            empty.textContent = '未開の地は見つかりませんでした';
            empty.style.color = '#111';
            tileList.appendChild(empty);
          } else {
          tiles.forEach(tile => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.background = 'rgba(0,0,0,0.05)';
            row.style.borderRadius = '6px';
            row.style.padding = '6px 8px';
            row.style.color = '#111';
            const info = document.createElement('span');
            info.style.fontSize = '12px';
            info.style.color = '#0f1116';
            info.textContent = formatFrontierTile(tile);
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = '開拓';
            btn.style.color = '#e5e9f0';
            btn.addEventListener('click', () => {
              const executed = tryExecuteStoryAction('frontier_development', 'player', null, {
                showReason: true,
                frontierTile: tile,
              });
              if (executed) {
                pushCandidateLogEntry('infrastructure', null, `未開の地開発 (${tile.x},${tile.y})`);
                markMapDirty();
                updateHudStats();
                closeStoryOverlay(overlayId);
              }
            });
            row.appendChild(info);
            row.appendChild(btn);
            tileList.appendChild(row);
          });
          }
          container.appendChild(tileList);

          showStoryOverlay({
            id: overlayId,
            title: '未開の地開拓',
            body: container,
            modal: true,
            buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
            animate: true,
          });
        }

        function getUnchartedTiles(limit = 6) {
          const candidates = [];
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const tile = map[y][x];
          const hasManualRoad = !!tile.manualRoad;
        if (tile.city) continue;
        if (isWaterBase(tile.base)) continue;
        if (tile.road && !hasManualRoad) continue;
        const civLevel = tile.civ || 0;
        if (civLevel > 3 && !hasManualRoad) continue;
          candidates.push({ x, y, tile, base: tile.base, civ: tile.civ || 0, manualRoad: hasManualRoad });
        }
      }
      candidates.sort((a, b) => {
        if (a.manualRoad !== b.manualRoad) return a.manualRoad ? -1 : 1;
        const diff = (a.civ - b.civ);
        if (diff !== 0) return diff;
        return (a.base || '').localeCompare(b.base || '');
      });
          return candidates.slice(0, limit);
        }

        function formatFrontierTile(entry) {
        const label = BASE_LABEL[entry.base] || '未知地';
        const civ = typeof entry.civ === 'number' ? entry.civ.toFixed(1) : '0.0';
        const manual = entry.manualRoad ? ' (手動道路)' : '';
        return `${entry.x},${entry.y} - ${label}${manual} / civ ${civ}`;
      }

        function userCanManageInfrastructure() {
          return roles.player === 'king' || roles.player === 'chancellor';
        }

        function handleHUDAction(e) {
        if (appState !== 'map' || !worldReady) return;
        const action = e.currentTarget.dataset.action;
        const timeLocked = isStoryMode && successionTurnPlanned != null && currentTurn < successionTurnPlanned;
        const canManageInfrastructure = userCanManageInfrastructure();
      switch(action) {
      case 'reset-view':
        recenterView(true);
        render();
        break;
      case 'toggle-2d':
        is2DMode = !is2DMode;
        startModeTransitionAnimation(is2DMode);
        recenterView(true);
        render();
        break;
      case 'toggle-traffic':
        showTrafficOverlay = !showTrafficOverlay;
        updateControlButtons();
        render();
        break;
      case 'toggle-names':
        if (!is2DMode) {
          tileInfoEl.textContent = '都市名は2Dモードのみ表示できます';
          break;
        }
        showCityNames = !showCityNames;
        render();
        break;
      case 'toggle-civ':
        showCivOverlay = !showCivOverlay;
        render();
        break;
      case 'toggle-roads':
        showRoads = !showRoads;
        render();
        break;
        case 'select-capital': {
          if (isCapitalDevelopmentLocked()) {
            if (tileInfoEl) tileInfoEl.textContent = getCapitalActionLockedMessage();
            break;
          }
          const next = !pendingCapitalSelection;
          pendingCapitalSelection = next;
          pendingDevelopment = false;
          pendingRoadMode = false;
        if (next) {
          tileInfoEl.textContent = '王都に指定したい都市をクリックしてください';
        } else {
          tileInfoEl.textContent = '王都指定をキャンセルしました';
        }
        break;
      }
        case 'develop': {
          if (isCapitalDevelopmentLocked()) {
            if (tileInfoEl) tileInfoEl.textContent = getCapitalActionLockedMessage();
            break;
          }
          const next = !pendingDevelopment;
          pendingDevelopment = next;
          pendingCapitalSelection = false;
          pendingRoadMode = false;
        if (next) {
          tileInfoEl.textContent = '開拓する場所をクリックしてください';
        } else {
          tileInfoEl.textContent = '開拓モードを終了しました';
        }
        break;
      }
        case 'city-list':
          showCityListOverlay();
          break;
        case 'story-timeline':
          if (!isStoryMode) {
            if (tileInfoEl) tileInfoEl.textContent = 'ストーリーモードでのみ王命履歴が閲覧できます';
            break;
          }
          openStoryTimelineOverlay();
          break;
        case 'save-world':
          exportWorldAsJson();
          break;
        case 'load-world':
          importWorldFromJson('map');
          break;
      case 'nation-overview':
        openNationOverviewOverlay();
        break;
      case 'manage-military':
        openMilitaryCompositionOverlay();
        break;
      case 'population-plan':
        if (roles.player !== 'king') {
          if (tileInfoEl) tileInfoEl.textContent = '王でないと人口増加計画を実行できません。';
          break;
        }
        openPopulationPlanOverlay();
        break;
      case 'rename-city':
        openCityRenameOverlay();
        break;
      case 'abdicate':
        if (roles.player !== 'king') {
          if (tileInfoEl) tileInfoEl.textContent = '王位を譲れるのは現王だけです。';
          break;
        }
        openAbdicationOverlay();
        break;
      case 'story-abdicate':
        handleStoryEndRequest();
        break;
        case 'time-stop':
          timeControl.speed = 0;
          break;
        case 'time-1x':
          timeControl.speed = 1;
          break;
        case 'time-2x':
          if (timeLocked) {
            if (tileInfoEl) {
              tileInfoEl.textContent = '王決定までは高速時間（2x/3x）は使用できません（停止/1xのみ）';
            }
            break;
          }
          timeControl.speed = 2;
          break;
        case 'time-3x':
          if (timeLocked) {
            if (tileInfoEl) {
              tileInfoEl.textContent = '王決定までは高速時間（2x/3x）は使用できません（停止/1xのみ）';
            }
            break;
          }
          timeControl.speed = 3;
          break;
        case 'back-title':
          if (worldDirty) {
            showConfirmOverlay();
          } else {
            completeReturnToTitle();
          }
          break;
        case 'candidate-infra':
        case 'candidate-security':
        case 'candidate-magic': {
          createActionOverlay(action);
          break;
        }
        case 'road-maintenance':
          if (!canManageInfrastructure) {
            if (tileInfoEl) tileInfoEl.textContent = '王または宰相でないと操作できません';
            break;
          }
          openRoadConstructionOverlay();
          break;
        case 'rail-maintenance':
          if (!canManageInfrastructure) {
            if (tileInfoEl) tileInfoEl.textContent = '王または宰相でないと操作できません';
            break;
          }
          openHorsecarRailOverlay();
          break;
        case 'enact-law':
          if (roles.player !== 'king') {
            if (tileInfoEl) tileInfoEl.textContent = '王であれば法律を制定できます';
            break;
          }
          openLawSelectionOverlay();
          break;
        case 'develop-frontier':
          if (roles.player !== 'king') {
            if (tileInfoEl) tileInfoEl.textContent = '王であれば未開の地を開拓できます';
            break;
          }
          openFrontierOverlay();
          break;
        default:
          break;
      }
    updateControlButtons();
  }

    function isCapitalDevelopmentLocked() {
      if (!isStoryMode) return roles.player !== 'king';
      return !successionResult || roles.player !== 'king';
    }

    function getCapitalActionLockedMessage() {
      if (roles.player !== 'king') {
        return 'あなたは王位を得られなかったため、この行動は制限されています';
      }
      if (!successionResult) {
        return '王が決まるまではこの行動は行えません';
      }
      return '';
    }

    function updateControlButtons() {
      updateMobileSpeedButton();
      const timeLocked = isStoryMode && successionTurnPlanned != null && currentTurn < successionTurnPlanned;
    const storyState = storyScenarioState;
    const storyEndReady = !!(storyState && storyState.storyEndReady && !storyState.storyEndInvoked);
    hudButtons.forEach(btn => {
      const action = btn.dataset.action;
      let active = false;
      let disabled = false;
      if (action === 'toggle-2d') active = is2DMode;
      else if (action === 'toggle-traffic') active = showTrafficOverlay;
      else if (action === 'toggle-civ') active = showCivOverlay;
      else if (action === 'toggle-roads') active = showRoads;
      else if (action === 'toggle-names') {
        active = showCityNames && is2DMode;
        disabled = !is2DMode;
      }
        else if (action === 'select-capital') active = pendingCapitalSelection;
        else if (action === 'develop') active = pendingDevelopment;
        // pendingRoadMode has no direct HUD button, but we ensure mutual exclusivity
        if ((action === 'select-capital' || action === 'develop') && isCapitalDevelopmentLocked()) {
          disabled = true;
          active = false;
        }
      else if (action === 'city-list') active = cityListVisible;
      else if (action === 'population-plan') {
        disabled = roles.player !== 'king';
      }
      else if (action === 'story-timeline') {
        btn.style.display = isStoryMode ? '' : 'none';
        active = false;
        disabled = !isStoryMode;
      }
      else if (action === 'story-abdicate') {
        btn.style.display = storyEndReady ? '' : 'none';
        active = false;
        disabled = !storyEndReady;
      }
      else if (action === 'time-stop') active = timeControl.speed === 0;
        else if (action === 'time-1x') active = timeControl.speed === 1;
        else if (action === 'time-2x') {
          active = timeControl.speed === 2;
          if (timeLocked) {
            btn.disabled = true;
            active = false;
          } else if (btn.disabled) {
            btn.disabled = false;
          }
        }
        else if (action === 'time-3x') {
          active = timeControl.speed === 3;
          if (timeLocked) {
            btn.disabled = true;
            active = false;
          } else if (btn.disabled) {
            btn.disabled = false;
          }
      }
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (['toggle-names','time-2x','time-3x','select-capital','develop','story-timeline','story-abdicate','population-plan'].includes(action)) {
            btn.disabled = disabled;
          } else if (btn.disabled) {
            btn.disabled = false;
          }
      });
        if (candidateActionsRowEl) {
          candidateActionsRowEl.style.display = 'flex';
        }
        if (lawActionBtn) {
          const enabled = roles.player === 'king';
          lawActionBtn.style.display = enabled ? 'inline-flex' : 'none';
          lawActionBtn.disabled = !enabled;
        }
        if (frontierActionBtn) {
          const enabled = roles.player === 'king';
          frontierActionBtn.style.display = enabled ? 'inline-flex' : 'none';
          frontierActionBtn.disabled = !enabled;
        }
        const infrastructureEnabled = roles.player === 'king' || roles.player === 'chancellor';
        if (roadManualBtn) {
          roadManualBtn.style.display = infrastructureEnabled ? 'inline-flex' : 'none';
          roadManualBtn.disabled = !infrastructureEnabled;
        }
        if (railManualBtn) {
          railManualBtn.style.display = infrastructureEnabled ? 'inline-flex' : 'none';
          railManualBtn.disabled = !infrastructureEnabled;
        }
    if (populationPlanBtn) {
      const enabled = roles.player === 'king';
      populationPlanBtn.style.display = enabled ? 'inline-flex' : 'none';
      populationPlanBtn.disabled = !enabled;
    }
    refreshPanelActionStates();
    refreshMobileSystemActionButtons();
  }

  function handleTouchAction(action) {
    if (appState !== 'map' || !worldReady) return;
    switch (action) {
      case 'toggle-civ':
        showCivOverlay = !showCivOverlay;
        invalidateChunkLayers(['terrain']);
        render();
        break;
      case 'toggle-roads':
        showRoads = !showRoads;
        invalidateChunkLayers(['infra']);
        render();
        break;
      case 'toggle-2d':
        is2DMode = !is2DMode;
        startModeTransitionAnimation(is2DMode);
        recenterView(true);
        chunkRefreshNeeded = true;
        render();
        break;
      case 'toggle-names':
        showCityNames = !showCityNames;
        render();
        break;
      case 'toggle-traffic':
        showTrafficOverlay = !showTrafficOverlay;
        render();
        break;
      case 'select-capital':
        requestCapitalSelection();
        break;
      case 'develop':
        requestDevelopmentSelection();
        break;
      case 'candidate-infra':
      case 'candidate-security':
      case 'candidate-magic':
        createActionOverlay(action);
        break;
      case 'road-maintenance':
        if (!userCanManageInfrastructure()) {
          if (tileInfoEl) tileInfoEl.textContent = '王または宰相でないと操作できません';
          break;
        }
        openRoadConstructionOverlay();
        break;
      case 'rail-maintenance':
        if (!userCanManageInfrastructure()) {
          if (tileInfoEl) tileInfoEl.textContent = '王または宰相でないと操作できません';
          break;
        }
        openHorsecarRailOverlay();
        break;
      case 'enact-law':
        if (roles.player !== 'king') {
          if (tileInfoEl) tileInfoEl.textContent = '王であれば法律を制定できます';
          break;
        }
        openLawSelectionOverlay();
        break;
      case 'develop-frontier':
        if (roles.player !== 'king') {
          if (tileInfoEl) tileInfoEl.textContent = '王でないと未開地を開拓できません';
          break;
        }
        openFrontierOverlay();
        break;
      case 'reset-view':
        recenterView(true);
        render();
        break;
      case 'save-world':
        exportWorldAsJson();
        break;
      case 'load-world':
        importWorldFromJson('map');
        break;
      case 'rename-city':
        openCityRenameOverlay();
        break;
      case 'manage-military':
        openMilitaryCompositionOverlay();
        break;
      case 'population-plan':
        if (roles.player !== 'king') {
          if (tileInfoEl) tileInfoEl.textContent = '王でないと人口増加計画を実行できません。';
          break;
        }
        openPopulationPlanOverlay();
        break;
      case 'abdicate':
        openAbdicationOverlay();
        break;
      case 'story-abdicate':
        handleStoryEndRequest();
        break;
      case 'return-title':
        hideGameOver();
        showConfirmOverlay();
        break;
      default:
        return;
    }
    updateControlButtons();
  }

  function triggerHUDButton(action) {
    const target = hudButtons.find(btn => btn.dataset.action === action);
    if (target) target.click();
  }

  function refreshPanelActionStates() {
    document.querySelectorAll('[data-panel-action]').forEach(button => {
      const action = button.dataset.panelAction;
      let active = false;
      let disabled = false;
      switch (action) {
        case 'toggle-civ':
          active = showCivOverlay;
          break;
        case 'toggle-roads':
          active = showRoads;
          break;
        case 'toggle-2d':
          active = is2DMode;
          break;
        case 'toggle-names':
          active = showCityNames;
          disabled = !is2DMode;
          break;
        case 'select-capital':
          active = pendingCapitalSelection;
          disabled = isCapitalDevelopmentLocked();
          break;
        case 'develop':
          active = pendingDevelopment;
          disabled = isCapitalDevelopmentLocked();
          break;
        case 'toggle-traffic':
          active = showTrafficOverlay;
          break;
        default:
          break;
      }
      button.classList.toggle('active', active);
      button.disabled = disabled;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('[data-hud-action]').forEach(button => {
      const action = button.dataset.hudAction;
      const source = hudButtons.find(btn => btn.dataset.action === action);
      if (source) {
        button.disabled = source.disabled;
        const isActive = source.classList.contains('active');
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      }
    });
  }

  function updateMobileSpeedButton() {
    if (!mobileSpeedIndicatorEl) return;
    const label = SPEED_LABELS[timeControl.speed] || '1x';
    mobileSpeedIndicatorEl.textContent = label;
    mobileSpeedIndicatorEl.setAttribute('aria-label', `時間速度 ${label}`);
    mobileSpeedIndicatorEl.classList.toggle('mobile-speed-paused', timeControl.speed === 0);
  }

  function updateOrientationLock() {
    if (!orientationLockEl) return;
    const shouldShow =
      hasTouchSupport &&
      window.innerWidth <= MOBILE_BREAKPOINT &&
      window.innerHeight < window.innerWidth;
    orientationLockEl.classList.toggle('visible', shouldShow);
    document.body.classList.toggle('orientation-locked', shouldShow);
  }

  function getMobileUiReservedHeight() {
    const baseHeight = window.innerHeight || canvas.height || 740;
    const candidate = Math.round(baseHeight * MOBILE_UI_HEIGHT_RATIO);
    return clamp(candidate, MOBILE_UI_HEIGHT_MIN, MOBILE_UI_HEIGHT_MAX);
  }

  function refreshMobileLayout() {
    const isEnabled = document.body && document.body.classList.contains('mobile-ui-enabled');
    const reserved = isEnabled ? getMobileUiReservedHeight() : 0;
    if (document.body) {
      document.body.style.setProperty('--mobile-ui-height', `${reserved}px`);
    }
    if (mobileUiEl) {
      mobileUiEl.style.height = reserved ? `${reserved}px` : '';
    }
    return reserved;
  }

  function updateMobileOverlayHeader() {
    if (!mobileModalHeaderEl || !mobileModalTitleEl) return;
    const entry = mobileOverlayHistory[mobileOverlayHistory.length - 1];
    if (entry) {
      mobileModalTitleEl.textContent = entry.title || '';
      mobileModalHeaderEl.classList.add('visible');
    } else {
      mobileModalHeaderEl.classList.remove('visible');
    }
  }

  function registerMobileOverlayEntry(id, title, closeFn) {
    if (!document?.body?.classList.contains('mobile-ui-enabled')) return;
    if (!id) return;
    const existing = mobileOverlayHistory.findIndex(entry => entry.id === id);
    if (existing !== -1) {
      mobileOverlayHistory.splice(existing, 1);
    }
    mobileOverlayHistory.push({ id, title: title || '', close: closeFn });
    updateMobileOverlayHeader();
  }

  function removeMobileOverlayEntry(id) {
    if (!id) return;
    const idx = mobileOverlayHistory.findIndex(entry => entry.id === id);
    if (idx === -1) return;
    mobileOverlayHistory.splice(idx, 1);
    updateMobileOverlayHeader();
  }

  function handleMobileOverlayBack() {
    if (!mobileOverlayHistory.length) return;
    const entry = mobileOverlayHistory.pop();
    updateMobileOverlayHeader();
    if (entry && typeof entry.close === 'function') {
      entry.close();
    }
  }

  function setActiveMobileMode(mode) {
    const target = MOBILE_MODE_ACTIONS[mode] ? mode : 'world';
    mobileActiveMode = target;
    mobileModeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mobileMode === target);
    });
    if (mobileContextPanel) {
      mobileContextPanel.dataset.mode = target;
    }
    renderMobileContextActions();
    updateMobileContextHeading();
  }

  const mobileSystemActionButtons = new Map();

  function refreshMobileSystemActionButtons() {
    mobileSystemActionButtons.forEach((btn, key) => {
      if (!btn) return;
      let disabled = false;
      if (key === 'population-plan' || key === 'abdicate') {
        disabled = roles.player !== 'king';
      }
      btn.disabled = disabled;
    });
  }

  function renderMobileContextActions() {
    if (!mobileContextActionsEl) return;
    mobileContextActionsEl.innerHTML = '';
    const entries = (MOBILE_MODE_ACTIONS[mobileActiveMode] || []).slice(0, 3);
    if (!entries.length) {
      const note = document.createElement('div');
      note.textContent = '利用できる操作がありません。';
      note.style.opacity = '0.7';
      mobileContextActionsEl.appendChild(note);
      return;
    }
    entries.forEach(entry => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = entry.label;
      if (entry.description) btn.title = entry.description;
      const disabled = typeof entry.disabled === 'function' ? entry.disabled() : false;
      btn.disabled = disabled;
      if (entry.confirm) btn.classList.add('confirm');
      btn.addEventListener('click', () => handleMobileContextAction(entry));
      mobileContextActionsEl.appendChild(btn);
    });
    if (mobileSystemActionsEl) {
      mobileSystemActionsEl.style.display = mobileActiveMode === 'system' ? 'flex' : 'none';
    }
  }

  function ensureExtraMobileSystemActions() {
    if (!mobileSystemActionsEl) return;
    MOBILE_SYSTEM_EXTRA_ACTIONS.forEach(entry => {
      if (!entry || !entry.key) return;
      if (mobileSystemActionsEl.querySelector(`[data-mobile-system="${entry.key}"]`)) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.mobileSystem = entry.key;
      btn.classList.add('mobile-system-btn');
      btn.textContent = entry.label || entry.key;
      if (entry.className) btn.className = entry.className;
      mobileSystemActionsEl.appendChild(btn);
    });
  }

  function updateMobileContextHeading() {
    if (!mobileContextTitleEl || !mobileContextSubtitleEl) return;
    mobileContextTitleEl.textContent = MOBILE_MODE_LABELS[mobileActiveMode] || '世界';
    mobileContextSubtitleEl.textContent = formatGameDate();
  }

  function closeMobileRoyalNewsPanel() {
    if (!mobileNewsPanelEl) return;
    if (!mobileNewsPanelEl.classList.contains('visible')) return;
    mobileNewsPanelEl.classList.remove('visible');
    document.body.classList.remove('mobile-news-open');
    removeMobileOverlayEntry('mobile-royal-news');
    if (mobileNewsBodyEl) {
      mobileNewsBodyEl.innerHTML = '';
    }
    updateControlButtons();
  }

  function openMobileRoyalNewsPanel(entries, turn) {
    if (!mobileNewsPanelEl || !entries || !entries.length) return false;
    if (lastRoyalNewsOverlayId) {
      closeStoryOverlay(lastRoyalNewsOverlayId);
      lastRoyalNewsOverlayId = null;
    }
    if (mobileNewsBodyEl) {
      mobileNewsBodyEl.innerHTML = '';
      entries.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'mobile-news-entry';
        const title = document.createElement('div');
        title.style.fontSize = '12px';
        title.style.opacity = '0.7';
        title.textContent = `${formatGameDate(entry.turn)} ${entry.actorName || '王令新聞'}`;
        const body = document.createElement('div');
        body.textContent = entry.summary || '見出しがありません';
        row.appendChild(title);
        row.appendChild(body);
        mobileNewsBodyEl.appendChild(row);
      });
    }
    if (mobileNewsTurnEl) {
      mobileNewsTurnEl.textContent = formatGameDate(turn);
    }
    mobileNewsPanelEl.classList.add('visible');
    document.body.classList.add('mobile-news-open');
    registerMobileOverlayEntry('mobile-royal-news', '王令新聞', closeMobileRoyalNewsPanel);
    timeControl.speed = 0;
    updateControlButtons();
    return true;
  }

  function handleMobileContextAction(entry) {
    if (!entry || mobileInputMode) return;
    runMobileContextAction(entry);
  }

  function runMobileContextAction(entry, bypassConfirm = false) {
    if (!bypassConfirm && entry.confirm && isMobileUIEnabled()) {
      requestMobileConfirm(entry);
      return;
    }
    const handler = entry.handler || (() => {
      if (entry.actionId) triggerHUDButton(entry.actionId);
    });
    handler();
  }

  function requestMobileConfirm(entry) {
    if (!entry) return;
    mobileConfirmAction = entry;
    showMobileInputBar('confirm', {
      message: `${entry.label} を実行しますか？`,
      primaryLabel: '実行',
      secondaryLabel: 'キャンセル',
    });
  }

  function showMobileInputBar(mode, opts = {}) {
    if (!mobileInputBarEl) return;
    const showStoryFields = mode === 'story-name';
    if (mobileStoryInputField) {
      mobileStoryInputField.style.display = showStoryFields ? 'block' : 'none';
    }
    if (mobileStoryGenderSelect) {
      mobileStoryGenderSelect.style.display = showStoryFields ? 'block' : 'none';
    }
    if (mobileInputMessageEl) {
      mobileInputMessageEl.textContent = opts.message || '操作を続けますか？';
    }
    if (mobileInputPrimaryBtn) {
      mobileInputPrimaryBtn.textContent = opts.primaryLabel || 'OK';
    }
    if (mobileInputSecondaryBtn) {
      mobileInputSecondaryBtn.textContent = opts.secondaryLabel || 'キャンセル';
    }
    if (mobileInputNextBtn) {
      mobileInputNextBtn.classList.toggle('visible', !!opts.showNext);
    }
    mobileInputBarEl.classList.add('mobile-input-active');
    mobileInputBarEl.classList.remove('mobile-input-hidden');
    document.body.classList.add('mobile-input-active');
    mobileInputMode = mode;
    if (showStoryFields && mobileStoryInputField) {
      setTimeout(() => mobileStoryInputField.focus(), 150);
    }
  }

  function hideMobileInputBar() {
    if (!mobileInputBarEl) return;
    mobileInputBarEl.classList.remove('mobile-input-active');
    mobileInputBarEl.classList.add('mobile-input-hidden');
    document.body.classList.remove('mobile-input-active');
    mobileConfirmAction = null;
    mobileInputMode = null;
    mobileStorySetupCallback = null;
    if (mobileInputMessageEl) {
      mobileInputMessageEl.textContent = '操作を選択してください。';
    }
  }

  function handleMobileInputPrimary() {
    if (!mobileInputMode) return;
    if (mobileInputMode === 'story-name') {
      const rawName = (mobileStoryInputField?.value || '').trim();
      if (!rawName) {
        if (mobileInputMessageEl) {
          mobileInputMessageEl.textContent = '名前を入力してください。';
        }
        mobileStoryInputField?.focus();
        return;
      }
      player.profile.name = rawName;
      player.profile.gender = mobileStoryGenderSelect?.value || 'undisclosed';
      const playerCandidate = CANDIDATES.find(c => c.id === 'player');
      if (playerCandidate) {
        playerCandidate.name = player.profile.name;
      }
      const callback = mobileStorySetupCallback;
      hideMobileInputBar();
      if (callback) {
        mobileStorySetupCallback = null;
        callback();
      } else {
        startStoryMode();
      }
      return;
    }
    if (mobileInputMode === 'confirm' && mobileConfirmAction) {
      const entry = mobileConfirmAction;
      mobileConfirmAction = null;
      hideMobileInputBar();
      runMobileContextAction(entry, true);
    }
  }

  function handleMobileInputSecondary() {
    if (mobileInputMode === 'story-name') {
      mobileStorySetupCallback = null;
    }
    hideMobileInputBar();
  }

  function handleMobileInputNext() {
    // reserved for future multi-step inputs
  }

  function openMobileStorySetup(options = {}) {
    mobileStorySetupCallback = typeof options.afterSetup === 'function' ? options.afterSetup : null;
    if (mobileStoryInputField) {
      mobileStoryInputField.value = player.profile.name || '';
    }
    if (mobileStoryGenderSelect) {
      mobileStoryGenderSelect.value = player.profile.gender || 'undisclosed';
    }
    showMobileInputBar('story-name', {
      message: '名前と性別を入力してください。',
      primaryLabel: '決定',
      secondaryLabel: 'キャンセル',
    });
  }

  function updateMobileUIVisibility() {
    const enabled = hasTouchSupport && window.innerWidth <= MOBILE_BREAKPOINT;
    document.body.classList.toggle('mobile-ui-enabled', enabled);
    refreshMobileLayout();
    if (!enabled) {
      hideMobileInputBar();
      mobileOverlayHistory.length = 0;
      updateMobileOverlayHeader();
    } else {
      setActiveMobileMode(mobileActiveMode);
    }
    updateOrientationLock();
  }

  function setupInfoMirrors() {
    if (tileInfoEl && mobileInfoMirror) {
      const tileObserver = new MutationObserver(() => {
        mobileInfoMirror.innerHTML = tileInfoEl.innerHTML;
      });
      tileObserver.observe(tileInfoEl, { childList: true, subtree: true, characterData: true });
      mobileInfoMirror.innerHTML = tileInfoEl.innerHTML;
      mobileObservers.push(tileObserver);
    }
    if (hudStatsEl && mobileStatsMirror) {
      const statsObserver = new MutationObserver(() => {
        mobileStatsMirror.innerHTML = hudStatsEl.innerHTML;
      });
      statsObserver.observe(hudStatsEl, { childList: true, subtree: true, characterData: true });
      mobileStatsMirror.innerHTML = hudStatsEl.innerHTML;
      mobileObservers.push(statsObserver);
    }
  }

  function setupMobileUI() {
    if (!hasTouchSupport) return;
    mobileModeButtons.length = 0;
    orientationLockEl = document.getElementById('orientation-lock');
    mobileInfoMirror = document.getElementById('mobile-info-mirror');
    mobileStatsMirror = document.getElementById('mobile-hud-stats-mirror');
    mobileTickerEl = document.getElementById('mobile-news-ticker');
    if (mobileTickerEl) {
      updateMobileNewsTicker();
    }
    mobileContextPanel = document.getElementById('mobile-context-panel');
    mobileContextActionsEl = document.getElementById('mobile-context-actions');
    mobileContextTitleEl = document.getElementById('mobile-context-title');
    mobileContextSubtitleEl = document.getElementById('mobile-context-subtitle');
    mobileSpeedIndicatorEl = document.getElementById('mobile-speed-indicator');
    mobileInputBarEl = document.getElementById('mobile-input-bar');
    mobileInputMessageEl = document.getElementById('mobile-input-message');
    mobileStoryInputField = document.getElementById('mobile-story-input-field');
    mobileStoryGenderSelect = document.getElementById('mobile-story-gender-select');
    mobileInputPrimaryBtn = document.querySelector('[data-mobile-input="primary"]');
    mobileInputSecondaryBtn = document.querySelector('[data-mobile-input="secondary"]');
    mobileInputNextBtn = document.querySelector('[data-mobile-input="next"]');
    mobileModalShell = document.getElementById('mobile-modal-shell');
    mobileModalHeaderEl = document.getElementById('mobile-modal-header');
    mobileModalBackBtn = document.getElementById('mobile-modal-back');
    mobileModalTitleEl = document.getElementById('mobile-modal-title');
    mobileNewsPanelEl = document.getElementById('mobile-news-panel');
    if (mobileNewsPanelEl) {
      mobileNewsBodyEl = mobileNewsPanelEl.querySelector('.mobile-news-body');
      mobileNewsTurnEl = mobileNewsPanelEl.querySelector('#mobile-news-turn');
      mobileNewsPanelEl.querySelectorAll('[data-mobile-news-close]').forEach(btn => {
        btn.addEventListener('click', closeMobileRoyalNewsPanel);
      });
    }
    mobileSystemActionsEl = document.getElementById('mobile-system-actions');
    if (mobileSystemActionsEl) {
      ensureExtraMobileSystemActions();
      mobileSystemActionButtons.clear();
      mobileSystemActionsEl.querySelectorAll('[data-mobile-system]').forEach(btn => {
        btn.addEventListener('click', () => handleTouchAction(btn.dataset.mobileSystem));
        const key = btn.dataset.mobileSystem;
        if (key) {
          mobileSystemActionButtons.set(key, btn);
        }
      });
      refreshMobileSystemActionButtons();
    }
    if (mobileSpeedIndicatorEl) {
      mobileSpeedIndicatorEl.addEventListener('click', () => {
        const current = timeControl.speed;
        const idx = SPEED_ORDER.indexOf(current);
        const next = SPEED_ORDER[(idx + 1) % SPEED_ORDER.length];
        timeControl.speed = next;
        updateControlButtons();
        if (tileInfoEl) {
          tileInfoEl.textContent = `時間速度：${SPEED_LABELS[next] || '1x'}`;
        }
      });
      updateMobileSpeedButton();
    }
    document.querySelectorAll('[data-mobile-mode]').forEach(btn => {
      mobileModeButtons.push(btn);
      btn.addEventListener('click', () => setActiveMobileMode(btn.dataset.mobileMode));
    });
    if (mobileModalBackBtn) {
      mobileModalBackBtn.addEventListener('click', handleMobileOverlayBack);
    }
    if (mobileInputPrimaryBtn) {
      mobileInputPrimaryBtn.addEventListener('click', handleMobileInputPrimary);
    }
    if (mobileInputSecondaryBtn) {
      mobileInputSecondaryBtn.addEventListener('click', handleMobileInputSecondary);
    }
    if (mobileInputNextBtn) {
      mobileInputNextBtn.addEventListener('click', handleMobileInputNext);
    }
    setupInfoMirrors();
    renderMobileContextActions();
    updateMobileContextHeading();
    updateMobileUIVisibility();
    window.addEventListener('resize', updateMobileUIVisibility);
    window.addEventListener('orientationchange', updateMobileUIVisibility);
  }

  function ensureBgmSource() {
    if (!bgmAudio) return;
    if (!bgmAudio.src) {
      if (!bgmBlobUrl) {
        bgmBlobUrl = createDefaultBgmUrl();
      }
      if (bgmBlobUrl) {
        bgmAudio.src = bgmBlobUrl;
      }
      bgmAudio.loop = true;
      bgmAudio.volume = 0.35;
    }
  }

  function createDefaultBgmUrl() {
    const sampleRate = 16000;
    const duration = 4;
    const totalSamples = Math.floor(sampleRate * duration);
    const bytesPerSample = 2;
    const buffer = new ArrayBuffer(44 + totalSamples * bytesPerSample);
    const view = new DataView(buffer);
    const writer = new Uint8Array(buffer);
    const writeString = (offset, str) => {
      for (let i = 0; i < str.length; i++) writer[offset + i] = str.charCodeAt(i);
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + totalSamples * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, totalSamples * bytesPerSample, true);
    const freqs = [196, 233, 262, 311];
    for (let i = 0; i < totalSamples; i++) {
      const segment = Math.floor((i / totalSamples) * freqs.length);
      const freq = freqs[segment % freqs.length];
      const t = i / sampleRate;
      const envelope = 0.55 + 0.35 * Math.sin(t * 0.7);
      const sample =
        Math.sin(2 * Math.PI * freq * t) * 6500 * envelope +
        Math.sin(2 * Math.PI * (freq / 2) * t) * 2200 * envelope;
      view.setInt16(44 + i * bytesPerSample, Math.max(-32767, Math.min(32767, sample)), true);
    }
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  }

  function promptBgmPermissionIfNeeded(options = {}) {
    const force = !!options.force;
    if (bgmPermissionState === 'granted' && !force) return true;
    if (!force && bgmPermissionState === 'denied') return false;
    const ok = window.confirm('タイトル画面でBGMを自動再生してもよいですか？');
    bgmPermissionState = ok ? 'granted' : 'denied';
    if (ok) {
      bgmUserEnabled = true;
      ensureBgmSource();
      setTitleStatus('BGMを自動再生します（タイトル画面のみ）');
    } else {
      bgmUserEnabled = false;
      setTitleStatus('BGMはボタンからいつでも再生できます');
    }
    updateBgmControls();
    updateBGMState();
    return ok;
  }

  function updateBgmControls() {
    if (!bgmToggleBtn) return;
    if (bgmPermissionState !== 'granted') {
      bgmToggleBtn.textContent = 'BGM 再生';
    } else {
      bgmToggleBtn.textContent = bgmUserEnabled ? 'BGM 停止' : 'BGM 再生';
    }
  }

  function toggleBGM() {
    if (!bgmAudio) return;
    if (bgmPermissionState !== 'granted') {
      const ok = promptBgmPermissionIfNeeded({ force:true, viaButton:true });
      if (!ok) return;
    } else {
      bgmUserEnabled = !bgmUserEnabled;
    }
    updateBgmControls();
    updateBGMState();
  }

  function updateBGMState() {
    if (!bgmAudio) return;
    if (bgmPermissionState !== 'granted') {
      if (!bgmAudio.paused) bgmAudio.pause();
      return;
    }
    ensureBgmSource();
    if (appState === 'title' && bgmUserEnabled) {
      bgmAudio.play().catch(()=>{});
    } else if (!bgmAudio.paused) {
      bgmAudio.pause();
    }
  }

  function showConfirmOverlay() {
    if (!confirmOverlay) return;
    confirmOverlay.style.display = 'flex';
  }

  function hideConfirmOverlay() {
    if (!confirmOverlay) return;
    confirmOverlay.style.display = 'none';
  }

  function showGameOver() {
    if (!gameOverOverlay) return;
    gameOverOverlay.style.display = 'flex';
  }

  function hideGameOver() {
    if (!gameOverOverlay) return;
    gameOverOverlay.style.display = 'none';
  }

  function showCityListOverlay() {
    if (!cityListOverlay || appState !== 'map' || !worldReady) return;
    populateCityList();
    cityListOverlay.style.display = 'flex';
    cityListVisible = true;
    updateControlButtons();
    registerMobileOverlayEntry('mobile-city-list', '都市一覧', hideCityListOverlay);
  }

  function hideCityListOverlay() {
    if (!cityListOverlay) return;
    cityListOverlay.style.display = 'none';
    cityListVisible = false;
    updateControlButtons();
    removeMobileOverlayEntry('mobile-city-list');
  }

  function openCityRenameOverlay() {
    if (appState !== 'map' || !worldReady || !storyOverlayRoot) return;
    const overlayId = 'city-rename-overlay';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const availableCities = cities.filter(city => city && typeof city.id !== 'undefined');
    if (!availableCities.length) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const description = document.createElement('div');
    description.textContent = '改名したい都市を選び、新しい名称を入力してから「改名」を押してください。';
    description.style.fontSize = '12px';
    description.style.opacity = '0.7';
    container.appendChild(description);
    const select = document.createElement('select');
    select.style.padding = '8px';
    select.style.borderRadius = '8px';
    select.style.border = '1px solid rgba(0,0,0,0.15)';
    availableCities.forEach(city => {
      const option = document.createElement('option');
      option.value = String(city.id);
      option.textContent = city.name || `都市${city.id}`;
      select.appendChild(option);
    });
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = '新しい都市名';
    nameInput.value = availableCities[0].name || '';
    nameInput.style.padding = '8px';
    nameInput.style.borderRadius = '8px';
    nameInput.style.border = '1px solid rgba(0,0,0,0.15)';
    function syncInput() {
      const cityId = select.value;
      const city = cities.find(c => String(c.id) === cityId);
      if (city) {
        nameInput.value = city.name || '';
      }
    }
    select.addEventListener('change', syncInput);
    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'btn';
    renameBtn.textContent = '改名';
    renameBtn.addEventListener('click', () => {
      const cityId = select.value;
      const city = cities.find(c => String(c.id) === cityId);
      if (!city) return;
      const newName = (nameInput.value || '').trim();
      if (!newName) {
        if (tileInfoEl) {
          tileInfoEl.textContent = '名前を入力してください。';
        }
        nameInput.focus();
        return;
      }
      const oldName = city.name || `都市${city.id}`;
      city.name = newName;
      markWorldDirty();
      updateHudStats();
      if (tileInfoEl) {
        tileInfoEl.textContent = `${oldName} を ${newName} に改名しました。`;
      }
      const option = select.options[select.selectedIndex];
      if (option) option.textContent = newName;
      closeStoryOverlay(overlayId);
    });
    container.appendChild(select);
    container.appendChild(nameInput);
    container.appendChild(renameBtn);
    showStoryOverlay({
      id: overlayId,
      title: '都市改名',
      body: container,
      buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
      mobileTitle: '都市改名',
    });
  }

  function openMilitaryCompositionOverlay() {
    if (appState !== 'map' || !worldReady || !storyOverlayRoot) return;
    const overlayId = 'military-organization';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';

    const outline = document.createElement('div');
    outline.textContent = '国土を守る部隊を配備し、地方の師団を編成してください。';
    outline.style.fontSize = '12px';
    outline.style.opacity = '0.8';
    container.appendChild(outline);

    function createCityRow(city) {
      if (!city) return null;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '6px 8px';
      row.style.borderRadius = '6px';
      row.style.background = 'rgba(255,255,255,0.04)';
      row.style.flexWrap = 'wrap';
      row.style.gap = '6px';

      const cityLabel = document.createElement('div');
      cityLabel.style.fontSize = '12px';
      cityLabel.style.fontWeight = '600';
      const cityName = city.name || `都市${city.id}`;
      const regionName = getRegionLabel(getCityRegionIndex(city));
      cityLabel.textContent = `${cityName}（${regionName}）`;
      row.appendChild(cityLabel);

      const controlWrap = document.createElement('div');
      controlWrap.style.display = 'flex';
      controlWrap.style.alignItems = 'center';
      controlWrap.style.gap = '6px';

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = String(MAX_CITY_DEFENSE_CORPS);
      input.step = '5';
      input.value = getCityDefenseCorps(city.id);
      input.style.width = '80px';
      input.style.padding = '4px 6px';
      input.style.borderRadius = '4px';
      input.style.border = '1px solid rgba(255,255,255,0.25)';
      input.style.background = '#0b111f';
      input.style.color = '#f5f5f5';
      controlWrap.appendChild(input);

      const inputLabel = document.createElement('span');
      inputLabel.style.fontSize = '11px';
      inputLabel.style.opacity = '0.7';
      inputLabel.textContent = '防衛団数';
      controlWrap.appendChild(inputLabel);

      function syncCityDefense() {
        const requested = Number(input.value);
        const next = clamp(Math.round(requested || 0), 0, MAX_CITY_DEFENSE_CORPS);
        input.value = next;
        setCityDefenseCorps(city.id, next);
        updateHudStats();
        if (tileInfoEl) {
          tileInfoEl.textContent = `${cityName} の防衛団を ${next} に配置しました。`;
        }
      }
      input.addEventListener('change', syncCityDefense);

      row.appendChild(controlWrap);
      return row;
    }

    const citySection = document.createElement('div');
    citySection.style.display = 'flex';
    citySection.style.flexDirection = 'column';
    citySection.style.gap = '8px';
    citySection.style.border = '1px solid rgba(255,255,255,0.08)';
    citySection.style.borderRadius = '10px';
    citySection.style.padding = '10px';
    const cityTitle = document.createElement('strong');
    cityTitle.textContent = '都市の防衛団';
    citySection.appendChild(cityTitle);
    const cityList = document.createElement('div');
    cityList.style.display = 'flex';
    cityList.style.flexDirection = 'column';
    cityList.style.gap = '6px';
    cityList.style.maxHeight = '260px';
    cityList.style.overflowY = 'auto';
    const availableCities = cities.filter(city => city && typeof city.id !== 'undefined');
    const sortedCities = [...availableCities].sort((a, b) => {
      const nameA = (a.name || '');
      const nameB = (b.name || '');
      if (nameA === nameB) return (a.id || 0) - (b.id || 0);
      return nameA.localeCompare(nameB);
    });
    if (!sortedCities.length) {
      const empty = document.createElement('div');
      empty.textContent = '都市がまだありません';
      empty.style.fontSize = '12px';
      empty.style.opacity = '0.6';
      cityList.appendChild(empty);
    } else {
      sortedCities.forEach(city => {
        const row = createCityRow(city);
        if (row) cityList.appendChild(row);
      });
    }
    citySection.appendChild(cityList);
    container.appendChild(citySection);

    const regionSection = document.createElement('div');
    regionSection.style.display = 'flex';
    regionSection.style.flexDirection = 'column';
    regionSection.style.gap = '8px';
    regionSection.style.border = '1px solid rgba(255,255,255,0.08)';
    regionSection.style.borderRadius = '10px';
    regionSection.style.padding = '10px';
    const regionTitle = document.createElement('strong');
    regionTitle.textContent = '地方師団';
    regionSection.appendChild(regionTitle);
    const regionList = document.createElement('div');
    regionList.style.display = 'flex';
    regionList.style.flexDirection = 'column';
    regionList.style.gap = '6px';

    for (let idx = 0; idx < Math.max(1, REGION_NAMES.length); idx++) {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '6px 8px';
      row.style.borderRadius = '6px';
      row.style.background = 'rgba(255,255,255,0.03)';
      row.style.gap = '8px';

      const label = document.createElement('div');
      label.style.fontSize = '12px';
      label.textContent = `${getRegionLabel(idx)} 師団`;
      row.appendChild(label);

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = String(MAX_REGION_DIVISIONS);
      input.step = '1';
      input.value = getRegionDivisions(idx);
      input.style.width = '66px';
      input.style.padding = '4px 6px';
      input.style.borderRadius = '4px';
      input.style.border = '1px solid rgba(255,255,255,0.25)';
      input.style.background = '#0b111f';
      input.style.color = '#f5f5f5';
      function syncRegion() {
        const requested = Number(input.value);
        const next = clamp(Math.round(requested || 0), 0, MAX_REGION_DIVISIONS);
        input.value = next;
        setRegionDivisions(idx, next);
        updateHudStats();
        if (tileInfoEl) {
          tileInfoEl.textContent = `${getRegionLabel(idx)} に ${next} 師団を据えました`;
        }
      }
      input.addEventListener('change', syncRegion);
      row.appendChild(input);
      const note = document.createElement('span');
      note.style.fontSize = '11px';
      note.style.opacity = '0.7';
      note.textContent = '防衛/展開力';
      row.appendChild(note);
      regionList.appendChild(row);
    }

    regionSection.appendChild(regionList);
    container.appendChild(regionSection);

    showStoryOverlay({
      id: overlayId,
      title: '軍備編成',
      body: container,
      buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
      mobileTitle: '軍備編成',
      width: Math.min(520, window.innerWidth - 40),
    });
  }

  function applyPopulationPlan(planId, cityId) {
    const plan = POPULATION_PLANS.find(entry => entry && entry.id === planId);
    const target = cities.find(city => city && city.id === cityId);
    if (!plan || !target) return false;
    const cityName = target.name || `都市${target.id}`;
    const boost = Math.max(0, Math.round(plan.popBoost || 0));
    target.pop = Math.round((target.pop || 0) + boost);
    target.pop = Math.max(target.pop, 150);
    target.stability = clamp((target.stability || 50) + (plan.stability || 0), 0, 120);
    target.prosperity = clamp((target.prosperity || 1) + (plan.prosperity || 0), 0.2, 12);
    if (typeof plan.military === 'number' && plan.military !== 0) {
      target.military = clamp((target.military || 60) + plan.military, 20, 360);
    }
    const template = plan.summary || `${plan.label} で {city} を急伸させた。`;
    const summary = template.replace('{city}', cityName);
    if (isStoryMode) {
      publishStoryNews(summary);
      recordStoryAction('royal-newspaper', 'population_plan', {
        cityId,
        storyLabel: summary,
      });
    }
    markWorldDirty();
    updateHudStats();
    render();
    if (tileInfoEl) {
      tileInfoEl.textContent = `${plan.label}を${cityName}で実行しました。`;
    }
    return true;
  }

  function openPopulationPlanOverlay() {
    if (!storyOverlayRoot || !worldReady || appState !== 'map') return;
    if (roles.player !== 'king') {
      if (tileInfoEl) {
        tileInfoEl.textContent = '王でないと人口増加計画を実行できません。';
      }
      return;
    }
    const overlayId = 'population-plan';
    if (overlayStack.find(entry => entry.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const guide = document.createElement('div');
    guide.style.fontSize = '12px';
    guide.style.opacity = '0.8';
    guide.textContent = '都市を選び、移民や魔族との共生計画を選択すると人口と繁栄が一気に上昇します。';
    container.appendChild(guide);
    const availableCities = cities.filter(city => city && Number.isFinite(city.id));
    const citySelect = document.createElement('select');
    citySelect.style.width = '100%';
    citySelect.style.padding = '6px';
    citySelect.style.borderRadius = '6px';
    citySelect.style.border = '1px solid rgba(255,255,255,0.2)';
    citySelect.style.background = '#0b111f';
    citySelect.style.color = '#f5f5f5';
    if (!availableCities.length) {
      const empty = document.createElement('div');
      empty.style.fontSize = '11px';
      empty.style.opacity = '0.6';
      empty.textContent = '都市が存在しないため計画できません。';
      container.appendChild(empty);
    } else {
      availableCities.forEach(city => {
        const option = document.createElement('option');
        option.value = city.id;
        const label = city.name || `都市${city.id}`;
        const popLabel = city.pop ? `（人口約${Math.round(city.pop)}）` : '';
        option.textContent = `${label}${popLabel}`;
        citySelect.appendChild(option);
      });
      container.appendChild(citySelect);
    }
    const plansColumn = document.createElement('div');
    plansColumn.style.display = 'flex';
    plansColumn.style.flexDirection = 'column';
    plansColumn.style.gap = '8px';
    POPULATION_PLANS.forEach(plan => {
      const card = document.createElement('div');
      card.style.border = '1px solid rgba(255,255,255,0.12)';
      card.style.borderRadius = '8px';
      card.style.padding = '10px';
      card.style.background = 'rgba(255,255,255,0.02)';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '6px';
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'baseline';
      const label = document.createElement('strong');
      label.textContent = plan.label;
      label.style.fontSize = '14px';
      header.appendChild(label);
      const popInfo = document.createElement('span');
      popInfo.style.fontSize = '11px';
      popInfo.style.opacity = '0.7';
      popInfo.textContent = `人口+${plan.popBoost || 0}`;
      header.appendChild(popInfo);
      card.appendChild(header);
      const desc = document.createElement('div');
      desc.style.fontSize = '12px';
      desc.style.color = '#d8dee9';
      desc.textContent = plan.description || '';
      card.appendChild(desc);
      const stats = document.createElement('div');
      stats.style.fontSize = '11px';
      stats.style.opacity = '0.7';
      const statParts = [];
      if (typeof plan.stability === 'number') {
        statParts.push(`安定度${plan.stability >= 0 ? '+' : ''}${plan.stability}`);
      }
      if (typeof plan.prosperity === 'number') {
        statParts.push(`繁栄+${plan.prosperity}`);
      }
      if (typeof plan.military === 'number') {
        statParts.push(`軍力+${plan.military}`);
      }
      stats.textContent = statParts.join(' / ');
      card.appendChild(stats);
      const buttonRow = document.createElement('div');
      buttonRow.style.display = 'flex';
      buttonRow.style.justifyContent = 'flex-end';
      const execBtn = document.createElement('button');
      execBtn.className = 'btn';
      execBtn.textContent = '実行する';
      execBtn.addEventListener('click', () => {
        if (!availableCities.length) {
          if (tileInfoEl) {
            tileInfoEl.textContent = '都市がないため計画を実行できません。';
          }
          return;
        }
        const selectedId = Number(citySelect.value);
        if (!Number.isFinite(selectedId)) {
          if (tileInfoEl) {
            tileInfoEl.textContent = '都市を選択してください。';
          }
          return;
        }
        const applied = applyPopulationPlan(plan.id, selectedId);
        if (!applied && tileInfoEl) {
          tileInfoEl.textContent = '計画の実行に失敗しました。';
        }
      });
      buttonRow.appendChild(execBtn);
      card.appendChild(buttonRow);
      plansColumn.appendChild(card);
    });
    container.appendChild(plansColumn);
    showStoryOverlay({
      id: overlayId,
      title: '人口増加計画',
      body: container,
      modal: true,
      buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
      width: Math.min(520, window.innerWidth - 40),
    });
  }

  function triggerStoryEndRoll() {
    const state = ensureStoryScenarioState();
    if (!state || !state.storyEndReady || state.storyEndInvoked) return;
    state.storyEndInvoked = true;
    timeControl.speed = 0;
    updateControlButtons();
    const overlayId = 'story-end-roll';
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    container.style.minWidth = '280px';
    const lines = [
      '王都は静寂を取り戻し、王令新聞が最後の号外を掲げた。',
      '防衛団と師団は任を終え、内戦と侵攻の火種は鎮まりつつある。',
      'あなたは一度きりの譲位を決意し、民へ次の世代を託す。',
    ];
    lines.forEach(text => {
      const p = document.createElement('p');
      p.textContent = text;
      container.appendChild(p);
    });
    const credit = document.createElement('div');
    credit.className = 'story-end-credit';
    credit.textContent = 'Script:Codex Project:dotfun';
    credit.style.marginTop = '10px';
    credit.style.fontSize = '12px';
    credit.style.opacity = '0.8';
    container.appendChild(credit);
    showStoryOverlay({
      id: overlayId,
      title: '王都の終章',
      body: container,
      modal: true,
      center: true,
      animate: true,
      buttons: [{ label: '閉じる', action: () => closeStoryOverlay(overlayId) }],
      width: Math.min(520, window.innerWidth - 40),
    });
    if (tileInfoEl) {
      tileInfoEl.textContent = '「Script:Codex Project:dotfun」— 物語は終わりを迎えました。';
    }
    const summary = '王令新聞「譲位の終章」ストーリーが幕を閉じる。';
    publishStoryNews(summary);
    recordStoryAction('player', 'story_end_roll', {
      actorName: '王令新聞',
      storyLabel: summary,
    });
  }

  function handleStoryEndRequest() {
    if (!isStoryMode) {
      if (tileInfoEl) tileInfoEl.textContent = 'ストーリーモードでのみ譲ることができます。';
      return;
    }
    const state = ensureStoryScenarioState();
    if (!state || !state.storyEndReady) {
      if (tileInfoEl) tileInfoEl.textContent = '王令新聞が譲位を促すまで、譲ることはできません。';
      return;
    }
    if (state.storyEndInvoked) {
      if (tileInfoEl) tileInfoEl.textContent = 'ストーリーは既に終了しています。';
      return;
    }
    triggerStoryEndRoll();
  }

  function performAbdication(targetId, overlayId) {
    if (roles.player !== 'king') {
      if (tileInfoEl) tileInfoEl.textContent = '王位を譲れるのは現王だけです。';
      return;
    }
    if (!targetId || targetId === 'player') return;
    const targetCharacter = getCandidateName(targetId);
    const targetRole = roles[targetId] || 'advisor';
    roles[targetId] = 'king';
    roles.player = targetRole;
    ['player','marshal','princess','council'].forEach(id => {
      if (characters[id]) {
        characters[id].role = roles[id] || null;
      }
    });
    adjustGlobalTrust(targetId, 100);
    initKingAI(targetId, 1);
    markWorldDirty();
    updateControlButtons();
    closeStoryOverlay(overlayId);
    showStoryOverlay({
      title: '王位譲渡完了',
      body: `${targetCharacter} が新王に就きました。あなたは ${roleLabel(roles.player)} となりました。`,
      buttons: [],
      mobileTitle: '王位譲渡完了',
    });
  }

  function openAbdicationOverlay() {
    if (appState !== 'map' || !worldReady || !storyOverlayRoot) return;
    const overlayId = 'abdication-overlay';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const description = document.createElement('div');
    description.textContent = '王位をNPCに譲り、自らはその役職を引き継ぎます。忠誠心の高い新王はあなたに信頼を寄せます。';
    description.style.fontSize = '12px';
    description.style.opacity = '0.7';
    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '8px';
    const candidates = ['marshal', 'princess', 'council'];
    candidates.forEach(id => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.background = 'rgba(255,255,255,0.04)';
      row.style.border = '1px solid rgba(255,255,255,0.1)';
      row.style.borderRadius = '8px';
      row.style.padding = '6px 10px';
      const name = document.createElement('div');
      name.style.flex = '1';
      name.style.fontSize = '13px';
      const charName = getCandidateName(id);
      const currentRole = roleLabel(roles[id]) || '役職未定';
      name.innerHTML = `<strong>${charName}</strong><br><span style="font-size:11px; opacity:0.7;">${currentRole}</span>`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.textContent = '譲る';
      button.addEventListener('click', () => performAbdication(id, overlayId));
      row.appendChild(name);
      row.appendChild(button);
      list.appendChild(row);
    });
    container.appendChild(description);
    container.appendChild(list);
    showStoryOverlay({
      id: overlayId,
      title: '王位譲渡',
      body: container,
      buttons: [],
      mobileTitle: '王位譲渡',
    });
  }


  function handleSpacePause(event) {
    if (event.code !== 'Space') return;
    if (event.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (appState !== 'map') return;
    if (timeControl.speed === 0) return;
    event.preventDefault();
    timeControl.speed = 0;
    updateControlButtons();
    if (tileInfoEl) {
      tileInfoEl.textContent = '時間を停止しました（スペースキー）';
    }
  }
  window.addEventListener('keydown', handleSpacePause);

  function populateCityList() {
    if (!cityListContainer) return;
    cityListContainer.innerHTML = '';
    if (!cities.length) {
      cityListContainer.textContent = '都市が見つかりません';
      return;
    }
    const sorted = [...cities].sort((a, b) => {
      const pa = CITY_LIST_PRIORITY[a.kind] || 0;
      const pb = CITY_LIST_PRIORITY[b.kind] || 0;
      if (pa !== pb) return pb - pa;
      return Math.round(b.pop) - Math.round(a.pop);
    });
    const fragment = document.createDocumentFragment();
    for (const city of sorted) {
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'city-list-entry';
      entry.dataset.cityId = city.id;
      const name = city.name || CITY_LABEL[city.kind] || city.kind || '都市';
      const kindLabel = CITY_LABEL[city.kind] || city.kind || '都市';
      entry.innerHTML = `<strong>${name}</strong><span>${kindLabel} / (${city.x}, ${city.y}) / ${Math.round(city.pop)}人</span>`;
      fragment.appendChild(entry);
    }
    cityListContainer.appendChild(fragment);
  }

  function handleCityListSelection(event) {
    if (!cityListContainer) return;
    const button = event.target.closest('[data-city-id]');
    if (!button || !cityListContainer.contains(button)) return;
    const id = Number(button.dataset.cityId);
    const city = cities.find(c => c.id === id);
    if (!city) return;
    selectedTile = { x: city.x, y: city.y };
    const tile = map[city.y] && map[city.y][city.x];
    updateTileInfo({ x: city.x, y: city.y, tile });
    focusOnCity(city);
    hideCityListOverlay();
  }

  function focusOnCity(city) {
    if (!canvas.width || !canvas.height) return;
    const safeX = clamp(city.x, 0, W - 1);
    const safeY = clamp(city.y, 0, H - 1);
    if (is2DMode) {
      const size = tileSize2D();
      ox = canvas.width / 2 - (safeX + 0.5) * size;
      oy = canvas.height / 2 - (safeY + 0.5) * size;
    } else {
      const tile = map[safeY] && map[safeY][safeX];
      const height = tile ? tile.h : 0;
      ox = canvas.width / 2 - (safeX - safeY) * (tileW / 2);
      oy = canvas.height / 2 + height * zStep - (safeX + safeY) * (tileH / 2);
    }
    render();
  }

  function completeReturnToTitle() {
    isStoryMode = false;
    appState = 'title';
    pendingCapitalSelection = false;
    pendingDevelopment = false;
    pendingRoadMode = false;
    dragging = false;
    selectedTile = null;
    lastTileInfo = null;
    updateTileInfo(null);
    updateUIState();
    hideGameOver();
    setTitleStatus('タイトル画面に戻りました');
    updateBGMState();
    hideCityListOverlay();
    // ストーリー用オーバーレイはタイトルに戻った時点で閉じる
    if (storyOverlayRoot) {
      overlayStack.splice(0, overlayStack.length);
      while (storyOverlayRoot.firstChild) {
        storyOverlayRoot.removeChild(storyOverlayRoot.firstChild);
      }
    }
    render();
  }

  function markMapDirty() {
    worldDirty = true;
    chunkRefreshNeeded = true;
  }

  function markWorldDirty() {
    markMapDirty();
  }

  function updateUIState() {
    if (hudEl) hudEl.style.display = appState === 'map' ? 'flex' : 'none';
    if (titleContainer) titleContainer.style.display = appState === 'title' ? 'flex' : 'none';
    if (titleStatusEl && appState === 'map') titleStatusEl.textContent = '';
    updateHudStats();
    if (skipMonthlyNewsAfterLoad) {
      skipMonthlyNewsAfterLoad = false;
    } else {
      maybeShowMonthlyNewspaper();
    }
    updateBgmControls();
    updateBGMState();
    if (document && document.body) {
      document.body.classList.toggle('title-active', appState === 'title');
    }
  }

  function setTitleStatus(message) {
    if (titleStatusEl) titleStatusEl.textContent = message || '';
  }

  function drawTitleScreen() {
    if (worldReady) {
      renderMapLayer(titleModeCurrent, { clearLayer:true, alpha:1 - titleBlend });
      renderMapLayer(titleModeNext, { clearLayer:false, alpha:titleBlend });
    } else {
      clear();
    }
    ctx.fillStyle = 'rgba(7,9,12,0.35)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  function render() {
    if (appState === 'title') {
      drawTitleScreen();
    } else if (appState === 'map') {
      draw();
    } else {
      drawTitleScreen();
    }
  }

  function switchToMap(message) {
    appState = 'map';
    updateUIState();
    if (message && tileInfoEl) tileInfoEl.textContent = message;
    pendingCapitalSelection = false;
    pendingDevelopment = false;
    render();
  }

  function updateTitleAnimation(timestamp) {
    if (appState !== 'title') {
      lastTitleTick = timestamp;
      return;
    }
    if (!lastTitleTick) lastTitleTick = timestamp;
    const delta = timestamp - lastTitleTick;
    lastTitleTick = timestamp;
    titleBlend += delta / TITLE_FADE_MS;
    if (titleBlend >= 1) {
      titleBlend = 0;
      titleModeCurrent = titleModeNext;
      titleModeNext = !titleModeNext;
    }
  }

  function simulationLoop(timestamp) {
  if (appState === 'map' && timeControl.speed > 0) {
      if (isStoryMode && successionTurnPlanned != null && currentTurn < successionTurnPlanned && timeControl.speed > 1) {
        timeControl.speed = 1;
        updateControlButtons();
      }
        if (!timeControl.lastTick) {
            timeControl.lastTick = timestamp;
        }
        const delta = timestamp - timeControl.lastTick;
        const currentInterval = timeControl.interval / timeControl.speed;

        if (delta >= currentInterval) {
            timeControl.lastTick = timestamp - (delta % currentInterval);
            simulateOneTurn();
            if (lastTileInfo) {
              updateTileInfo({ x:lastTileInfo.x, y:lastTileInfo.y });
            }
            render();
        }
    } else {
      timeControl.lastTick = 0;
    }
    requestAnimationFrame(simulationLoop);
  }

  function animationLoop(timestamp) {
    updateTitleAnimation(timestamp);
    if (appState === 'title') {
      render();
    }
    requestAnimationFrame(animationLoop);
  }

  function cloneCityForSave(city) {
    if (!city) return null;
    return {
      id: city.id,
      kind: city.kind,
      x: city.x,
      y: city.y,
      pop: city.pop,
      food: city.food,
      prod: city.prod,
      wealth: city.wealth,
      defense: city.defense,
      slots: Array.isArray(city.slots) ? [...city.slots] : [],
      level: city.level,
      civCore: city.civCore,
      name: city.name,
      megacity: !!city.megacity,
      relations: Array.isArray(city.relations) ? city.relations.map(r => r ? ({ id: r.id, type: r.type, strength: r.strength }) : null).filter(Boolean) : [],
      stability: city.stability,
      prosperity: city.prosperity,
      military: city.military,
      lastDelta: city.lastDelta || 0,
      isCapital: city.kind === CITY.CAPITAL
    };
  }

  function serializeWorld() {
    const tiles = [];
    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const t = map[y][x];
        tiles.push({
          x,
          y,
          height: t.h,
          terrainType: t.base,
          water: {
            hasWater: isWaterBase(t.base) || !!t.river,
            river: !!t.river,
            width: t.riverWidth || 0,
            dirs: t.riverDirs ? [...t.riverDirs] : []
          },
          road: t.road ? 1 : 0,
          manualRoad: !!t.manualRoad,
          civilization: t.civ,
          cityId: t.owner,
          cityType: t.city,
          farmland: t.farmland,
          snow: !!t.snow,
          nodeId: t.nodeId
        });
      }
    }
    const worldStateSnapshot = snapshotWorldState();
    return {
      version: 1,
      seed: currentSeed,
      width: W,
      height: H,
      savedAt: Date.now(),
      map: {
        width: W,
        height: H,
        tiles,
      },
      cities: cities.map(cloneCityForSave).filter(Boolean),
      camera: {
        ox,
        oy,
        tileW,
        tileH,
        zStep,
        is2DMode,
      },
      funds: globalFunds,
      worldState: worldStateSnapshot,
        story: {
          isStoryMode: isStoryMode,
          playerProfile: {
            name: player.profile.name,
            gender: player.profile.gender,
          },
        turn: currentTurn,
        successionTurnPlanned,
        characters: characters ? JSON.parse(JSON.stringify(characters)) : null,
        successionResult,
        roles: {
          player: roles.player,
          marshal: roles.marshal,
          princess: roles.princess,
          council: roles.council,
        },
          flags: { ...storyFlags },
          storyScenario: storyScenarioState ? { ...storyScenarioState } : null,
          journal: storyActionTimeline.slice(-STORY_TIMELINE_LIMIT),
        aiLog: aiActionLog.slice(0, AI_LOG_LIMIT).map(entry => ({
          turn: entry.turn,
          text: entry.text,
          timestamp: entry.timestamp,
        })),
        lastNewspaperTurn: lastMonthlyNewspaperTurn,
        monthlyNews: monthlyNewspapers.slice(0, MONTHLY_ARCHIVE_LIMIT).map(issue => ({
          turn: issue.turn,
          entries: Array.isArray(issue.entries) ? issue.entries.map(entry => ({
            actorName: entry.actorName,
            summary: entry.summary,
            actionId: entry.actionId || '',
          })) : [],
          createdAt: issue.createdAt,
        })),
      },
    };
  }

  // --- JSON エクスポート / インポート（PWA向け） ---
  let jsonFileInput = null;
  let jsonImportContext = 'map'; // 'title' | 'map'

  function exportWorldAsJson() {
    if (!worldReady || appState !== 'map') {
      tileInfoEl.textContent = 'マップ表示中のみJSON保存できます';
      return false;
    }
    try {
      const payload = serializeWorld();
      const json = JSON.stringify(payload);
      const blob = new Blob([json], { type:'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `railTrail_save_${ts}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      tileInfoEl.textContent = 'JSONファイルとして保存しました';
      return true;
    } catch (err) {
      console.error('json export failed', err);
      tileInfoEl.textContent = 'JSON保存に失敗しました';
      return false;
    }
  }

  function ensureJsonFileInput() {
    if (jsonFileInput) return jsonFileInput;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.style.display = 'none';
    input.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result || '');
            const data = JSON.parse(text);
          applyLoadedWorld(data);
          if (jsonImportContext === 'title') {
            switchToMap('JSONセーブデータを読み込みました');
          } else {
            tileInfoEl.textContent = 'JSONセーブデータを読み込みました';
            render();
          }
        } catch (err) {
          console.error('json import failed', err);
          if (jsonImportContext === 'title') {
            setTitleStatus('JSONデータの読み込みに失敗しました');
          } else {
            tileInfoEl.textContent = 'JSONデータの読み込みに失敗しました';
          }
        } finally {
          event.target.value = '';
          jsonImportContext = 'map';
        }
      };
      reader.onerror = () => {
        console.error('file read failed', reader.error);
        if (jsonImportContext === 'title') {
          setTitleStatus('ファイルの読み込みに失敗しました');
        } else {
          tileInfoEl.textContent = 'ファイルの読み込みに失敗しました';
        }
        event.target.value = '';
        jsonImportContext = 'map';
      };
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    jsonFileInput = input;
    return input;
  }

  function importWorldFromJson(context='map') {
    jsonImportContext = context === 'title' ? 'title' : 'map';
    const input = ensureJsonFileInput();
    // 連続読み込みできるように毎回 value をリセットしておく
    input.value = '';
    input.click();
  }

  function normalizeSlotIndex(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return clamp(Math.floor(value), 1, SAVE_SLOT_COUNT);
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return clamp(Math.floor(parsed), 1, SAVE_SLOT_COUNT);
      }
      if (value.startsWith(SAVE_KEY_PREFIX)) {
        const suffix = Number(value.slice(SAVE_KEY_PREFIX.length));
        if (Number.isFinite(suffix)) return clamp(Math.floor(suffix), 1, SAVE_SLOT_COUNT);
      }
    }
    return DEFAULT_SAVE_SLOT;
  }

  function getSlotKey(slotIndex) {
    const idx = normalizeSlotIndex(slotIndex);
    return `${SAVE_KEY_PREFIX}${idx}`;
  }

  function formatSlotTimestamp(value) {
    if (!value) return '未保存';
    try {
      const date = new Date(value);
      return date.toLocaleString('ja-JP');
    } catch {
      return '不明';
    }
  }

  function readSlotInfo(slotIndex) {
    if (typeof localStorage === 'undefined') return { exists:false };
    const key = getSlotKey(slotIndex);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { exists:false };
      const data = JSON.parse(raw);
      return {
        exists: true,
        slotIndex: normalizeSlotIndex(slotIndex),
        savedAt: data.savedAt,
        seed: data.seed,
        mapVersion: data.version,
      };
    } catch (err) {
      console.error('slot metadata failure', err);
      return { exists:false };
    }
  }

  function hasAnySavedSlot() {
    if (typeof localStorage === 'undefined') return false;
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
      if (readSlotInfo(i).exists) return true;
    }
    return false;
  }

  function setLastSaveSlotIndex(slotIndex) {
    if (typeof localStorage === 'undefined') return;
    const idx = normalizeSlotIndex(slotIndex);
    localStorage.setItem(LAST_SAVE_SLOT_KEY, String(idx));
  }

  function getLastSaveSlotIndex() {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LAST_SAVE_SLOT_KEY);
    if (raw) {
      const idx = Number(raw);
      if (Number.isFinite(idx) && idx >= 1 && idx <= SAVE_SLOT_COUNT) {
        const info = readSlotInfo(idx);
        if (info.exists) return idx;
      }
    }
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
      if (readSlotInfo(i).exists) return i;
    }
    return null;
  }

  // PWA 向けに保存容量を意識したセーブ関数（古いセーブを自動的に整理しつつ再試行）
  function saveWorldToSlot(slotIndex=DEFAULT_SAVE_SLOT) {
    if (appState !== 'map' || !worldReady) {
      tileInfoEl.textContent = 'ゲーム中のみ保存できます';
      return false;
    }
    if (typeof localStorage === 'undefined') {
      tileInfoEl.textContent = 'この環境では保存機能が利用できません';
      return false;
    }
    const idx = normalizeSlotIndex(slotIndex);
    const key = getSlotKey(idx);
    const payload = serializeWorld();
    const json = JSON.stringify(payload);

    function tryWrite() {
      localStorage.setItem(key, json);
      setLastSaveSlotIndex(idx);
      tileInfoEl.textContent = `セーブスロット${idx}に保存しました`;
      worldDirty = false;
        return true;
    }

    try {
      return tryWrite();
    } catch (err) {
      console.error('save failed', err);
      // 容量不足時は他のスロットを削除してから一度だけ再試行
      if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
        try {
          for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
            if (i === idx) continue;
            try { localStorage.removeItem(getSlotKey(i)); } catch {}
          }
          try { localStorage.removeItem(LAST_SAVE_SLOT_KEY); } catch {}
          try {
            return tryWrite();
          } catch (err2) {
            console.error('save retry failed', err2);
          }
        } catch {}
        tileInfoEl.textContent = '保存容量の上限に達しました。古いセーブを削除してから再度お試しください';
      } else {
        tileInfoEl.textContent = '保存に失敗しました';
      }
      return false;
    }
  }



  function restoreCities(savedCities, idMap) {
    cities.length = 0;
    if (!Array.isArray(savedCities)) return;
    savedCities.forEach((raw, idx) => {
      if (!raw) return;
      const city = {
        id: idx,
        kind: raw.kind || CITY.VILLAGE,
        x: raw.x,
        y: raw.y,
        pop: raw.pop || 0,
        food: raw.food || 0,
        prod: raw.prod || 0,
        wealth: raw.wealth || 0,
        defense: raw.defense || 0,
        slots: Array.isArray(raw.slots) ? [...raw.slots] : [],
        level: raw.level || 1,
        civCore: raw.civCore || (CIV_CORE[raw.kind] || 5),
        name: raw.name || '',
        megacity: !!raw.megacity || raw.kind === CITY.CAPITAL,
        relations: [],
        stability: raw.stability || 0,
        prosperity: raw.prosperity || 0,
        military: raw.military || 0,
        lastDelta: raw.lastDelta || 0,
      };
      if (Array.isArray(raw.relations)) {
        city.relations = raw.relations.map(rel => {
          if (!rel) return null;
          const mappedId = idMap.has(rel.id) ? idMap.get(rel.id) : rel.id;
          return { id: mappedId, type: rel.type, strength: rel.strength };
        }).filter(Boolean);
      }
      cities.push(city);
    });
  }

  function applyTileRecords(records, idMap) {
    if (!Array.isArray(records) || records.length !== W*H) throw new Error('tile data mismatch');
    for (const rec of records) {
      if (rec == null) continue;
      const { x, y } = rec;
      if (x == null || y == null) continue;
      if (y < 0 || y >= H || x < 0 || x >= W) continue;
      const t = map[y][x];
      t.h = rec.height ?? t.h;
      t.base = rec.terrainType || t.base;
      const w = rec.water || {};
      t.river = !!w.river;
      t.riverWidth = w.width || 0;
      t.riverDirs = Array.isArray(w.dirs) ? [...w.dirs] : [];
      t.road = rec.road || 0;
      t.manualRoad = !!rec.manualRoad;
      t.civ = rec.civilization ?? 0;
      t.city = rec.cityType || null;
      const mappedOwner = (rec.cityId != null && idMap.has(rec.cityId)) ? idMap.get(rec.cityId) : (rec.cityId ?? null);
      t.owner = mappedOwner;
      const mappedNode = (rec.nodeId != null && idMap.has(rec.nodeId)) ? idMap.get(rec.nodeId) : rec.nodeId;
      t.nodeId = mappedNode != null ? mappedNode : mappedOwner;
      t.farmland = rec.farmland ?? 0;
      t.snow = !!rec.snow;
      t.river = !!w.river;
    }
  }

  function restoreStoryHistory(storyData) {
    storyActionTimeline.length = 0;
    aiActionLog.length = 0;
    if (storyData && Array.isArray(storyData.aiLog)) {
      storyData.aiLog.slice(0, AI_LOG_LIMIT).forEach(entry => {
        if (!entry || typeof entry.text !== 'string') return;
        aiActionLog.push({
          turn: typeof entry.turn === 'number' ? entry.turn : 0,
          text: entry.text,
          timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
        });
      });
    }
    if (storyData && Array.isArray(storyData.journal)) {
      const entries = storyData.journal.slice(-STORY_TIMELINE_LIMIT);
      entries.forEach(raw => {
        if (!raw || typeof raw.summary !== 'string') return;
        const actorId = raw.actorId || 'player';
        storyActionTimeline.push({
          turn: typeof raw.turn === 'number' ? raw.turn : 0,
          actorId,
          actorName: raw.actorName || getCandidateName(actorId) || '王国',
          actionId: raw.actionId || '',
          summary: raw.summary,
        });
      });
    }
    monthlyNewspapers.length = 0;
    if (storyData && Array.isArray(storyData.monthlyNews)) {
      storyData.monthlyNews.slice(-MONTHLY_ARCHIVE_LIMIT).forEach(issue => {
        if (!issue || typeof issue.turn !== 'number') return;
        const entries = Array.isArray(issue.entries) ? issue.entries.map(entry => ({
          actorName: entry.actorName || '王国',
          summary: entry.summary || '',
          actionId: entry.actionId || '',
        })) : [];
        monthlyNewspapers.push({
          turn: issue.turn,
          entries,
          createdAt: typeof issue.createdAt === 'number' ? issue.createdAt : Date.now(),
        });
      });
      updateMobileNewsTicker();
    }
    if (storyData && typeof storyData.lastNewspaperTurn === 'number') {
      lastMonthlyNewspaperTurn = storyData.lastNewspaperTurn;
    } else {
      lastMonthlyNewspaperTurn = -1;
    }
  }

  function loadWorldFromSlot(slot=SAVE_KEY, options={}) {
    const { alertOnMissing=false } = options;
    if (typeof localStorage === 'undefined') {
      if (alertOnMissing) {
        alert('このブラウザでは読込が利用できません');
        setTitleStatus('このブラウザでは読込が利用できません');
      } else if (appState === 'title') {
        setTitleStatus('このブラウザでは読込が利用できません');
      } else {
        tileInfoEl.textContent = 'このブラウザでは読込が利用できません';
      }
      return false;
    }
    const raw = localStorage.getItem(slot);
    if (!raw) {
      if (alertOnMissing) {
        alert('保存データがありません');
        setTitleStatus('保存データがありません');
      } else if (appState === 'title') {
        setTitleStatus('保存データがありません');
      } else {
        tileInfoEl.textContent = '保存データがありません';
      }
      return false;
    }
    try {
      const data = JSON.parse(raw);
      applyLoadedWorld(data);
      if (appState === 'map') tileInfoEl.textContent = 'ワールドを読み込みました';
      else setTitleStatus('保存データを読み込みました');
      return true;
    } catch (err) {
      console.error('load failed', err);
      if (alertOnMissing) {
        alert('読込に失敗しました');
        setTitleStatus('読込に失敗しました');
      } else if (appState === 'title') {
        setTitleStatus('読込に失敗しました');
      } else {
        tileInfoEl.textContent = '読込に失敗しました';
      }
      return false;
    }
  }

  function applyLoadedWorld(data) {
    if (!data) throw new Error('invalid save data');
    const mapData = data.map || {};
    const targetW = mapData.width ?? data.width ?? W;
    const targetH = mapData.height ?? data.height ?? H;
    const tiles = mapData.tiles || data.tiles;
    if (targetW !== W || targetH !== H || !Array.isArray(tiles)) throw new Error('invalid save data');
    currentSeed = data.seed ?? currentSeed;
    const idMap = new Map();
    if (Array.isArray(data.cities)) {
      data.cities.forEach((c, idx) => {
        const key = (c && typeof c.id === 'number') ? c.id : idx;
        idMap.set(key, idx);
      });
    }
    restoreWorldState(data.worldState || {});
    applyTileRecords(tiles, idMap);
    restoreCities(data.cities || [], idMap);
    for (const city of cities) {
      if (!city) continue;
      const tile = map[city.y][city.x];
      if (!tile) continue;
      tile.city = city.kind;
      tile.owner = city.id;
      tile.nodeId = city.id;
      tile.civ = Math.max(tile.civ, city.civCore || tile.civ);
    }
    if (data.camera) {
      if (Number.isFinite(data.camera.ox)) ox = data.camera.ox;
      if (Number.isFinite(data.camera.oy)) oy = data.camera.oy;
      if (Number.isFinite(data.camera.tileW)) tileW = clamp(data.camera.tileW, 8, 70);
      if (Number.isFinite(data.camera.tileH)) tileH = clamp(data.camera.tileH, 4, 35);
      if (Number.isFinite(data.camera.zStep)) zStep = clamp(data.camera.zStep, 3, 20);
      if (typeof data.camera.is2DMode === 'boolean') is2DMode = data.camera.is2DMode;
    }
        if (data.story) {
          isStoryMode = !!data.story.isStoryMode;

        // restore player profile
        if (data.story.playerProfile) {
          player.profile.name = data.story.playerProfile.name || '';
          player.profile.gender = data.story.playerProfile.gender || 'undisclosed';
        } else {
          player.profile.name = player.profile.name || '';
          player.profile.gender = player.profile.gender || 'undisclosed';
        }

          // restore turn / succession info
          if (typeof data.story.turn === 'number') {
            currentTurn = Math.max(0, Math.floor(data.story.turn));
          } else {
            currentTurn = 0;
          }
          if (typeof data.story.successionTurnPlanned === 'number') {
            successionTurnPlanned = Math.floor(data.story.successionTurnPlanned);
          } else {
            successionTurnPlanned = null;
          }

          // restore roles
          if (data.story.roles) {
          roles.player = data.story.roles.player || null;
          roles.marshal = data.story.roles.marshal || null;
          roles.princess = data.story.roles.princess || null;
          roles.council = data.story.roles.council || null;
        } else {
          roles.player = roles.marshal = roles.princess = roles.council = null;
        }

        // restore characters or fall back to defaults
        if (data.story.characters && typeof data.story.characters === 'object') {
          characters = JSON.parse(JSON.stringify(data.story.characters));
        } else {
          initCharacters();
        }

        // ensure player character exists and stays in sync with profile
        if (!characters.player) {
          characters.player = JSON.parse(JSON.stringify(INITIAL_CHARACTERS_V2.player));
        }
        if (player.profile.name) {
          characters.player.name = player.profile.name;
        } else if (characters.player.name) {
          player.profile.name = characters.player.name;
        }

        // sync character.role with roles map
        ['player','marshal','princess','council'].forEach(id => {
          if (characters[id]) {
            characters[id].role = roles[id] || null;
          }
        });

        successionResult = data.story.successionResult || null;
        if (data.story.flags) {
          storyFlags.introShown = !!data.story.flags.introShown;
          storyFlags.successionShown = !!data.story.flags.successionShown;
          storyFlags.firstCityInspect = !!data.story.flags.firstCityInspect;
          storyFlags.firstCapitalSet = !!data.story.flags.firstCapitalSet;
        } else {
          storyFlags.introShown = false;
          storyFlags.successionShown = false;
          storyFlags.firstCityInspect = false;
          storyFlags.firstCapitalSet = false;
        }
      } else {
        isStoryMode = false;
        player.profile.name = '';
        player.profile.gender = 'undisclosed';
        roles.player = roles.marshal = roles.princess = roles.council = null;
        successionResult = null;
        storyFlags.introShown = false;
        storyFlags.successionShown = false;
        storyFlags.firstCityInspect = false;
        storyFlags.firstCapitalSet = false;
        initCharacters();
      }
      restoreStoryScenarioState(data.story ? data.story.storyScenario : null);
      restoreStoryHistory(data.story);
      skipMonthlyNewsAfterLoad = true;
    globalFunds = (typeof data.funds === 'number') ? data.funds : 3000;
    cityDistanceField = computeCityDistanceField();
    worldReady = true;
    worldDirty = false;
    pendingCapitalSelection = false;
    pendingDevelopment = false;
    selectedTile = null;
    lastTileInfo = null;
    updateTileInfo(null);
    updateHudStats();
    updateControlButtons();
    resetChunkStore();
    render();
    maybeTriggerStorySequence();
  }

  // --- マップ ---
  const W = 100, H = 100;
  const CHUNK_SIZE = 10;
  const CHUNK_COLS = Math.ceil(W / CHUNK_SIZE);
  const CHUNK_ROWS = Math.ceil(H / CHUNK_SIZE);
  const CHUNK_LAYERS = ['terrain', 'infra', 'city'];
  const chunkStore = new Map(); // key: "cx,cy"

  function chunkKey(cx, cy) {
    return `${cx},${cy}`;
  }

  function createLayerCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = tileW * CHUNK_SIZE;
    canvas.height = tileH * CHUNK_SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }

  function createChunk(cx, cy) {
    const chunk = {
      cx,
      cy,
      terrain: createLayerCanvas(),
      infra: createLayerCanvas(),
      city: createLayerCanvas(),
      dirty: {
        terrain: true,
        infra: true,
        city: true,
      },
    };
    chunkStore.set(chunkKey(cx, cy), chunk);
    return chunk;
  }

  function ensureChunk(cx, cy) {
    const key = chunkKey(cx, cy);
    if (!chunkStore.has(key)) {
      return createChunk(cx, cy);
    }
    return chunkStore.get(key);
  }

  function getChunkForTile(x, y) {
    const cx = Math.max(0, Math.min(CHUNK_COLS - 1, Math.floor(x / CHUNK_SIZE)));
    const cy = Math.max(0, Math.min(CHUNK_ROWS - 1, Math.floor(y / CHUNK_SIZE)));
    return ensureChunk(cx, cy);
  }

  function markChunkDirty(x, y, layer) {
    const chunk = getChunkForTile(x, y);
    if (!chunk) return;
    if (chunk.dirty && layer in chunk.dirty) {
      chunk.dirty[layer] = true;
    }
  }

  function getChunkBounds(chunk) {
    const startX = chunk.cx * CHUNK_SIZE;
    const startY = chunk.cy * CHUNK_SIZE;
    const endX = Math.min((chunk.cx + 1) * CHUNK_SIZE, W);
    const endY = Math.min((chunk.cy + 1) * CHUNK_SIZE, H);
    return { startX, startY, endX, endY };
  }

  function drawTerrainChunk(chunk) {
    const ctx = chunk?.terrain?.ctx;
    if (!ctx) return;
    const { startX, startY, endX, endY } = getChunkBounds(chunk);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map[y][x];
        if (!tile) continue;
        const px = (x - startX) * tileW;
        const py = (y - startY) * tileH;
        ctx.fillStyle = baseFill(tile);
        ctx.fillRect(px, py, tileW, tileH);
        if (tile.farmland > 0 && !isWaterBase(tile.base)) {
          ctx.fillStyle = 'rgba(205,175,105,0.35)';
          ctx.fillRect(px + 1, py + 1, tileW - 2, tileH - 2);
        }
        if (showCivOverlay && !isWaterBase(tile.base) && tile.civ > 0.05) {
          const intensity = Math.min(1, tile.civ / 18);
          ctx.fillStyle = `rgba(255,240,210,${0.15 + intensity * 0.25})`;
          ctx.fillRect(px + 1, py + 1, tileW - 2, tileH - 2);
        }
        if (tile.snow && tile.base === BASE.MOUNTAIN) {
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(px, py, tileW, tileH * 0.4);
        }
      }
    }
    chunk.dirty.terrain = false;
  }

  function drawInfraChunk(chunk) {
    const ctx = chunk?.infra?.ctx;
    if (!ctx) return;
    const { startX, startY, endX, endY } = getChunkBounds(chunk);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map[y][x];
        if (!tile) continue;
        const px = (x - startX) * tileW;
        const py = (y - startY) * tileH;
        if (showRoads && tile.road) {
          const alpha = 0.5 + Math.min(tile.road, 2) * 0.2;
          ctx.fillStyle = `rgba(235,220,180,${alpha})`;
          ctx.fillRect(px + 2, py + tileH * 0.45, tileW - 4, tileH * 0.1);
        }
        if (tile.manualRoad) {
          ctx.strokeStyle = 'rgba(255,200,120,0.8)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 2, py + 2, tileW - 4, tileH - 4);
        }
      }
    }
    chunk.dirty.infra = false;
  }

  function drawCityChunk(chunk) {
    const ctx = chunk?.city?.ctx;
    if (!ctx) return;
    const { startX, startY, endX, endY } = getChunkBounds(chunk);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const tile = map[y][x];
        if (!tile || !tile.city) continue;
        const px = (x - startX) * tileW;
        const py = (y - startY) * tileH;
        ctx.fillStyle = '#ffe082';
        ctx.beginPath();
        ctx.arc(px + tileW / 2, py + tileH / 2, Math.min(tileW, tileH) * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9c6b1f';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    chunk.dirty.city = false;
  }

  function resetChunkStore() {
    chunkStore.clear();
    chunkRefreshNeeded = true;
  }

  function invalidateChunkLayers(layers = CHUNK_LAYERS) {
    if (!Array.isArray(layers)) {
      layers = [layers];
    }
    chunkStore.forEach(chunk => {
      for (const layer of layers) {
        if (chunk.dirty && layer in chunk.dirty) {
          chunk.dirty[layer] = true;
        }
      }
    });
  }

  function screenToWorld2DCoords(px, py) {
    const size = tileSize2D();
    if (!size) return { x: 0, y: 0 };
    return {
      x: (px - ox) / size,
      y: (py - oy) / size,
    };
  }

  function getVisibleChunkRect2D() {
    const corners = [
      [0, 0],
      [canvas.width, 0],
      [0, canvas.height],
      [canvas.width, canvas.height],
    ];
    const points = corners.map(([px, py]) => screenToWorld2DCoords(px, py));
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const pad = 1;
    const minChunkX = clamp(Math.floor(minX / CHUNK_SIZE) - pad, 0, CHUNK_COLS - 1);
    const maxChunkX = clamp(Math.floor(maxX / CHUNK_SIZE) + pad, 0, CHUNK_COLS - 1);
    const minChunkY = clamp(Math.floor(minY / CHUNK_SIZE) - pad, 0, CHUNK_ROWS - 1);
    const maxChunkY = clamp(Math.floor(maxY / CHUNK_SIZE) + pad, 0, CHUNK_ROWS - 1);
    return {
      minChunkX: Math.min(minChunkX, maxChunkX),
      maxChunkX: Math.max(minChunkX, maxChunkX),
      minChunkY: Math.min(minChunkY, maxChunkY),
      maxChunkY: Math.max(minChunkY, maxChunkY),
    };
  }

  function getVisibleChunks2D() {
    const rect = getVisibleChunkRect2D();
    const visible = [];
    for (let cy = rect.minChunkY; cy <= rect.maxChunkY; cy++) {
      for (let cx = rect.minChunkX; cx <= rect.maxChunkX; cx++) {
        visible.push(ensureChunk(cx, cy));
      }
    }
    return visible;
  }

  function renderSelectionOutline2D() {
    if (!selectedTile) return;
    const size = tileSize2D();
    if (!size) return;
    const { sx, sy } = toScreen2D(selectedTile.x, selectedTile.y);
    drawSelection2D(sx, sy, size);
  }

  function renderCityLabels2D() {
    if (!showCityNames) return;
    const size = tileSize2D();
    if (!size) return;
    const queue = [];
    for (const city of cities) {
      if (!city) continue;
      queue.push(city);
    }
    queue.sort((a, b) => {
      const aScore = a.kind === CITY.CAPITAL ? -1 : 0;
      const bScore = b.kind === CITY.CAPITAL ? -1 : 0;
      return aScore - bScore;
    });
    queue.forEach(city => {
      const { sx, sy } = toScreen2D(city.x, city.y);
      if (sx + size < 0 || sx > canvas.width || sy + size < 0 || sy > canvas.height) return;
      drawCityLabel2D(sx, sy, city, size);
    });
  }

  function renderChunks2D() {
    clear();
    const displaySize = tileSize2D();
    if (!displaySize) return;
    if (chunkRefreshNeeded) {
      invalidateChunkLayers();
      chunkRefreshNeeded = false;
    }
    const visibleChunks = getVisibleChunks2D();
    visibleChunks.forEach(chunk => {
      if (chunk.dirty.terrain) drawTerrainChunk(chunk);
      if (chunk.dirty.infra) drawInfraChunk(chunk);
      if (chunk.dirty.city) drawCityChunk(chunk);
    });
    const scaleX = displaySize / tileW;
    const scaleY = displaySize / tileH;
    ctx.imageSmoothingEnabled = false;
    visibleChunks.forEach(chunk => {
      const { startX, startY, endX, endY } = getChunkBounds(chunk);
      const width = Math.max(0, (endX - startX) * tileW);
      const height = Math.max(0, (endY - startY) * tileH);
      if (!width || !height) return;
      const { sx, sy } = toScreen2D(startX, startY);
      const destWidth = width * scaleX;
      const destHeight = height * scaleY;
      ctx.drawImage(chunk.terrain.canvas, 0, 0, width, height, sx, sy, destWidth, destHeight);
      ctx.drawImage(chunk.infra.canvas, 0, 0, width, height, sx, sy, destWidth, destHeight);
      ctx.drawImage(chunk.city.canvas, 0, 0, width, height, sx, sy, destWidth, destHeight);
    });
    renderSelectionOutline2D();
    renderCityLabels2D();
    if (showTrafficOverlay) drawTrafficOverlay();
  }
  const maxZ = 10;

  // タイル基底
  const BASE = {
    SEA: 'sea',
    LAKE: 'lake',
    GRASS: 'grass',
    FOREST: 'forest',
    MOUNTAIN: 'mountain',
  };

  // 都市（オーバーレイ）
  const CITY = {
    VILLAGE: 'village',
    TOWN: 'town',
    WALLED: 'walled_city',
    CITY: 'city',
    CASTLE: 'castle',
    CAPITAL: 'capital',
    PLANNED: 'planned_city',
  };

  const BASE_LABEL = {
    [BASE.SEA]: '海',
    [BASE.LAKE]: '湖',
    [BASE.GRASS]: '平地',
    [BASE.FOREST]: '森林',
    [BASE.MOUNTAIN]: '山岳',
  };

  const CITY_LABEL = {
    [CITY.VILLAGE]: '村',
    [CITY.TOWN]: '町',
    [CITY.WALLED]: '城郭都市',
    [CITY.CITY]: '都市',
    [CITY.CASTLE]: '城',
    [CITY.CAPITAL]: '王都',
    [CITY.PLANNED]: '計画都市',
  };

  const CITY_LIST_PRIORITY = {
    [CITY.CAPITAL]: 6,
    [CITY.CASTLE]: 5,
    [CITY.CITY]: 4,
    [CITY.WALLED]: 3,
    [CITY.TOWN]: 2,
    [CITY.PLANNED]: 0,
    [CITY.VILLAGE]: 1,
  };

  const CIV_CORE = {
    [CITY.VILLAGE]: 5,
    [CITY.TOWN]: 8,
    [CITY.WALLED]: 12,
    [CITY.CITY]: 14,
    [CITY.CASTLE]: 14,
    [CITY.CAPITAL]: 20,
  };

  const NAME_PREFIXES = ['アル', 'ベラ', 'ドラ', 'カル', 'レイ', 'ミスト', 'ノア', 'グリム', 'オル', 'フィア'];
  const NAME_CENTERS = ['フェル', 'ディア', 'ガル', 'ラナ', 'セレ', 'ティア', 'モル', 'リオ', 'ハル', 'ゼア'];
  const NAME_SUFFIXES = ['ン', 'リア', 'ダ', 'ス', 'ナ', 'ール', 'フォード', 'グレイ', 'シア', 'ベルン'];
  const NAME_EPITHETS = ['の都', '城塞', '王都', '交易港', '聖域', '大伽藍', '学院', '峠', '湖畔', '谷'];
  const RELATION_TYPES = ['同盟', '友好', '交易', '競合', '宿敵'];

  function tileSize2D() { return Math.max(6, tileW * 0.95); }

  function recenterView(force=false) {
    if (!canvas.width || !canvas.height) return;
    if (!force && dragging) return;
    if (is2DMode) {
      const size = tileSize2D();
      ox = canvas.width/2 - (W * size)/2;
      oy = canvas.height/2 - (H * size)/2;
    } else {
      ox = canvas.width/2;
      oy = canvas.height * 0.25;
    }
  }

  function basePopulation(kind, randFn=Math.random) {
    switch(kind) {
      case CITY.CAPITAL: return 9000 + Math.floor(randFn()*4000);
      case CITY.CASTLE: return 3200 + Math.floor(randFn()*1200);
      case CITY.CITY: return 6000 + Math.floor(randFn()*2000);
      case CITY.WALLED: return 2800 + Math.floor(randFn()*900);
      case CITY.TOWN: return 1200 + Math.floor(randFn()*600);
      default: return 400 + Math.floor(randFn()*300);
    }
  }

  // 2.5D表示
  let tileW = 24;     // 100x100向けバランス
  let tileH = 12;
  let zStep = 7;
  let ox = 0;
  let oy = 80;

  // パン操作
  let dragging = false;
  let lastX = 0, lastY = 0;
  let dragMoved = false;
  let selectedTile = null;
  let showCivOverlay = true;
  let showRoads = true;
  let showTrafficOverlay = false;
  let cityDistanceField = null;
  let lowDetailMode = false;
  let tinyDetailMode = false;
  let worldReady = false;
  let is2DMode = false;
  let showCityNames = false;
  let appState = 'title';
    let worldDirty = false;
    let chunkRefreshNeeded = true;
    let isStoryMode = false;
    let timeControl = { speed: 1, lastTick: 0, interval: 2000 };
    let titleBlend = 0;
    let titleModeCurrent = false;
    let titleModeNext = true;
    let lastTitleTick = 0;
let globalFunds = 3000;
let railPassengerFlow = 0;
let railRevenueLastTurn = 0;
let railMaintenanceLastTurn = 0;
    let currentTurn = 0;
  let successionTurnPlanned = null; // ターン数での王決定予定（null なら未定）
  // 継承競争／統治フェーズ
  let storyPhase = 'succession'; // 'succession' | 'governance'
  // 行動ターン（政治ターン）。1政治ターン=3か月（currentTurn 3ターン分）を想定
  let actionTurnIndex = 0;
  const ACTION_TURN_LENGTH = 3;
  // 候補者ごとの行動ポイントと前回行動・クールダウン
  const ACTORS = ['player','marshal','princess','council'];
  const actorActionPoints = { player: 0, marshal: 0, princess: 0, council: 0 };
  const actorLastActionId = { player: null, marshal: null, princess: null, council: null };
  // クールダウン: actorId -> key(actionId or actionId:cityId) -> 残りターン数
  const actorCooldowns = { player: {}, marshal: {}, princess: {}, council: {} };
  // 抽象的な権威ポイント（政治的余力）と予算
  const actorAuthority = { player: 10, marshal: 10, princess: 10, council: 10 };
  let abstractBudget = 20;
  let globalTax = 0;
  let kingAI = { id:null, state:null, lastStoryState:null, playerRank:1, skipLawThisTurn:false, proposalsShown:false };
  let globalMaintenance = 0;
  const TITLE_FADE_MS = 6000;
  let pendingCapitalSelection = false;
  let pendingDevelopment = false;
  let pendingRoadMode = false;
  let pendingRailMode = false;
  let railDraft = null;
  let railOverlayContext = null;
  let railScheduleStateRefresher = null;
  const RAIL_SNAP_THRESHOLD = 0.75;
  let detailCityId = null;
  let showCityStats = false;
  let lastTileInfo = null;
  let cityListVisible = false;
  let currentSeed = null;
    const SAVE_SLOT_COUNT = 4;
    const SAVE_KEY_PREFIX = 'world_save_slot_';
    const LAST_SAVE_SLOT_KEY = 'world_save_last_slot';
    const DEFAULT_SAVE_SLOT = 1;
    const SAVE_KEY = getSlotKey(DEFAULT_SAVE_SLOT);
    // デフォルトの王決定ターン（3年4月を想定、ターン0=1年1月）
    if (typeof successionTurnPlanned !== 'number' || !Number.isFinite(successionTurnPlanned)) {
      successionTurnPlanned = 40;
    }

  function sumSupportValues(support) {
    if (!support || typeof support !== 'object') return 0;
    return Object.values(support).reduce((acc, value) => {
      return acc + (typeof value === 'number' ? value : 0);
    }, 0);
  }

  function computeCandidateScore(id) {
    const stats = getCharacterEffectiveStats(id) || {};
    const char = getCharacter(id);
    const supportTotal = sumSupportValues((char && char.support) || {});
    const base = (
      (stats.economy ?? 0) +
      (stats.infrastructure ?? 0) +
      (stats.administration ?? 0) +
      (stats.military ?? 0) +
      (stats.legitimacy ?? 0)
    ) * 0.2;
    const supportScore = supportTotal * 0.05;
    return base + supportScore;
  }

  function computeSuccessionResult() {
    successionAftermathHandled = false;
    const candidateIds = ['player','marshal','princess','council'];
    const scores = {};
    candidateIds.forEach(id => {
      scores[id] = Math.floor(computeCandidateScore(id));
    });
    const capital = cities.find(c => c && c.kind === CITY.CAPITAL);
    if (globalFunds > 6000) scores.council += 2;
    if (globalFunds < 2000) scores.marshal += 2;
    if (capital) {
      if (capital.prosperity > 4) scores.princess += 2;
      if (capital.stability > 80) scores.marshal += 1;
    }

    ['player','marshal','princess','council'].forEach(id => {
      const char = getCharacter(id);
      const trust = char && char.trust && typeof char.trust.global === 'number'
        ? char.trust.global
        : 50;
      const bonus = Math.floor((trust - 50) / 15);
      scores[id] += bonus;
    });

    if (capital && typeof capital.id !== 'undefined') {
      candidateIds.forEach(id => {
        const t = getCityTrust(id, capital.id);
        const bonus = Math.floor((t - 50) / 20);
        scores[id] += bonus;
      });
    }

    const sorted = [...candidateIds].sort((a, b) => scores[b] - scores[a]);
    const ranking = {};
    sorted.forEach((id, index) => ranking[id] = index + 1);
    const winnerId = sorted[0] || 'player';
    const playerRank = ranking.player || 1;
    successionResult = {
      winnerId,
      support: scores,
      rankings: ranking,
      playerRank,
    };
  }

  function applySuccessionRoles() {
    if (!successionResult) return;
    roles.player = roles.marshal = roles.princess = roles.council = null;
    const winnerId = successionResult.winnerId;
    roles[winnerId] = 'king';
    const template = ROLE_TEMPLATES[winnerId] || ROLE_TEMPLATES.player;
    Object.keys(template).forEach(id => {
      roles[id] = template[id];
    });
    const assigned = new Set(Object.values(roles).filter(Boolean));
    const fallback = ['chancellor','marshal','speaker','governor','advisor'];
    ['player','marshal','princess','council'].forEach(id => {
      if (!roles[id]) {
        const role = fallback.find(r => !assigned.has(r)) || 'advisor';
        roles[id] = role;
        assigned.add(role);
      }
    });
    const playerRank = successionResult.playerRank || (successionResult.rankings && successionResult.rankings.player) || 1;
    if (winnerId !== 'player') {
      roles.player = getPlayerRoleFromRank(playerRank);
    }
    // reflect decided roles into character objects
    ['player','marshal','princess','council'].forEach(id => {
      if (characters[id]) {
        characters[id].role = roles[id] || null;
      }
    });
    initKingAI(winnerId, playerRank);
  }

  function getCandidateName(id) {
    const c = CANDIDATES.find(ca => ca.id === id);
    return (c && c.name) || '（名不明）';
  }

  function roleLabel(role) {
    switch(role) {
      case 'king': return '王';
      case 'chancellor': return '宰相';
      case 'marshal': return '軍務卿';
      case 'speaker': return '評議会議長';
      case 'governor': return '大都市総督';
      case 'advisor': return '特任顧問';
      default: return role || '役職なし';
    }
  }

  function showIntroStoryOverlay() {
    const playerName = player.profile.name || 'あなた';
    const body = [
      `あなた「${playerName}」は、目を覚ますと見知らぬ世界の地図の上に立っていた。`,
      'ここは、継承者たちがそれぞれの理想の国家像を掲げて競う王国。',
      'インフラと都市を育て、この世界の行く末を見届けよう。',
    ].join('<br>');
    showStoryOverlay({
      id:'story-intro',
      title:'転生と召命',
      body,
      modal:false,
      center:true,
      buttons:[{ label:'続ける', action: () => closeStoryOverlay('story-intro') }],
    });
  }

  function showFirstCityInspectOverlay(city) {
    if (!city) return;
    timeControl.speed = 0;
    updateControlButtons();
    playSystemSound('major');
    const name = city.name || 'この都市';
    const body = [
      `${name} を初めて視察した。`, 
      '人口・安定度・繁栄度を見れば、この国の未来の一端が見えてくる。',
      'あなたの判断が、この都市の運命だけでなく、王国全体の流れも変えていくだろう。',
    ].join('<br>');
    showStoryOverlay({
      id:'story-first-city',
      title:'最初の視察',
      body,
      modal:false,
      center:true,
      buttons:[{ label:'閉じる', action: () => closeStoryOverlay('story-first-city') }],
    });
  }

  function showCapitalDirectionOverlay(city) {
    timeControl.speed = 0;
    updateControlButtons();
    playSystemSound('major');
    const name = (city && city.name) || '新しい王都';
    const body = [
      `${name} が王都として選ばれた。`, 
      '王都の立地と性格は、王国の「何を優先するか」を静かに方向付ける。',
      '軍事・正統性・制度、そしてあなたの視点――それぞれの思惑が、ここから交わり始める。',
    ].join('<br>');
    showStoryOverlay({
      id:'story-capital',
      title:'王都の指名',
      body,
      modal:false,
      center:true,
      buttons:[{ label:'了解', action: () => closeStoryOverlay('story-capital') }],
    });
    announceCapitalMove(city);
  }

  function showSuccessionOverlay() {
    if (!successionResult) return;
    timeControl.speed = 0;
    updateControlButtons();
    playSystemSound('major');
    const winnerId = successionResult.winnerId;
    const winnerName = getCandidateName(winnerId);
    const playerName = player.profile.name || getCandidateName('player');
    const playerRole = roleLabel(roles.player);
    let body = '';
    body += `新たな王として ${winnerName} が指名された。<br>`;
    body += `あなた（${playerName}）の席は、${playerRole} として用意される。<br><br>`;
      const marshalStats = formatCharacterMainStats('marshal');
      const princessStats = formatCharacterMainStats('princess');
      const councilStats = formatCharacterMainStats('council');
      body += `${getCandidateName('marshal')}：${roleLabel(roles.marshal)}${marshalStats ? `（${marshalStats}）` : ''}<br>`;
      body += `${getCandidateName('princess')}：${roleLabel(roles.princess)}${princessStats ? `（${princessStats}）` : ''}<br>`;
      body += `${getCandidateName('council')}：${roleLabel(roles.council)}${councilStats ? `（${councilStats}）` : ''}<br>`;
    const overlayButtons = [];
    if (winnerId === 'player') {
      overlayButtons.push({
        label: '王位辞退して宰相になる',
        action: () => promptChancellorSelection('story-succession'),
      });
    }
    overlayButtons.push({ label: '了解', action: () => closeStoryOverlay('story-succession') });
    showStoryOverlay({
      id:'story-succession',
      title:'継承の決着',
      body,
      modal:false,
      center:true,
      buttons: overlayButtons,
    });
    handleSuccessionAftermath();
  }

  function promptChancellorSelection(originOverlayId) {
    if (!storyOverlayRoot) return;
    const overlayId = 'chancellor-selection';
    if (overlayStack.find(o => o.id === overlayId)) return;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    const desc = document.createElement('p');
    desc.style.margin = '0';
    desc.textContent = '王を任せる候補を選んで、その代わり宰相として支える周到な戦略を示そう。';
    container.appendChild(desc);
    const candidatesRow = document.createElement('div');
    candidatesRow.style.display = 'flex';
    candidatesRow.style.flexWrap = 'wrap';
    candidatesRow.style.gap = '6px';
    ['marshal','princess','council'].forEach(id => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      const label = `${getCandidateName(id)} (${roleLabel(roles[id])})`;
      btn.textContent = label;
      btn.addEventListener('click', () => applyChancellorSuccession(id, originOverlayId, overlayId));
      candidatesRow.appendChild(btn);
    });
    container.appendChild(candidatesRow);
    showStoryOverlay({
      id: overlayId,
      title: '王を誰に託す？',
      body: container,
      modal: false,
      buttons: [{ label: '戻る', action: () => closeStoryOverlay(overlayId) }],
      width: 420,
    });
  }

  function applyChancellorSuccession(chosenId, originOverlayId, selectionOverlayId) {
    if (!successionResult) return;
    closeStoryOverlay(selectionOverlayId);
    if (originOverlayId) {
      closeStoryOverlay(originOverlayId);
    }
    const ranking = {};
    ranking[chosenId] = 1;
    ranking.player = 2;
    ['marshal','princess','council'].forEach(id => {
      if (id === chosenId) return;
      let nextRank = Object.keys(ranking).length + 1;
      ranking[id] = nextRank;
    });
    const support = (characters[chosenId] && characters[chosenId].support) || {};
    successionResult = {
      winnerId: chosenId,
      support,
      rankings: ranking,
      playerRank: 2,
    };
    recordStoryAction('player', 'decline_king', {
      storyLabel: `王位を辞退し、${getCandidateName(chosenId)} に託した`,
    });
    successionAftermathHandled = false;
    storyFlags.successionShown = false;
    applySuccessionRoles();
    updateControlButtons();
    storyFlags.successionShown = true;
    showSuccessionOverlay();
  }

  function handleSuccessionAftermath() {
    if (!successionResult || successionAftermathHandled) return;
    const winner = characters[successionResult.winnerId];
    const totalSupport = sumSupportValues(winner?.support || {});
    const playerSupport = sumSupportValues(characters.player?.support || {});
    let summary = '';
    if (totalSupport < 160) {
      summary += '支持は低く、不満の火種があちこちに残っている。城下では反発の兆候も。';
      cities.forEach(city => {
        city.stability = clamp((city.stability || 50) - 4, 0, 120);
      });
    } else if (totalSupport > 220) {
      summary += '歓喜のなか新王が即位した。忠誠心も高く、安定が始まりつつある。';
      cities.forEach(city => {
        city.support = city.support || {};
        city.support.citizens = clamp((city.support.citizens || 50) + 3, 0, 100);
      });
    } else {
      summary += '緊張と希望が交錯する。王位は安定したが油断は許されない。';
    }
    if (playerSupport > totalSupport && characters.player && characters.player.support && characters.player.support.citizens) {
      summary += ' 反対派の動きもあり、いくつかの地域で抗議の気配が漂う。';
      cities.forEach(city => {
        city.stability = clamp((city.stability || 50) - 2, 0, 120);
      });
    }
    if (Math.random() < 0.3) {
      summary += ' 突如として小規模な災害が発生し、不安を煽っている。';
      globalFunds = Math.max(0, globalFunds - 200);
      cities.forEach(city => {
        city.stability = clamp((city.stability || 50) - 3, 0, 120);
      });
    }
    const headline = `即位直後: ${getCandidateName(successionResult.winnerId)} の第一声`;
    showNewspaperHeadline(headline, summary);
    successionAftermathHandled = true;
    if (successionResult.winnerId === 'player') {
      offerNPCProposals();
    }
  }

    function handleFirstCapitalSet(city) {
      showCapitalDirectionOverlay(city);
      // 王決定予定ターンが未設定なら、このタイミングから30ターン後を目安にする
      if (successionTurnPlanned == null) {
        successionTurnPlanned = currentTurn + 30;
      }
      if (!successionResult) {
        computeSuccessionResult();
        applySuccessionRoles();
      }
      if (!storyFlags.successionShown) {
        storyFlags.successionShown = true;
        showSuccessionOverlay();
      }
    }
  const activePointers = new Map();
  let singlePointerId = null;
  let pinching = false;
  let pinchState = null;
  const PINCH_SCALE_MIN = 0.85;
  const PINCH_SCALE_MAX = 1.25;

  function createPinchState() {
    const pointers = Array.from(activePointers.values());
    if (pointers.length < 2) return null;
    const [a, b] = pointers;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const centerClient = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const rect = canvas.getBoundingClientRect();
    return {
      lastDistance: distance,
      lastCenter: {
        x: (centerClient.x - rect.left) * (canvas.width / rect.width),
        y: (centerClient.y - rect.top) * (canvas.height / rect.height),
      },
    };
  }

  function handlePinchGesture() {
    if (!pinchState) return;
    const pointers = Array.from(activePointers.values());
    if (pointers.length < 2) return;
    const [a, b] = pointers;
    const currentDistance = Math.hypot(b.x - a.x, b.y - a.y);
    const centerClient = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const rect = canvas.getBoundingClientRect();
    const centerCanvas = {
      x: (centerClient.x - rect.left) * (canvas.width / rect.width),
      y: (centerClient.y - rect.top) * (canvas.height / rect.height),
    };
    if (pinchState.lastCenter) {
      const deltaX = centerCanvas.x - pinchState.lastCenter.x;
      const deltaY = centerCanvas.y - pinchState.lastCenter.y;
      ox += deltaX;
      oy += deltaY;
    }
    const ratio = pinchState.lastDistance > 0 ? currentDistance / pinchState.lastDistance : 1;
    const scale = clamp(ratio, PINCH_SCALE_MIN, PINCH_SCALE_MAX);
    const nextTileW = clamp(tileW * scale, 8, 70);
    const actualScale = nextTileW / tileW;
    const nextTileH = clamp(tileH * scale, 4, 35);
    const nextZStep = clamp(zStep * scale, 3, 20);
    ox = centerCanvas.x + (ox - centerCanvas.x) * actualScale;
    oy = centerCanvas.y + (oy - centerCanvas.y) * actualScale;
    tileW = nextTileW;
    tileH = nextTileH;
    zStep = nextZStep;
    resetChunkStore();
    render();
    pinchState.lastDistance = currentDistance;
    pinchState.lastCenter = centerCanvas;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (appState !== 'map' || !worldReady) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (activePointers.size >= 2) {
      pinching = true;
      pinchState = createPinchState();
      dragging = false;
      singlePointerId = null;
      dragMoved = false;
    } else {
      pinching = false;
      singlePointerId = e.pointerId;
      dragging = true;
      dragMoved = false;
      lastX = e.clientX; lastY = e.clientY;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (appState !== 'map' || !worldReady) return;
    const pointer = activePointers.get(e.pointerId);
    if (pointer) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }
    if (pinching && activePointers.size >= 2) {
      e.preventDefault();
      handlePinchGesture();
      return;
    }
    if (!dragging || singlePointerId !== e.pointerId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (!dragMoved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      dragMoved = true;
    }
    if (dragMoved) {
      ox += dx;
      oy += dy;
      render();
    }
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (appState !== 'map' || !worldReady) return;
    const wasPrimaryDrag = dragging && singlePointerId === e.pointerId;
    dragging = false;
    activePointers.delete(e.pointerId);
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    if (pinching && activePointers.size < 2) {
      pinching = false;
      pinchState = null;
    }
    if (!pinching && activePointers.size === 1) {
      const [nextId, coords] = activePointers.entries().next().value;
      singlePointerId = nextId;
      dragging = true;
      dragMoved = false;
      lastX = coords.x;
      lastY = coords.y;
    } else {
      singlePointerId = null;
    }
    if (!pinching && wasPrimaryDrag && !dragMoved) {
      handleTileClick(e);
    }
  });
  canvas.addEventListener('pointerleave', (e) => {
    activePointers.delete(e.pointerId);
    dragging = false;
    singlePointerId = null;
    if (pinching && activePointers.size < 2) {
      pinching = false;
      pinchState = null;
    }
  });
  canvas.addEventListener('pointercancel', (e) => {
    activePointers.delete(e.pointerId);
    dragging = false;
    singlePointerId = null;
    if (pinching && activePointers.size < 2) {
      pinching = false;
      pinchState = null;
    }
  });
  canvas.addEventListener('wheel', (e) => {
    if (appState !== 'map' || !worldReady) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const s = (e.deltaY < 0) ? 1.10 : 0.90;
    const nextTileW = clamp(tileW * s, 8, 70);
    const nextTileH = clamp(tileH * s, 4, 35);
    const nextZStep = clamp(zStep * s, 3, 20);
    const actualScale = nextTileW / tileW;
    ox = cx + (ox - cx) * actualScale;
    oy = cy + (oy - cy) * actualScale;
    tileW = nextTileW;
    tileH = nextTileH;
    zStep = nextZStep;
    resetChunkStore();
    render();
  }, { passive:false });

  document.addEventListener('keydown', (e) => {
    if (appState !== 'map') {
      if (e.key === 'Enter' && appState === 'title') {
        newWorldBtn?.click();
      }
      return;
    }
    const key = e.key.toLowerCase();
    let handled = true;
    let needsDraw = false;
    if (key === 'c') {
      showCivOverlay = !showCivOverlay;
      invalidateChunkLayers(['terrain']);
      needsDraw = true;
    } else if (key === 'd') {
      showRoads = !showRoads;
      invalidateChunkLayers(['infra']);
      needsDraw = true;
    } else if (key === 'v') {
      is2DMode = !is2DMode;
      startModeTransitionAnimation(is2DMode);
      recenterView(true);
      chunkRefreshNeeded = true;
      needsDraw = true;
    } else if (key === 'n') {
      showCityNames = !showCityNames;
      needsDraw = true;
    } else if (key === 'p') {
      requestCapitalSelection();
    } else if (key === 'o') {
      requestDevelopmentSelection();
    } else if (key === 'r') {
      generate();
      markMapDirty();
      needsDraw = true;
    } else {
      handled = false;
    }
    if (needsDraw) render();
    if (handled) updateControlButtons();
  });

  function resizeCanvas() {
    const prevW = canvas.width || 0;
    const prevH = canvas.height || 0;
    const targetW = window.innerWidth || prevW || 1200;
    const targetH = window.innerHeight || prevH || 740;
    const reservedHeight = refreshMobileLayout();
    const newW = Math.max(600, targetW);
    const newH = Math.max(400, targetH - reservedHeight);
    canvas.width = newW;
    canvas.height = newH;
    recenterView(true);
    render();
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- 乱数/ノイズ ---
  function mulberry32(seed) {
    return function() {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // value-noise (超軽量)
  function makeValueNoise(rand) {
    const grid = new Float32Array((W+1)*(H+1));
    for (let y=0;y<=H;y++) for (let x=0;x<=W;x++) grid[y*(W+1)+x] = rand();
    const smoothstep = (t)=> t*t*(3-2*t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const a = grid[yi*(W+1)+xi];
      const b = grid[yi*(W+1)+Math.min(W, xi+1)];
      const c = grid[Math.min(H, yi+1)*(W+1)+xi];
      const d = grid[Math.min(H, yi+1)*(W+1)+Math.min(W, xi+1)];
      const u = smoothstep(xf);
      const v = smoothstep(yf);
      const ab = a + (b-a)*u;
      const cd = c + (d-c)*u;
      return ab + (cd-ab)*v;
    };
  }

  // fBm
  function fbm(noise, x, y, oct=4) {
    let v=0, amp=0.55, freq=1;
    for (let i=0;i<oct;i++) {
      v += amp * noise(x*freq, y*freq);
      freq *= 2;
      amp *= 0.5;
    }
    return v;
  }

  // --- データ ---
  const map = Array.from({length:H}, ()=>Array.from({length:W}, ()=>({
    h:0,
    base: BASE.GRASS,
    city: null,  // CITY.* or null
    river: false,
    riverWidth: 0,
    riverDirs: [],
    snow: false,
    farmland: 0,
    civ: 0,
    road: 0,
    manualRoad: false,
    owner: null,
    nodeId: null,
  })));

  const cities = [];

  function randomChoice(rand, arr) {
    return arr[Math.floor(rand()*arr.length)];
  }

  function generateCityName(kind, rand) {
    const prefix = randomChoice(rand, NAME_PREFIXES);
    const center = rand() < 0.6 ? randomChoice(rand, NAME_CENTERS) : '';
    const suffix = randomChoice(rand, NAME_SUFFIXES);
    let base = prefix + center + suffix;
    if (rand() < 0.25) {
      base += randomChoice(rand, ['・', ' ']) + randomChoice(rand, NAME_EPITHETS);
    } else if (kind === CITY.CAPITAL) {
      base += '王都';
    } else if (kind === CITY.CASTLE) {
      base += '城';
    }
    return base;
  }

  function addCityRecord(x,y,kind, randFn=Math.random) {
    const id = cities.length;
    const city = {
      id,
      kind,
      x,
      y,
      pop: basePopulation(kind, randFn),
      food: 0,
      prod: 0,
      wealth: 0,
      defense: kind === CITY.CASTLE ? 5 : kind === CITY.WALLED ? 4 : 2,
      slots: [],
      level: 1,
      civCore: CIV_CORE[kind] || 5,
      name: generateCityName(kind, randFn),
      megacity: kind === CITY.CAPITAL,
      relations: [],
      stability: 60 + randFn()*30,
      prosperity: 1 + randFn()*2,
      military: 80 + randFn()*40,
      lastDelta: 0,
    };
    cities.push(city);
    const tile = map[y][x];
    tile.city = kind;
    tile.owner = id;
    tile.nodeId = id;
    tile.civ = Math.max(tile.civ, city.civCore);
    tile.farmland = Math.max(tile.farmland, 0.15);
    return city;
  }

  function assignCityRelations(randFn=Math.random) {
    for (const city of cities) city.relations = [];
    const pairKey = new Set();
    for (const city of cities) {
      const targets = [...cities]
        .filter(c=>c.id!==city.id)
        .sort((a,b)=>heuristic(city.x,city.y,a.x,a.y) - heuristic(city.x,city.y,b.x,b.y))
        .slice(0, 4);
      for (const other of targets) {
        const key = city.id < other.id ? `${city.id}-${other.id}` : `${other.id}-${city.id}`;
        if (pairKey.has(key)) continue;
        pairKey.add(key);
        const type = randomChoice(randFn, RELATION_TYPES);
        const strength = Math.round(40 + randFn()*50);
        city.relations.push({ id: other.id, type, strength });
        other.relations.push({ id: city.id, type, strength });
      }
    }
  }

  function formatRelationSummary(city) {
    if (!city.relations || !city.relations.length) return '';
    const list = [];
    for (const rel of city.relations.slice(0,3)) {
      const other = cities[rel.id];
      if (!other) continue;
      list.push(`${other.name || (CITY_LABEL[other.kind]||'都市')}: ${rel.type}`);
    }
    return list.join('、');
  }

  function seedCivilizationCores() {
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) map[y][x].civ = 0;
    for (const city of cities) {
      map[city.y][city.x].civ = Math.max(map[city.y][city.x].civ, city.civCore);
    }
  }

  function refreshCivilization(iter=60, randFn=Math.random) {
    seedCivilizationCores();
    spreadCivilization(iter);
    cityDistanceField = computeCityDistanceField();
    growFarmland(cityDistanceField, randFn);
  }

  function recomputeWorld(iter=60) {
    refreshCivilization(iter, Math.random);
    simulateOneTurn();
  }

  // 描画順は固定で事前生成（ソートしない）
  // isometricの基本：x+yの昇順で奥→手前
  const drawOrder = (() => {
    const buckets = Array.from({length: W+H-1}, ()=>[]);
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) buckets[x+y].push({x,y});
    return buckets.flat();
  })();

  // --- 投影 ---
  function toScreen(x, y, z) {
    const sx = (x - y) * (tileW / 2) + ox;
    const sy = (x + y) * (tileH / 2) + oy - z * zStep;
    return { sx, sy };
  }

  function toScreen2D(x, y) {
    const size = tileSize2D();
    return { sx: ox + x * size, sy: oy + y * size };
  }
  
  function screenToWorld(px, py) {
    if (is2DMode) {
      const size = tileSize2D();
      if (size === 0) return { x: 0, y: 0 };
      const wx = (px - ox) / size;
      const wy = (py - oy) / size;
      return { x: wx, y: wy };
    } else {
      if (tileW === 0 || tileH === 0) return { x: 0, y: 0 };
      // Ignoring tile height (z) for this calculation for simplicity
      const tempX = px - ox;
      const tempY = py - oy;
      const wx = (tempX / (tileW / 2) + tempY / (tileH / 2)) / 2;
      const wy = (tempY / (tileH / 2) - tempX / (tileW / 2)) / 2;
      return { x: wx, y: wy };
    }
  }

  function tileVerticesAt(x, y) {
    if (x<0 || y<0 || x>=W || y>=H) return null;
    const t = map[y][x];
    const { sx, sy } = toScreen(x, y, t.h);
    return [
      {x:sx, y:sy},
      {x:sx + tileW/2, y:sy + tileH/2},
      {x:sx, y:sy + tileH},
      {x:sx - tileW/2, y:sy + tileH/2},
    ];
  }

  function eventToCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function pickTileAt(px, py) {
    if (is2DMode) return pickTileAt2D(px, py);
    for (let i = drawOrder.length - 1; i >= 0; i--) {
      const {x, y} = drawOrder[i];
      const tile = map[y][x];
      const { sx, sy } = toScreen(x,y,tile.h);
      const cx = sx;
      const cy = sy + tileH/2;
      const dx = Math.abs(px - cx);
      const dy = Math.abs(py - cy);
      if (dx > tileW/2 || dy > tileH/2) continue;
      if ((dx / (tileW/2)) + (dy / (tileH/2)) <= 1.0) {
        return { tile, x, y };
      }
    }
    return null;
  }

  function pickTileAt2D(px, py) {
    const size = tileSize2D();
    const tx = Math.floor((px - ox) / size);
    const ty = Math.floor((py - oy) / size);
    if (tx<0||ty<0||tx>=W||ty>=H) return null;
    return { tile: map[ty][tx], x: tx, y: ty };
  }

  function heightAt(x,y) {
    if (x<0||y<0||x>=W||y>=H) return 0;
    return map[y][x].h;
  }

  // 光源固定: 左上 → 影は右下
  function drawShadowRD(x, y) {
    const h = map[y][x].h;
    const hRD = heightAt(x+1, y+1);
    if (h <= hRD) return;

    // 崖が強い場所は影を控えめに（浮遊防止）
    const dz = h - hRD;
    const { sx, sy } = toScreen(x, y, h);
    const off = dz * zStep * 0.55;

    ctx.fillStyle = `rgba(0,0,0,${0.16 + clamp(dz,1,4)*0.02})`;
    ctx.beginPath();
    ctx.moveTo(sx,           sy + tileH);
    ctx.lineTo(sx + tileW/2, sy + tileH/2);
    ctx.lineTo(sx + tileW/2 + off, sy + tileH/2 + off);
    ctx.lineTo(sx + off,          sy + tileH + off);
    ctx.closePath();
    ctx.fill();
  }

  // 坂/崖の方向判定（どっち側が低いか）
  function slopeInfo(x,y) {
    const h = map[y][x].h;
    const n = heightAt(x, y-1);
    const e = heightAt(x+1, y);
    const s = heightAt(x, y+1);
    const w = heightAt(x-1, y);

    const diffs = {
      N: h - n,
      E: h - e,
      S: h - s,
      W: h - w,
    };

    // 最大落差方向
    let dir = 'S';
    let dmax = diffs.S;
    for (const k of ['N','E','S','W']) {
      if (diffs[k] > dmax) { dmax = diffs[k]; dir = k; }
    }

    if (dmax >= 2) return { kind:'cliff', dir, dz:dmax };
    if (dmax === 1) return { kind:'slope', dir, dz:1 };
    return { kind:null, dir:null, dz:0 };
  }

  // タイル色
  function baseFill(t) {
    const z = t.h;
    switch (t.base) {
      case BASE.SEA:      return `rgb(${20+z},${60+z*2},${120+z*4})`;
      case BASE.LAKE:     return `rgb(${30+z},${90+z*2},${150+z*4})`;
      case BASE.GRASS:    return `rgb(${70+z*5},${150+z*6},${85+z*4})`;
      case BASE.FOREST:   return `rgb(${32+z*3},${95+z*4},${40+z*3})`;
      case BASE.MOUNTAIN: return `rgb(${110+z*5},${110+z*5},${120+z*5})`;
      default:            return `rgb(80,110,80)`;
    }
  }

  // タイル上の簡易テクスチャ（模様）
  function drawTopPattern(sx, sy, t) {
    if (t.base === BASE.FOREST) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      const r = Math.max(1.5, tileW*0.08);
      for (let i=-1;i<=1;i++) {
        ctx.beginPath();
        ctx.arc(sx + i*r*0.8, sy + tileH/2 + (i%2)*r*0.6, r, 0, Math.PI*2);
        ctx.fill();
      }
      return;
    }
    if (t.base === BASE.MOUNTAIN) {
      ctx.strokeStyle = 'rgba(20,20,20,0.35)';
      ctx.lineWidth = Math.max(1, tileW*0.03);
      ctx.beginPath();
      ctx.moveTo(sx - tileW*0.2, sy + tileH*0.45);
      ctx.lineTo(sx, sy + tileH*0.15);
      ctx.lineTo(sx + tileW*0.2, sy + tileH*0.45);
      ctx.stroke();
      ctx.lineWidth = 1;
      return;
    }
    if (t.base === BASE.LAKE || t.base === BASE.SEA) {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(1, tileW*0.02);
      ctx.beginPath();
      ctx.moveTo(sx - tileW*0.18, sy + tileH*0.55);
      ctx.lineTo(sx + tileW*0.18, sy + tileH*0.45);
      ctx.stroke();
      ctx.lineWidth = 1;
      return;
    }
  }

  function drawFarmlandOverlay(sx, sy, t) {
    const strength = clamp(t.farmland, 0, 1);
    const inset = tileW * 0.12;
    ctx.fillStyle = `rgba(${190+strength*40},${150+strength*30},${70+strength*50},${0.6+0.3*strength})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy + tileH*0.1);
    ctx.lineTo(sx + tileW/2 - inset, sy + tileH/2);
    ctx.lineTo(sx, sy + tileH - tileH*0.1);
    ctx.lineTo(sx - tileW/2 + inset, sy + tileH/2);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(110,80,30,0.45)';
    ctx.lineWidth = Math.max(1, tileW*0.02);
    ctx.beginPath();
    ctx.moveTo(sx - tileW/2 + inset, sy + tileH*0.35);
    ctx.lineTo(sx + tileW/2 - inset, sy + tileH*0.55);
    ctx.moveTo(sx - tileW/2 + inset, sy + tileH*0.55);
    ctx.lineTo(sx + tileW/2 - inset, sy + tileH*0.75);
    ctx.moveTo(sx - tileW*0.05, sy + tileH*0.25);
    ctx.lineTo(sx + tileW*0.05, sy + tileH*0.65);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  const riverEdgeMap = {
    N: [0,1],
    E: [1,2],
    S: [2,3],
    W: [3,0],
  };

  function riverEdgePoint(top, dir) {
    const idx = riverEdgeMap[dir];
    if (!idx) return null;
    return lerpPoint(top[idx[0]], top[idx[1]], 0.5);
  }

  function drawRiverOverlay(top, t) {
    const dirs = (t.riverDirs && t.riverDirs.length) ? t.riverDirs : [];
    if (!dirs.length) return;
    const center = {
      x: (top[0].x + top[1].x + top[2].x + top[3].x) / 4,
      y: (top[0].y + top[1].y + top[2].y + top[3].y) / 4,
    };
    const widthBase = Math.max(tileW*0.16, (t.riverWidth || 1) * tileW*0.12);
    const width = tinyDetailMode ? widthBase * 0.7 : widthBase;
    ctx.strokeStyle = 'rgba(40,140,220,0.92)';
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (dirs.length === 1) {
      const p = riverEdgePoint(top, dirs[0]);
      if (p) {
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(p.x, p.y);
      }
    } else {
      const first = riverEdgePoint(top, dirs[0]);
      if (first) {
        ctx.moveTo(first.x, first.y);
        ctx.lineTo(center.x, center.y);
      }
      for (let i=1;i<dirs.length;i++) {
        const p = riverEdgePoint(top, dirs[i]);
        if (!p) continue;
        ctx.lineTo(p.x, p.y);
        if (i !== dirs.length - 1) {
          ctx.moveTo(center.x, center.y);
        }
      }
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function drawRoadOverlay(top, x, y) {
    if (!showRoads || tinyDetailMode || tileW < 9) return;
    const tile = map[y][x];
    if (!tile.road) return;
    const center = {
      x: (top[0].x + top[1].x + top[2].x + top[3].x) / 4,
      y: (top[0].y + top[1].y + top[2].y + top[3].y) / 4,
    };
    const directions = [];
    for (const [dir, delta] of Object.entries(DIR_DELTA)) {
      const nx = x + delta.dx;
      const ny = y + delta.dy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      if (!map[ny][nx].road) continue;
      const pt = riverEdgePoint(top, dir);
      if (pt) directions.push(pt);
    }
    ctx.strokeStyle = tile.road >= 2 ? 'rgba(180,180,190,0.95)' : 'rgba(190,160,100,0.85)';
    ctx.lineWidth = Math.max(1, tileW*0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (!directions.length) {
      ctx.moveTo(center.x - tileW*0.15, center.y);
      ctx.lineTo(center.x + tileW*0.15, center.y);
    } else {
      for (const pt of directions) {
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function drawSnowcap(top) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(top[2].x, top[2].y);
    ctx.lineTo(top[3].x, top[3].y);
    ctx.closePath();
    ctx.fill();
  }

  function drawCivGlow(sx, sy, t) {
    if (!showCivOverlay || t.civ <= 0.05) return;
    const intensity = Math.min(1, t.civ / 20);
    const glow = 0.04 + intensity * 0.12;
    const inset = tileW * 0.16;
    ctx.fillStyle = `rgba(255,240,200,${glow})`;
    ctx.beginPath();
    ctx.moveTo(sx, sy + tileH*0.18);
    ctx.lineTo(sx + tileW/2 - inset, sy + tileH/2);
    ctx.lineTo(sx, sy + tileH - tileH*0.18);
    ctx.lineTo(sx - tileW/2 + inset, sy + tileH/2);
    ctx.closePath();
    ctx.fill();
  }

  function lerpPoint(a, b, t) {
    return { x: a.x + (b.x - a.x)*t, y: a.y + (b.y - a.y)*t };
  }

  function drawSelectionOutline(top) {
    ctx.strokeStyle = is2DMode ? 'rgba(255,230,80,0.85)' : 'rgba(255,235,120,0.95)';
    ctx.lineWidth = Math.max(1.4, tileW*0.05);
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i=1;i<top.length;i++) ctx.lineTo(top[i].x, top[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  const slopeEdgeMap = {
    N: { dx:0, dy:-1, ours:[0,1], theirs:[2,3] },
    S: { dx:0, dy:1, ours:[3,2], theirs:[1,0] },
    E: { dx:1, dy:0, ours:[1,2], theirs:[3,0] },
    W: { dx:-1, dy:0, ours:[0,3], theirs:[2,1] },
  };

  function drawSlopePlane(x, y, top, dir, dz) {
    const info = slopeEdgeMap[dir];
    if (!info) return;
    const nx = x + info.dx;
    const ny = y + info.dy;
    if (nx<0||ny<0||nx>=W||ny>=H) return;
    const neighborTop = tileVerticesAt(nx, ny);
    if (!neighborTop) return;
    const highA = top[info.ours[0]];
    const highB = top[info.ours[1]];
    const lowB = neighborTop[info.theirs[0]];
    const lowA = neighborTop[info.theirs[1]];
    const poly = [highA, highB, lowB, lowA];
    const towardsLight = dir === 'N' || dir === 'W';
    const grad = ctx.createLinearGradient(highA.x, highA.y, lowA.x, lowA.y);
    const light = 0.08 + dz*0.05;
    const dark = 0.18 + dz*0.06;
    grad.addColorStop(0, towardsLight ? `rgba(255,255,255,${light})` : `rgba(40,40,40,${light})`);
    grad.addColorStop(1, towardsLight ? `rgba(30,30,30,${dark})` : `rgba(0,0,0,${dark})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i=1;i<poly.length;i++) ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
    drawSlopeTexture(poly);
    ctx.restore();
  }

  function drawSlopeTexture(poly) {
    const lines = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = Math.max(1, tileW*0.018);
    for (let i=1;i<=lines;i++) {
      const t = i/(lines+1);
      const high = lerpPoint(poly[0], poly[1], t);
      const low = lerpPoint(poly[3], poly[2], t);
      ctx.beginPath();
      ctx.moveTo(high.x, high.y);
      ctx.lineTo(low.x, low.y);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
  }

  function drawVerticalFace(top, dir, dz) {
    if (dir === 'S') {
      ctx.fillStyle = 'rgb(22,22,26)';
      ctx.beginPath();
      ctx.moveTo(top[2].x, top[2].y);
      ctx.lineTo(top[3].x, top[3].y);
      ctx.lineTo(top[3].x, top[3].y + dz*zStep);
      ctx.lineTo(top[2].x, top[2].y + dz*zStep);
      ctx.closePath();
      ctx.fill();
    } else if (dir === 'E') {
      ctx.fillStyle = 'rgb(28,28,34)';
      ctx.beginPath();
      ctx.moveTo(top[1].x, top[1].y);
      ctx.lineTo(top[2].x, top[2].y);
      ctx.lineTo(top[2].x, top[2].y + dz*zStep);
      ctx.lineTo(top[1].x, top[1].y + dz*zStep);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 坂/崖テクスチャ（斜面っぽさ）
  function drawSlopeOrCliffTexture(sx, sy, info) {
    if (!info.kind) return;

    // 斜線は「低い方向」に向けて描く
    // N: 右上-左下, E: 左上-右下, S: 左上-右下(強め), W: 右上-左下(強め)
    const a = {x:sx, y:sy};
    const b = {x:sx+tileW/2, y:sy+tileH/2};
    const c = {x:sx, y:sy+tileH};
    const d = {x:sx-tileW/2, y:sy+tileH/2};

    if (info.kind === 'slope') {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = Math.max(1, tileW*0.03);
      ctx.beginPath();

      if (info.dir === 'S' || info.dir === 'E') {
        // \ 方向
        ctx.moveTo(d.x + (b.x-d.x)*0.25, d.y + (b.y-d.y)*0.25);
        ctx.lineTo(a.x + (c.x-a.x)*0.25, a.y + (c.y-a.y)*0.25);
        ctx.moveTo(d.x + (b.x-d.x)*0.55, d.y + (b.y-d.y)*0.55);
        ctx.lineTo(a.x + (c.x-a.x)*0.55, a.y + (c.y-a.y)*0.55);
      } else {
        // / 方向
        ctx.moveTo(b.x + (d.x-b.x)*0.25, b.y + (d.y-b.y)*0.25);
        ctx.lineTo(a.x + (c.x-a.x)*0.25, a.y + (c.y-a.y)*0.25);
        ctx.moveTo(b.x + (d.x-b.x)*0.55, b.y + (d.y-b.y)*0.55);
        ctx.lineTo(a.x + (c.x-a.x)*0.55, a.y + (c.y-a.y)*0.55);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      return;
    }

    if (info.kind === 'cliff') {
      // 崖は上面に濃いエッジ＋短いハッチ
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = Math.max(1, tileW*0.035);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = Math.max(1, tileW*0.03);
      ctx.beginPath();
      // 崖の方向側にだけハッチを寄せる
      for (let i=0;i<2;i++) {
        const t = 0.35 + i*0.22;
        if (info.dir === 'S') {
          ctx.moveTo(d.x + (c.x-d.x)*t, d.y + (c.y-d.y)*t);
          ctx.lineTo(d.x + (c.x-d.x)*t + tileW*0.12, d.y + (c.y-d.y)*t + tileH*0.12);
        } else if (info.dir === 'N') {
          ctx.moveTo(a.x + (b.x-a.x)*t, a.y + (b.y-a.y)*t);
          ctx.lineTo(a.x + (b.x-a.x)*t - tileW*0.12, a.y + (b.y-a.y)*t + tileH*0.12);
        } else if (info.dir === 'E') {
          ctx.moveTo(b.x + (c.x-b.x)*t, b.y + (c.y-b.y)*t);
          ctx.lineTo(b.x + (c.x-b.x)*t - tileW*0.12, b.y + (c.y-b.y)*t + tileH*0.12);
        } else {
          ctx.moveTo(d.x + (a.x-d.x)*t, d.y + (a.y-d.y)*t);
          ctx.lineTo(d.x + (a.x-d.x)*t + tileW*0.12, d.y + (a.y-d.y)*t + tileH*0.12);
        }
      }
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  // 都市アイコン
  function drawCityIcon(sx, sy, kind) {
    // 記号ベースで表現
    ctx.save();
    ctx.translate(sx, sy + tileH/2);

    if (kind === CITY.VILLAGE) {
      ctx.fillStyle = 'rgba(20,20,20,0.65)';
      ctx.fillRect(-2.5, -6, 5, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(-2, -5.5, 4, 4);
    } else if (kind === CITY.TOWN) {
      ctx.fillStyle = 'rgba(25,25,25,0.7)';
      ctx.fillRect(-3.5, -7, 7, 6);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(-3.5, -7, 7, 6);
    } else if (kind === CITY.WALLED) {
      ctx.strokeStyle = 'rgba(20,20,20,0.70)';
      ctx.lineWidth = 2;
      ctx.strokeRect(-4.5, -8, 9, 9);
      ctx.lineWidth = 1;
    } else if (kind === CITY.PLANNED) {
      ctx.strokeStyle = 'rgba(148,220,255,0.9)';
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(-3.5, -6, 7, 6);
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(148,220,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-3.5, -6, 7, 6);
    } else if (kind === CITY.CITY) {
      ctx.fillStyle = 'rgba(15,15,15,0.8)';
      ctx.fillRect(-5, -10, 10, 9);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(-5, -10, 10, 9);
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(3, -10);
      ctx.lineTo(0, -7);
      ctx.lineTo(-3, -10);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
    } else if (kind === CITY.CASTLE) {
      ctx.fillStyle = 'rgba(10,10,10,0.75)';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(6, -8);
      ctx.lineTo(0, -2);
      ctx.lineTo(-6, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(-1.5, -9, 3, 3);
    } else if (kind === CITY.CAPITAL) {
      ctx.fillStyle = 'rgba(8,8,8,0.80)';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(7, -10);
      ctx.lineTo(5, -2);
      ctx.lineTo(-5, -2);
      ctx.lineTo(-7, -10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,120,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(0, -14);
      ctx.lineTo(6, -8);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(255,235,180,0.35)';
      ctx.fillRect(-2, -11, 4, 4);
    }

    ctx.restore();
  }

  function drawCityAura(top, city) {
    if (tinyDetailMode || is2DMode) return;
    const cx = (top[0].x + top[1].x + top[2].x + top[3].x) / 4;
    const cy = (top[0].y + top[1].y + top[2].y + top[3].y) / 4;
    const radiusX = tileW * (city.megacity ? 2.1 : 1.4);
    const radiusY = tileH * (city.megacity ? 2.2 : 1.3);
    const grad = ctx.createRadialGradient(cx, cy, tileW*0.2, cx, cy, radiusX);
    grad.addColorStop(0, 'rgba(255,220,150,0.32)');
    grad.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function drawCityLabel2D(sx, sy, city, size) {
    if (!is2DMode || !showCityNames) return;
    if (size < 10 && !city.megacity) return;
    const name = city.name || (CITY_LABEL[city.kind] || '');
    if (!name) return;
    ctx.save();
    const fontSize = Math.max(10, size*0.4);
    ctx.font = `${fontSize}px 'Yu Gothic', system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const textY = sy + size + 2;
    const textX = sx + size/2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,20,20,0.9)';
    ctx.lineWidth = Math.max(2, fontSize * 0.15);
    ctx.strokeText(name, textX, textY);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(name, textX, textY);
    ctx.restore();
  }

  function drawTile2D(x, y, size) {
    const t = map[y][x];
    const { sx, sy } = toScreen2D(x, y);
    const compact2D = size < 9;
    const micro2D = size < 7;
    ctx.fillStyle = baseFill(t);
    ctx.fillRect(sx, sy, size, size);

    if (t.farmland > 0 && !isWaterBase(t.base)) {
      if (compact2D) {
        ctx.fillStyle = 'rgba(205,175,105,0.35)';
        ctx.fillRect(sx+1, sy+1, size-2, size-2);
      } else {
        drawFarmland2D(sx, sy, size, t);
      }
    }

    if (showCivOverlay && !micro2D && t.civ > 0.1 && !isWaterBase(t.base)) {
      drawCivOverlay2D(sx, sy, size, t);
    }

    if (t.river && !micro2D) {
      drawRiver2D(sx, sy, size, x, y, t);
    }

    if (showRoads && t.road && !compact2D) {
      drawRoad2D(sx, sy, size, x, y);
    }

    if (selectedTile && selectedTile.x === x && selectedTile.y === y) {
      drawSelection2D(sx, sy, size);
    }

    if (t.city) {
      const cityObj = (t.owner != null && cities[t.owner]) ? cities[t.owner] : null;
      drawCityIcon2D(sx, sy, size, cityObj ? cityObj.kind : t.city, cityObj);
      if (cityObj) return cityObj;
    }
    return null;
  }

  function drawMap2D() {
    const size = tileSize2D();
    const labelQueue = [];
    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const city = drawTile2D(x, y, size);
        if (city) labelQueue.push({ city, x, y });
      }
    }
    if (showCityNames && labelQueue.length) {
      labelQueue.sort((a,b)=> (a.city.kind === CITY.CAPITAL ? -1 : 0) - (b.city.kind === CITY.CAPITAL ? -1 : 0));
      for (const entry of labelQueue) {
        const { sx, sy } = toScreen2D(entry.x, entry.y);
        drawCityLabel2D(sx, sy, entry.city, size);
      }
    }
  }

    function buildCityPath(line) {
      if (!Number.isFinite(line.cityAId) || !Number.isFinite(line.cityBId)) return null;
      const cityA = cities[line.cityAId];
      const cityB = cities[line.cityBId];
      if (!cityA || !cityB) return null;
      return [
        { x: cityA.x, y: cityA.y },
        { x: cityB.x, y: cityB.y },
      ];
    }

    function getTrafficLines() {
      const result = [];
      const lines = getHorsecarLines();
      lines.forEach(line => {
        const path = Array.isArray(line.path) && line.path.length >= 2 ? line.path : buildCityPath(line);
        if (!path || path.length < 2) return;
        result.push({
          ...line,
          path,
          weight: Math.max(1, Math.min(6, line.demand || 1)),
        });
      });
      if (result.length < 4) {
        const fallback = getTopCities(6);
        for (let i = 0; i < fallback.length - 1 && result.length < 6; i++) {
          const cityA = fallback[i];
          const cityB = fallback[i + 1];
          if (!cityA || !cityB) continue;
          result.push({
            path: [
              { x: cityA.x, y: cityA.y },
              { x: cityB.x, y: cityB.y },
            ],
            weight: 1.2,
            demand: 1.2,
          });
        }
      }
      return result;
    }

    function drawRailPath(ctx, path, weight = 1, preview = false) {
      if (!Array.isArray(path) || path.length < 2) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.3 + weight * 0.8;
      const baseAlpha = preview ? 0.65 : 0.25;
      ctx.strokeStyle = preview
        ? 'rgba(255,180,100,0.95)'
        : `rgba(255, 210, 120, ${baseAlpha + Math.min(0.65, weight / 6)})`;
      ctx.setLineDash(preview ? [6, 6] : []);
      const size = tileSize2D();
      ctx.beginPath();
      path.forEach((pt, idx) => {
        const { sx, sy } = toScreen2D(pt.x, pt.y);
        const cx = sx + size / 2;
        const cy = sy + size / 2;
        if (idx === 0) {
          ctx.moveTo(cx, cy);
        } else {
          ctx.lineTo(cx, cy);
        }
      });
      ctx.stroke();
      if (!preview) {
        ctx.fillStyle = 'rgba(255, 200, 140, 0.9)';
        [path[0], path[path.length - 1]].forEach(point => {
          if (!point) return;
          const { sx, sy } = toScreen2D(point.x, point.y);
          const cx = sx + size / 2;
          const cy = sy + size / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 3 + weight * 0.4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();
    }

    function drawTrafficOverlay() {
      if (!showTrafficOverlay || !is2DMode) return;
      const flows = getTrafficLines();
      if (!flows.length && (!railDraft || railDraft.points.length < 2)) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      flows.forEach(flow => {
        drawRailPath(ctx, flow.path, flow.weight);
      });
      if (railDraft && railDraft.points.length >= 2) {
        drawRailPath(ctx, railDraft.points, 2, true);
      }
      ctx.restore();
    }

  function drawFarmland2D(sx, sy, size, tile) {
    const strength = clamp(tile.farmland, 0, 1);
    ctx.fillStyle = `rgba(${200+strength*45},${170+strength*30},${90+strength*40},${0.35+strength*0.4})`;
    ctx.fillRect(sx+1, sy+1, size-2, size-2);
    ctx.strokeStyle = 'rgba(120,90,40,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy + size*0.35);
    ctx.lineTo(sx + size, sy + size*0.5);
    ctx.moveTo(sx, sy + size*0.6);
    ctx.lineTo(sx + size, sy + size*0.75);
    ctx.stroke();
  }

  function drawRiver2D(sx, sy, size, x, y, tile) {
    const cx = sx + size/2;
    const cy = sy + size/2;
    ctx.strokeStyle = 'rgba(35,120,210,0.92)';
    ctx.lineWidth = Math.max(1.2, size * 0.22 * (tile.riverWidth || 1));
    ctx.lineCap = 'round';
    ctx.beginPath();
    const dirs = tile.riverDirs && tile.riverDirs.length ? tile.riverDirs : [];
    if (!dirs.length) {
      ctx.moveTo(sx, cy);
      ctx.lineTo(sx + size, cy);
    } else {
      for (const dir of dirs) {
        const edge = edgePoint2D(sx, sy, size, dir);
        if (!edge) continue;
        ctx.moveTo(cx, cy);
        ctx.lineTo(edge.x, edge.y);
      }
    }
    ctx.stroke();
  }

  function edgePoint2D(sx, sy, size, dir) {
    switch (dir) {
      case 'N': return { x: sx + size/2, y: sy };
      case 'S': return { x: sx + size/2, y: sy + size };
      case 'E': return { x: sx + size, y: sy + size/2 };
      case 'W': return { x: sx, y: sy + size/2 };
      default: return null;
    }
  }

  function drawRoad2D(sx, sy, size, x, y) {
    const cx = sx + size/2;
    const cy = sy + size/2;
    const tile = map[y][x];
    ctx.strokeStyle = tile.road >= 2 ? 'rgba(160,160,170,0.95)' : 'rgba(200,170,120,0.95)';
    ctx.lineWidth = Math.max(1, size * 0.18);
    ctx.lineCap = 'round';
    ctx.beginPath();
    let any = false;
    for (const [dir, delta] of Object.entries(DIR_DELTA)) {
      const nx = x + delta.dx;
      const ny = y + delta.dy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      if (!map[ny][nx].road) continue;
      const edge = edgePoint2D(sx, sy, size, dir);
      if (!edge) continue;
      ctx.moveTo(cx, cy);
      ctx.lineTo(edge.x, edge.y);
      any = true;
    }
    if (!any) {
      ctx.moveTo(sx + size*0.2, cy);
      ctx.lineTo(sx + size*0.8, cy);
    }
    ctx.stroke();
  }

  function drawCivOverlay2D(sx, sy, size, tile) {
    const intensity = Math.min(1, tile.civ / 18);
    ctx.fillStyle = `rgba(255,240,210,${0.15 + intensity*0.25})`;
    ctx.fillRect(sx+1, sy+1, size-2, size-2);
  }

  function drawSelection2D(sx, sy, size) {
    ctx.strokeStyle = 'rgba(255,235,120,0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx+1, sy+1, size-2, size-2);
    ctx.lineWidth = 1;
  }

  function drawCityIcon2D(sx, sy, size, kind, cityObj) {
    ctx.save();
    ctx.translate(sx + size/2, sy + size/2);
    const r = Math.max(2.5, size*0.25);
    ctx.fillStyle = 'rgba(20,20,20,0.8)';
    switch (kind) {
      case CITY.VILLAGE:
        ctx.beginPath();
        ctx.arc(0, 0, r*0.6, 0, Math.PI*2);
        ctx.fill();
        break;
      case CITY.PLANNED:
        ctx.strokeStyle = 'rgba(148,220,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(148,220,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, r*0.6, 0, Math.PI*2);
        ctx.stroke();
        break;
      case CITY.TOWN:
        ctx.fillRect(-r*0.7, -r*0.7, r*1.4, r*1.4);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(-r*0.7, -r*0.7, r*1.4, r*1.4);
        break;
      case CITY.WALLED:
        ctx.strokeStyle = 'rgba(230,210,180,0.9)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-r, -r, r*2, r*2);
        break;
      case CITY.CITY:
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(-r, -r, r*2, r*2);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-r, -r, r*2, r*2);
        break;
      case CITY.CASTLE:
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, r);
        ctx.lineTo(-r, r);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.stroke();
        break;
      case CITY.CAPITAL:
        ctx.beginPath();
        for (let i=0;i<5;i++) {
          const angle = (Math.PI*2/5)*i - Math.PI/2;
          const radius = i%2===0 ? r*1.1 : r*0.5;
          const px = Math.cos(angle)*radius;
          const py = Math.sin(angle)*radius;
          if (!i) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,220,150,0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      default:
        ctx.fillRect(-r*0.5, -r*0.5, r, r);
        break;
    }
    if (cityObj && cityObj.megacity) {
      ctx.strokeStyle = 'rgba(255,200,120,0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, r*1.6, 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- 生成 ---
  function generate() {
    resetWorldState();
    const seed = (Date.now() ^ (Math.random()*1e9)) | 0;
    currentSeed = seed;
    const rand = mulberry32(seed);
    const noise = makeValueNoise(rand);

    // 1) 高さ生成（島っぽくする: 端ほど沈む）
    const seaLevel = 0.32; // 低いほど陸が増える

    // 山のピークを数個置く
    const peaks = Array.from({length: 6}, () => ({
      x: Math.floor(rand()*W),
      y: Math.floor(rand()*H),
      r: 14 + Math.floor(rand()*28),
      p: 0.45 + rand()*0.55,
    }));

    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const tile = map[y][x];
        const nx = x / (W-1);
        const ny = y / (H-1);

        // fBmで大地のうねり
        let e = fbm(noise, nx*2.4, ny*2.4, 5);

        // 島化（端ほどマイナス）
        const dx = (nx-0.5), dy = (ny-0.5);
        const dist = Math.sqrt(dx*dx + dy*dy);
        e -= clamp((dist-0.25) * 1.1, 0, 1);

        // 山（ガウス的に盛る）
        let m = 0;
        for (const pk of peaks) {
          const ddx = x - pk.x;
          const ddy = y - pk.y;
          const d = Math.sqrt(ddx*ddx + ddy*ddy);
          const add = pk.p * Math.exp(-(d*d)/(2*pk.r*pk.r));
          m = Math.max(m, add);
        }
        e += m * 0.75;

        e = clamp(e, 0, 1);

        // 高さ段（0..maxZ）
        let h = Math.floor((e - seaLevel) * (maxZ+2));
        h = clamp(h, -2, maxZ);

        // 水は 0 以下に固定
        tile.river = false;
        tile.riverWidth = 0;
        tile.riverDirs = [];
        tile.snow = false;
        tile.farmland = 0;
        tile.civ = 0;
        tile.road = 0;
        tile.manualRoad = false;
        tile.owner = null;
        tile.nodeId = null;

        if (h <= 0) {
          tile.h = 0;
          tile.base = BASE.SEA;
        } else {
          tile.h = h;
          tile.base = BASE.GRASS;
        }

        tile.city = null;
      }
    }

    softenTerrain(2);
    flattenCenter(rand);

    // 2) 湖を作る（内陸の低地を選び、そこから広げる）
    // 候補: 海ではない、かつ高さ1-2の場所
    const lakeSeeds = [];
    for (let i=0;i<60;i++) {
      const x = Math.floor(rand()*W);
      const y = Math.floor(rand()*H);
      if (map[y][x].base !== BASE.SEA && map[y][x].h <= 2) lakeSeeds.push({x,y});
    }

    // 2〜4個の湖を拡張
    const lakeCount = 2 + Math.floor(rand()*3);
    for (let i=0;i<lakeCount && lakeSeeds.length;i++) {
      const s = lakeSeeds[Math.floor(rand()*lakeSeeds.length)];
      const targetSize = 180 + Math.floor(rand()*240);
      floodFillLake(s.x, s.y, targetSize, rand);
    }

    // 3) 森・山判定（高さ＆湿り気）
    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const t = map[y][x];
        if (t.base === BASE.SEA || t.base === BASE.LAKE) continue;

        const nx = x/(W-1), ny = y/(H-1);
        const moist = fbm(noise, nx*5.5 + 10.0, ny*5.5 + 10.0, 3);

        // 高地は山
        if (t.h >= 7) {
          t.base = BASE.MOUNTAIN;
          continue;
        }

        // 森は湿り気＋中低地
        if (t.h >= 2 && t.h <= 6 && moist > 0.52) {
          t.base = BASE.FOREST;
        }
      }
    }

    // 4) 雪線と海岸・水系・文明
    markSnow(rand);
    smoothCoast();
    generateRivers(rand);

    // 5) 都市・道路・文明・田園
    generateCities(rand);
    buildRoadNetwork(cities, rand);
    assignCityRelations(rand);
    refreshCivilization(60, rand);
    simulateOneTurn();
    worldReady = true;
    globalFunds = 3000;
    selectedTile = null;
    lastTileInfo = null;
    updateTileInfo(null);
    recenterView(true);
    pendingCapitalSelection = false;
    pendingDevelopment = false;
    pendingRoadMode = false;
    updateControlButtons();
    resetChunkStore();
  }

  function softenTerrain(iterations=2) {
    for (let pass=0; pass<iterations; pass++) {
      const copy = map.map(row => row.map(tile => tile.h));
      for (let y=0;y<H;y++) {
        for (let x=0;x<W;x++) {
          const tile = map[y][x];
          if (tile.base === BASE.SEA) continue;
          let sum = 0;
          let weight = 0;
          for (let dy=-1; dy<=1; dy++) {
            for (let dx=-1; dx<=1; dx++) {
              const nx = x+dx, ny = y+dy;
              if (nx<0||ny<0||nx>=W||ny>=H) continue;
              const neighbor = map[ny][nx];
              if (neighbor.base === BASE.SEA) continue;
              const w = (dx===0 && dy===0) ? 1.5 : 1.0;
              sum += copy[ny][nx] * w;
              weight += w;
            }
          }
          if (!weight) continue;
          const avg = sum / weight;
          const blended = copy[y][x]*0.55 + avg*0.45;
          tile.h = Math.max(1, Math.min(maxZ, Math.round(blended)));
        }
      }
    }
  }

  function flattenCenter(rand) {
    const cx = (W-1)/2;
    const cy = (H-1)/2;
    const maxR = Math.min(W,H) * 0.32;
    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const tile = map[y][x];
        if (tile.base === BASE.SEA || tile.base === BASE.LAKE) continue;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const influence = clamp(1 - dist/maxR, 0, 1);
        if (influence <= 0) continue;
        const jitter = rand()*0.6;
        const drop = (2.2 + jitter) * influence;
        if (drop <= 0) continue;
        tile.h = Math.max(1, Math.round(tile.h - drop));
        if (tile.h <= 3) tile.base = BASE.GRASS;
      }
    }
  }

  function floodFillLake(sx, sy, limit, rand) {
    const q = [{x:sx,y:sy}];
    const seen = new Set([sx+','+sy]);
    let placed = 0;

    while (q.length && placed < limit) {
      const i = Math.floor(rand()*q.length);
      const cur = q.splice(i,1)[0];
      const {x,y} = cur;
      if (x<0||y<0||x>=W||y>=H) continue;
      const t = map[y][x];

      // 海は湖にしない
      if (t.base === BASE.SEA) continue;

      // 高いところは避ける
      if (t.h >= 3) continue;

      // 湖にする
      t.h = 0;
      t.base = BASE.LAKE;
      placed++;

      // 周囲に拡張（ランダムウォーク風）
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = x+dx, ny = y+dy;
        const k = nx+','+ny;
        if (!seen.has(k)) {
          seen.add(k);
          q.push({x:nx,y:ny});
        }
      }
    }
  }

  function smoothCoast() {
    // 1回だけ軽く: 周囲の海が多い陸(高さ1)を海に、陸が多い海を陸に
    const copy = map.map(row => row.map(t => ({...t})));

    function isWater(b) { return b===BASE.SEA || b===BASE.LAKE; }

    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const t = copy[y][x];
        let waterN=0, landN=0;
        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx=x+dx, ny=y+dy;
          if (nx<0||ny<0||nx>=W||ny>=H) { waterN++; continue; }
          if (isWater(copy[ny][nx].base)) waterN++; else landN++;
        }

        if (t.base===BASE.GRASS && t.h<=1 && waterN>=4) {
          map[y][x].h=0; map[y][x].base=BASE.SEA;
        }
        if (t.base===BASE.SEA && landN>=4) {
          map[y][x].h=1; map[y][x].base=BASE.GRASS;
        }
      }
    }
  }

  function isWaterBase(b) { return b===BASE.SEA || b===BASE.LAKE; }

  function isWetTile(t) { return isWaterBase(t.base) || t.river; }

  function nearWater(x,y, r=2) {
    for (let dy=-r;dy<=r;dy++) for (let dx=-r;dx<=r;dx++) {
      const nx=x+dx, ny=y+dy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      if (isWetTile(map[ny][nx])) return true;
    }
    return false;
  }

  const DIR_DELTA = {
    N: {dx:0, dy:-1},
    E: {dx:1, dy:0},
    S: {dx:0, dy:1},
    W: {dx:-1, dy:0},
  };

  function dirFromDelta(dx, dy) {
    if (dx === 0 && dy === -1) return 'N';
    if (dx === 1 && dy === 0) return 'E';
    if (dx === 0 && dy === 1) return 'S';
    if (dx === -1 && dy === 0) return 'W';
    return null;
  }

  function oppositeDir(dir) {
    switch (dir) {
      case 'N': return 'S';
      case 'S': return 'N';
      case 'E': return 'W';
      case 'W': return 'E';
      default: return null;
    }
  }

  function addRiverDir(tile, dir) {
    if (!dir) return;
    if (!tile.riverDirs) tile.riverDirs = [];
    if (!tile.riverDirs.includes(dir)) tile.riverDirs.push(dir);
  }

  function moveCost(x, y, nx, ny) {
    if (nx<0||ny<0||nx>=W||ny>=H) return Infinity;
    const tile = map[ny][nx];
    if (isWaterBase(tile.base)) return Infinity;
    let cost = 1;
    if (tile.farmland > 0) {
      cost = 1;
    } else if (tile.base === BASE.GRASS) {
      cost = tile.h >= 5 ? 4 : 1;
    } else if (tile.base === BASE.FOREST) {
      cost = 2;
    } else if (tile.base === BASE.MOUNTAIN) {
      cost = 7;
    }
    if (tile.snow) cost = Math.max(cost, 9);
    const h0 = heightAt(x,y);
    const h1 = heightAt(nx,ny);
    const dz = Math.abs(h0 - h1);
    if (dz >= 2) return Infinity;
    if (dz === 1) cost += 2;
    return cost;
  }

  function heuristic(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function findPath(start, goal) {
    if (start.x === goal.x && start.y === goal.y) return [{x:start.x,y:start.y}];
    const gScore = Array.from({length:H}, ()=>Array(W).fill(Infinity));
    const came = new Map();
    const open = [];
    const closed = new Set();
    gScore[start.y][start.x] = 0;
    open.push({x:start.x,y:start.y,f:heuristic(start.x,start.y,goal.x,goal.y)});

    while (open.length) {
      open.sort((a,b)=>a.f-b.f);
      const current = open.shift();
      const key = current.x+','+current.y;
      if (closed.has(key)) continue;
      closed.add(key);
      if (current.x === goal.x && current.y === goal.y) {
        const path = [];
        let ck = key;
        while (ck) {
          const [cx, cy] = ck.split(',').map(Number);
          path.push({x:cx, y:cy});
          ck = came.get(ck);
        }
        return path.reverse();
      }
      for (const dir of Object.values(DIR_DELTA)) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        if (nx<0||ny<0||nx>=W||ny>=H) continue;
        const cost = moveCost(current.x, current.y, nx, ny);
        if (!isFinite(cost)) continue;
        const tentative = gScore[current.y][current.x] + cost;
        if (tentative < gScore[ny][nx]) {
          gScore[ny][nx] = tentative;
          came.set(nx+','+ny, key);
          open.push({x:nx, y:ny, f: tentative + heuristic(nx,ny,goal.x,goal.y)});
        }
      }
    }
    return null;
  }

  function markRoadPath(path) {
    if (!path || path.length < 2) return;
    for (const node of path) {
      const tile = map[node.y][node.x];
      tile.road = 1;
    }
  }

  function roadConnectionsAt(x,y) {
    let count = 0;
    for (const dir of Object.values(DIR_DELTA)) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      if (nx<0||ny<0||nx>=W||ny>=H) continue;
      if (map[ny][nx].road) count++;
    }
    return count;
  }

  function hasRoadNearby(x,y) {
    if (map[y][x].road) return true;
    for (let dy=-1;dy<=1;dy++) {
      for (let dx=-1;dx<=1;dx++) {
        if (!dx && !dy) continue;
        const nx=x+dx, ny=y+dy;
        if (nx<0||ny<0||nx>=W||ny>=H) continue;
        if (map[ny][nx].road) return true;
      }
    }
    return false;
  }

  function buildRoadNetwork(cityList, rand) {
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
      map[y][x].road = 0;
      map[y][x].manualRoad = false;
    }
    if (!cityList.length) return;
    const capital = cityList.find(c=>c.kind===CITY.CAPITAL) || cityList[0];
    const connected = new Set([capital.id]);
    const order = [...cityList].sort((a,b)=>{
      const rank = (kind)=>{
        switch(kind) {
          case CITY.CAPITAL: return 5;
          case CITY.CASTLE: return 4;
          case CITY.CITY: return 3;
          case CITY.WALLED: return 2;
          case CITY.TOWN: return 1;
          default: return 0;
        }
      };
      return rank(b.kind) - rank(a.kind);
    });

    for (const city of order) {
      if (connected.has(city.id)) continue;
      const targets = Array.from(connected).map(id => cityList[id])
        .sort((a,b)=>heuristic(city.x,city.y,a.x,a.y)-heuristic(city.x,city.y,b.x,b.y));
      for (const target of targets) {
        const path = findPath({x:city.x,y:city.y}, {x:target.x,y:target.y});
        if (path) {
          markRoadPath(path);
          connected.add(city.id);
          break;
        }
      }
      if (!connected.has(city.id)) connected.add(city.id);
    }

    const pairDone = new Set();
    for (const city of cityList) {
      const neighbors = [...cityList]
        .filter(c=>c.id!==city.id)
        .sort((a,b)=>heuristic(city.x,city.y,a.x,a.y)-heuristic(city.x,city.y,b.x,b.y))
        .slice(0,3);
      for (const other of neighbors) {
        const key = city.id < other.id ? `${city.id}-${other.id}` : `${other.id}-${city.id}`;
        if (pairDone.has(key)) continue;
        pairDone.add(key);
        const dist = heuristic(city.x,city.y,other.x,other.y);
        if (dist > 40) continue;
        if (rand() < 0.3 && dist > 18) continue;
        const path = findPath({x:city.x,y:city.y}, {x:other.x,y:other.y});
        if (path) markRoadPath(path);
      }
    }
  }

  function isFlat(x,y) {
    const h = heightAt(x,y);
    // 平地: 自分が1〜3、隣との差が小さい
    if (h < 1 || h > 3) return false;
    const n = heightAt(x,y-1), e = heightAt(x+1,y), s = heightAt(x,y+1), w = heightAt(x-1,y);
    return Math.max(Math.abs(h-n),Math.abs(h-e),Math.abs(h-s),Math.abs(h-w)) <= 1;
  }

  function generateCities(rand) {
    cities.length = 0;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
      map[y][x].city = null;
      map[y][x].owner = null;
      map[y][x].nodeId = null;
    }

    const candidates = [];
    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const t = map[y][x];
        if (isWaterBase(t.base)) continue;
        if (!isFlat(x,y)) continue;
        if (t.base === BASE.MOUNTAIN) continue;
        let score = 0;
        score += 4;
        if (nearWater(x,y,2)) score += 3;
        if (t.base === BASE.GRASS) score += 2;
        if (t.base === BASE.FOREST) score -= 1;
        score -= Math.max(0, t.h-2);
        score += rand()*1.5;
        candidates.push({x,y,score});
      }
    }

    candidates.sort((a,b)=>b.score-a.score);
    const placed = [];

    function farEnough(x,y,minDist) {
      for (const p of placed) {
        const dx = x - p.x;
        const dy = y - p.y;
        if (dx*dx + dy*dy < minDist*minDist) return false;
      }
      return true;
    }

    function addCity(x,y,kind) {
      const city = addCityRecord(x,y,kind, rand);
      placed.push({x,y,kind,id:city.id});
      return city;
    }

    // capital selection
    const centerLimit = (W+H)/5;
    let capitalCandidate = null;
    for (const c of candidates) {
      const centerDist = Math.abs(c.x - W/2) + Math.abs(c.y - H/2);
      if (nearWater(c.x,c.y,3) && centerDist < centerLimit) {
        capitalCandidate = c;
        break;
      }
    }
    if (!capitalCandidate && candidates.length) capitalCandidate = candidates[0];
    if (capitalCandidate) addCity(capitalCandidate.x, capitalCandidate.y, CITY.CAPITAL);

    // castles
    let castles = 2 + Math.floor(rand()*2);
    for (const c of candidates) {
      if (!castles) break;
      if (map[c.y][c.x].city) continue;
      if (!farEnough(c.x,c.y,16)) continue;
      addCity(c.x,c.y,CITY.CASTLE);
      castles--;
    }

    // major cities
    let bigCities = 2 + Math.floor(rand()*2);
    for (const c of candidates) {
      if (!bigCities) break;
      if (map[c.y][c.x].city) continue;
      if (!farEnough(c.x,c.y,14)) continue;
      if (!nearWater(c.x,c.y,3)) continue;
      addCity(c.x,c.y,CITY.CITY);
      bigCities--;
    }

    // walled cities
    let walled = 6 + Math.floor(rand()*4);
    for (const c of candidates) {
      if (!walled) break;
      if (map[c.y][c.x].city) continue;
      if (!farEnough(c.x,c.y,10)) continue;
      addCity(c.x,c.y,CITY.WALLED);
      walled--;
    }

    // towns
    let towns = 12 + Math.floor(rand()*6);
    for (const c of candidates) {
      if (!towns) break;
      if (map[c.y][c.x].city) continue;
      if (!farEnough(c.x,c.y,7)) continue;
      let nearStronghold = false;
      for (const p of placed) {
        const dx=c.x-p.x, dy=c.y-p.y;
        if (dx*dx+dy*dy < 20*20 && (p.kind===CITY.CASTLE || p.kind===CITY.CAPITAL || p.kind===CITY.CITY)) {
          nearStronghold = true;
          break;
        }
      }
      if (!nearStronghold && rand() < 0.4) continue;
      addCity(c.x,c.y,CITY.TOWN);
      towns--;
    }

    // villages
    let villages = 24 + Math.floor(rand()*12);
    for (const c of candidates) {
      if (!villages) break;
      if (map[c.y][c.x].city) continue;
      if (!farEnough(c.x,c.y,5)) continue;
      if (!nearWater(c.x,c.y,3) && rand() < 0.65) continue;
      addCity(c.x,c.y,CITY.VILLAGE);
      villages--;
    }
    return cities;
  }

  function getCityStatusText(delta) {
    if (delta > 50) return '急成長';
    if (delta > 20) return '成長';
    if (delta > 5) return '微増';
    if (delta < -50) return '急減';
    if (delta < -20) return '減少';
    if (delta < -5) return '微減';
    return '停滞';
  }

  function updateTileInfo(pick) {
    if (!tileInfoEl) return;
    if (!pick || pick.x == null || pick.y == null) {
      lastTileInfo = null;
      tileInfoEl.textContent = 'タイルをクリックすると情報が表示されます';
      return;
    }
    const { x, y } = pick;
    const tile = pick.tile || map[y][x];
    lastTileInfo = { x, y };
    const baseLabel = BASE_LABEL[tile.base] || tile.base;
    const snowLabel = tile.snow ? 'あり' : 'なし';
    let waterLabel = 'なし';
    if (tile.base === BASE.SEA) waterLabel = '海';
    else if (tile.base === BASE.LAKE) waterLabel = '湖';
    else if (tile.river) waterLabel = '河川';
    const owningCity = (tile.owner != null && cities[tile.owner]) ? cities[tile.owner] : null;
    const tileCity = owningCity || (tile.city ? { name: null, kind: tile.city } : null);
    const cityLabel = tile.city ? (CITY_LABEL[tile.city] || tile.city) : 'なし';
    const cityName = tileCity ? tileCity.name : null;
    const farmland = Math.round(tile.farmland * 100);
    const civ = Math.round(tile.civ);
    const roadLabel = tile.road ? `有（接続:${roadConnectionsAt(x,y)}）` : 'なし';
    const ownerInfo = owningCity ? `${owningCity.name}（${CITY_LABEL[owningCity.kind] || owningCity.kind}）` : 'なし';
    const dist = cityDistanceField ? cityDistanceField[y][x] : null;
    const distLabel = dist!=null&&isFinite(dist)?`${dist}`:'-';
    let citySection = '';
    if (owningCity) {
      const popLine = `<span class="info-link" data-action="toggle-city-detail" data-city="${owningCity.id}">人口: 約${Math.round(owningCity.pop)}人</span>`;
      let detailBlock = '';
      if (showCityStats && detailCityId === owningCity.id) {
        const status = getCityStatusText(owningCity.lastDelta);
        detailBlock = `
          <div style="margin-top:4px;">
            状態: <b>${status}</b> (${owningCity.lastDelta > 0 ? '+' : ''}${Math.round(owningCity.lastDelta)})<br>
            食料: ${owningCity.food.toFixed(1)} / 富: ${owningCity.wealth.toFixed(1)}<br>
            裕福度: ${owningCity.prosperity.toFixed(1)} / 安定度: ${Math.round(owningCity.stability)}<br>
            軍事度: ${Math.round(owningCity.military)}
          </div>`;
      }
      const relationText = formatRelationSummary(owningCity);
      citySection = `
        <div class="city-detail">
          <b>${owningCity.name}</b>（${CITY_LABEL[owningCity.kind] || owningCity.kind}）<br>
          ${popLine} / 影響核: ${Math.round(owningCity.civCore)}<br>
          裕福度: ${owningCity.prosperity.toFixed(1)} / 安定度: ${Math.round(owningCity.stability)}<br>
          軍事度: ${Math.round(owningCity.military)} / 道路接続: ${roadConnectionsAt(owningCity.x, owningCity.y)}<br>
          ${relationText ? `関係: ${relationText}<br>` : ''}
          ${detailBlock}
        </div>`;
    }
    tileInfoEl.innerHTML = `
      <b>座標</b>: (${x}, ${y})<br>
      <b>高さ</b>: ${tile.h}<br>
      <b>地形</b>: ${baseLabel}<br>
      <b>積雪</b>: ${snowLabel}<br>
      <b>水系</b>: ${waterLabel}<br>
      <b>道路</b>: ${roadLabel}<br>
      <b>田園</b>: ${farmland}%<br>
      <b>文明度</b>: ${civ}<br>
      <b>都市</b>: ${tile.city ? `${cityName ? cityName + ' / ' : ''}${cityLabel}` : 'なし'}<br>
      <b>所有</b>: ${ownerInfo}<br>
      <b>都市距離</b>: ${distLabel}
      ${citySection}`;
  }

  function handleTileClick(e) {
    if (appState !== 'map' || !worldReady) return;
    const pos = eventToCanvasCoords(e);
    const pick = pickTileAt(pos.x, pos.y);
    if (!pick) {
      selectedTile = null;
      updateTileInfo(null);
      render();
      return;
    }
    if (pendingCapitalSelection) {
      if (pick.tile && pick.tile.owner != null && cities[pick.tile.owner]) {
        const city = cities[pick.tile.owner];
        if (designateCapital(city)) {
          selectedTile = { x: pick.x, y: pick.y };
          lastTileInfo = { x: pick.x, y: pick.y };
          tileInfoEl.textContent = `${city.name} を新たな王都に指定しました`;
          pendingCapitalSelection = false;
          refreshAfterCityChange(true);
        } else {
          tileInfoEl.textContent = '既に王都に指定されています';
        }
      } else {
        tileInfoEl.textContent = '王都候補として都市タイルを選択してください';
      }
      return;
    }
    if (pendingDevelopment) {
      const created = createFrontierVillage(pick.x, pick.y, Math.random);
      if (created) {
        selectedTile = { x: pick.x, y: pick.y };
        lastTileInfo = { x: pick.x, y: pick.y };
        tileInfoEl.textContent = `${created.name} を開拓しました`;
        pendingDevelopment = false;
        refreshAfterCityChange(true);
      } else {
        tileInfoEl.textContent = '開拓できる平地（河川・道路近傍）を選択してください';
      }
      return;
    }
    if (pendingRailMode) {
      handleRailModeTile(pick);
      return;
    }
    if (pendingRoadMode) {
      if (!pick.tile) return;
      const tile = pick.tile;
      if (isWaterBase(tile.base)) {
        tileInfoEl.textContent = '水上には道路を敷設できません';
        return;
      }
      // 既存道路があるか、隣接に道路/都市があるか（延伸チェック）
      const hasRoad = tile.road > 0;
      const nearby = hasRoadNearby(pick.x, pick.y) || tile.city;
      
      if (!hasRoad && !nearby) {
        tileInfoEl.textContent = '既存の道路や都市に隣接する場所から伸ばしてください';
        return;
      }

      const cost = 10;
      if (globalFunds < cost) {
        tileInfoEl.textContent = '資金が足りません';
        return;
      }

      globalFunds -= cost;
      tile.road = (tile.road || 0) + 1;
      tile.manualRoad = true;
      if (tile.road > 2) tile.road = 2; // Max level 2
      
      markMapDirty();
      updateHudStats();
      tileInfoEl.textContent = `道路を${tile.road === 1 ? '建設' : '強化'}しました (残資金: ${Math.floor(globalFunds)})`;
      render();
      return;
    }
    selectedTile = { x: pick.x, y: pick.y };
    if (isStoryMode && !storyFlags.firstCityInspect && pick.tile && pick.tile.owner != null && cities[pick.tile.owner]) {
      storyFlags.firstCityInspect = true;
      showFirstCityInspectOverlay(cities[pick.tile.owner]);
    }
    updateTileInfo(pick);
    render();
  }

  function handleRailModeTile(pick) {
    if (!pick || !pick.tile) return;
    const clickPoint = { x: pick.x, y: pick.y };
    const snapped = snapToRailNode(clickPoint);
    const point = (!railDraft && snapped) ? snapped : clickPoint;
    if (!railDraft) {
      startRailDraft(point);
      return;
    }
    addRailDraftPoint(point);
  }

  function startRailDraft(point) {
    railDraft = { points: [], demand: getRailOverlayDemand() };
    if (point) {
      railDraft.points.push(point);
    }
    updateRailOverlayStatus('路線描画を開始しました。地図上をクリックして線を伸ばしてください。');
    updateRailOverlayControls();
    render();
  }

  function addRailDraftPoint(point) {
    if (!railDraft) return;
    const last = railDraft.points[railDraft.points.length - 1];
    if (last && last.x === point.x && last.y === point.y) return;
    railDraft.points.push(point);
    updateRailOverlayStatus(`現在 ${railDraft.points.length} 点: さらにクリックして経路を延ばすか、路線を確定してください。`);
    updateRailOverlayControls();
    render();
  }

  function cancelRailDraft() {
    if (!railDraft) return;
    railDraft = null;
    updateRailOverlayStatus('描画中の路線をキャンセルしました。');
    updateRailOverlayControls();
    render();
  }

  function getRailOverlayDemand() {
    if (!railOverlayContext || !railOverlayContext.slider) return 3;
    const value = Number(railOverlayContext.slider.value);
    return Number.isFinite(value) ? clamp(value, 1, 6) : 3;
  }

  function updateRailOverlayStatus(message) {
    if (tileInfoEl && message) {
      tileInfoEl.textContent = message;
    }
    if (railOverlayContext && railOverlayContext.statusEl) {
      railOverlayContext.statusEl.textContent = message || '描画モード中です';
    }
  }

  function updateRailOverlayControls() {
    if (!railOverlayContext) return;
    if (railOverlayContext.drawBtn) {
      railOverlayContext.drawBtn.textContent = pendingRailMode ? '描画を終了' : '路線を描く';
      railOverlayContext.drawBtn.classList.toggle('active', pendingRailMode);
    }
    if (railOverlayContext.commitBtn) {
      const ready = railDraft && railDraft.points.length >= 2;
      railOverlayContext.commitBtn.disabled = !ready;
      railOverlayContext.commitBtn.textContent = ready ? '路線を確定する' : '経路を2点以上描いてください';
    }
  }

  function updateRailOverlayList() {
    if (!railOverlayContext || !railOverlayContext.listEl) return;
    railOverlayContext.listEl.innerHTML = '';
    railOverlayContext.listEl.appendChild(renderHorsecarLineList());
  }

  function finalizeRailDraft() {
    if (!railDraft || railDraft.points.length < 2) return false;
    const path = railDraft.points.map(pt => ({ x: pt.x, y: pt.y }));
    const demand = getRailOverlayDemand();
    const executed = tryExecuteStoryAction('horsecar_rail', 'player', null, {
      showReason: true,
      path,
      demandLevel: demand,
    });
    if (executed) {
      markMapDirty();
      updateHudStats();
      railDraft = null;
      updateRailOverlayList();
      updateRailOverlayStatus('路線を確定しました。必要であれば再度描画してください。');
      updateRailOverlayControls();
      if (typeof railScheduleStateRefresher === 'function') {
        railScheduleStateRefresher();
      }
      render();
    }
    return executed;
  }

  function toggleRailMode() {
    pendingRailMode = !pendingRailMode;
    if (!pendingRailMode) {
      cancelRailDraft();
      updateRailOverlayStatus('描画モードを終了しました。');
    } else {
      pendingRoadMode = false;
      updateRailOverlayStatus('描画モードに入りました。地図をクリックして路線を描いてください。');
    }
    updateRailOverlayControls();
    render();
  }

  function deactivateRailMode() {
    pendingRailMode = false;
    railDraft = null;
    updateRailOverlayControls();
    if (railOverlayContext) {
      railOverlayContext = null;
    }
  }

  function getRailLineNodes() {
    const nodes = [];
    const lines = getHorsecarLines();
    lines.forEach(line => {
      if (Array.isArray(line.path)) {
        line.path.forEach(pt => {
          if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
            nodes.push(pt);
          }
        });
      }
      if (Number.isFinite(line.cityAId)) {
        const city = cities[line.cityAId];
        if (city) nodes.push({ x: city.x, y: city.y });
      }
      if (Number.isFinite(line.cityBId)) {
        const city = cities[line.cityBId];
        if (city) nodes.push({ x: city.x, y: city.y });
      }
    });
    return nodes;
  }

  function snapToRailNode(point) {
    const nodes = getRailLineNodes();
    let best = null;
    let bestDist = Infinity;
    nodes.forEach(node => {
      const dx = node.x - point.x;
      const dy = node.y - point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist && dist <= RAIL_SNAP_THRESHOLD) {
        bestDist = dist;
        best = node;
      }
    });
    if (best) {
      return { x: best.x, y: best.y };
    }
    return null;
  }

  const TRAIN_TYPE_OPTIONS = [
    { id: 'horsecar', label: '馬車列車' },
    { id: 'magic', label: '魔導鉄道' },
    { id: 'electric', label: '電車' },
  ];

  function getTrainTypeLabel(type) {
    const entry = TRAIN_TYPE_OPTIONS.find(opt => opt.id === type);
    return entry ? entry.label : '特別列車';
  }

  function getCityDisplayName(cityId) {
    const city = cities[cityId];
    if (!city) return `都市 ${cityId}`;
    return city.name || `都市 ${city.id}`;
  }

  function getRailSchedules() {
    const state = getWorldState();
    if (!state.railSchedules) state.railSchedules = [];
    return state.railSchedules;
  }

  function addRailSchedule(schedule) {
    const entry = Object.assign({
      id: `rail-schedule-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdTurn: currentTurn,
    }, schedule);
    const schedules = getRailSchedules();
    schedules.unshift(entry);
    if (schedules.length > 8) schedules.pop();
    markWorldDirty();
    return entry;
  }

function removeRailSchedule(scheduleId) {
  const schedules = getRailSchedules();
  const idx = schedules.findIndex(entry => entry.id === scheduleId);
  if (idx === -1) return false;
  schedules.splice(idx, 1);
  markWorldDirty();
  return true;
}

function getLineById(lineId) {
  if (!lineId) return null;
  const lines = getHorsecarLines();
  return lines.find(line => line && line.id === lineId) || null;
}

function removeSchedulesForLine(lineId) {
  const schedules = getRailSchedules();
  let removed = false;
  for (let i = schedules.length - 1; i >= 0; i--) {
    if (schedules[i].lineId === lineId) {
      schedules.splice(i, 1);
      removed = true;
    }
  }
  return removed;
}

function removeHorsecarLine(lineId) {
  const lines = getHorsecarLines();
  const idx = lines.findIndex(line => line && line.id === lineId);
  if (idx === -1) return false;
  lines.splice(idx, 1);
  const removedSchedules = removeSchedulesForLine(lineId);
  markWorldDirty();
  return true;
}

function getCityFromPoint(point) {
  if (!point) return null;
  return cities.find(city => city && city.x === point.x && city.y === point.y) || null;
}

function createPlannedCityAtPoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  const x = clamp(Math.round(point.x), 0, W - 1);
  const y = clamp(Math.round(point.y), 0, H - 1);
  const tile = map[y] && map[y][x];
  if (!tile) return null;
  const existing = getCityFromPoint({ x, y });
  if (existing) return existing;
  const city = addCityRecord(x, y, CITY.PLANNED);
  if (!city) return null;
  city.name = `計画都市${city.id}`;
  city.pop = Math.max(120, city.pop || 200);
  city.prosperity = 0.6;
  city.stability = clamp(city.stability || 50, 40, 80);
  city.planned = true;
  markWorldDirty();
  return city;
}

function getCitiesAlongLine(line) {
  if (!line || !Array.isArray(line.path)) return [];
  const seen = new Set();
  return line.path
    .map(point => getCityFromPoint(point))
    .filter(city => city && !seen.has(city.id) && (seen.add(city.id), true));
}

function getLineEndpointId(line, position = 'start') {
  if (!line) return null;
  const directId = position === 'start' ? line.cityAId : line.cityBId;
  if (Number.isFinite(directId)) return directId;
  const path = Array.isArray(line.path) && line.path.length ? line.path : null;
  const point = path ? (position === 'start' ? path[0] : path[path.length - 1]) : null;
  const city = getCityFromPoint(point);
  return city ? city.id : null;
}

function ensureLineEndpointCity(line, position = 'start') {
  if (!line) return null;
  const key = position === 'start' ? 'cityAId' : 'cityBId';
  const directId = Number.isFinite(line[key]) ? line[key] : null;
  if (directId != null && Number.isFinite(directId) && cities[directId]) {
    return directId;
  }
  const path = Array.isArray(line.path) && line.path.length ? line.path : null;
  const point = path ? (position === 'start' ? path[0] : path[path.length - 1]) : null;
  if (!point) return null;
  const city = getCityFromPoint(point) || createPlannedCityAtPoint(point);
  if (!city) return null;
  line[key] = city.id;
  return city.id;
}

function getLineLabel(line) {
  const origin = getCityDisplayName(getLineEndpointId(line, 'start')) || '未設定';
  const dest = getCityDisplayName(getLineEndpointId(line, 'end')) || '未設定';
  return `${origin} → ${dest}`;
}

function getLineStopCandidates(line) {
  if (!line) return [];
  const originId = getLineEndpointId(line, 'start');
  const destinationId = getLineEndpointId(line, 'end');
  return getCitiesAlongLine(line).filter(city => city.id !== originId && city.id !== destinationId);
}

function getScheduleCities(schedule) {
  if (!schedule) return [];
  const collected = new Set();
  const pushCity = city => {
    if (city && Number.isFinite(city.id) && !collected.has(city.id)) {
      collected.add(city.id);
    }
  };
  const addId = (cityId) => {
    if (!Number.isFinite(cityId)) return;
    const city = cities[cityId];
    if (city) pushCity(city);
  };
  addId(schedule.originId);
  addId(schedule.destinationId);
  if (Array.isArray(schedule.stops)) {
    schedule.stops.forEach(stop => {
      if (stop && typeof stop === 'object') {
        addId(stop.cityId);
      } else {
        addId(stop);
      }
    });
  }
  return Array.from(collected).map(id => cities[id]).filter(Boolean);
}

function estimateSchedulePassengers(schedule) {
  const ROUTE_POP_FACTOR = 0.00045;
  const STOPS_BONUS = 3;
  const citiesInRoute = getScheduleCities(schedule);
  const totalPop = citiesInRoute.reduce((acc, city) => acc + (city.pop || 0), 0);
  const base = Math.max(10, Math.round(totalPop * ROUTE_POP_FACTOR));
  const stops = Math.max(0, citiesInRoute.length - 2);
  return base + stops * STOPS_BONUS;
}

function getTrainTypeRevenueModifier(type) {
  switch (type) {
    case 'magic': return 0.3;
    case 'electric': return 0.2;
    default: return 0.1;
  }
}

function estimateScheduleEconomy(schedule) {
  if (!schedule) return { passengers: 0, revenue: 0, maintenance: 0, profit: 0 };
  const passengers = estimateSchedulePassengers(schedule);
  const loopPassengers = Array.isArray(schedule.stops)
    ? schedule.stops.reduce((sum, stop) => sum + ((stop && typeof stop === 'object' && stop.passingLoop) ? 4 : 0), 0)
    : 0;
  const effectivePassengers = passengers + loopPassengers;
  const revenuePerPassenger = 0.35 + getTrainTypeRevenueModifier(schedule.trainType);
  const revenue = Math.round(effectivePassengers * schedule.frequency * revenuePerPassenger);
  const maintenance = Math.round(schedule.capacity * schedule.frequency * 1.9);
  return {
    passengers: effectivePassengers,
    revenue,
    maintenance,
    profit: revenue - maintenance,
  };
}

  function updateHudStats() {
    if (!hudStatsEl) return;
    const sign = (globalTax - globalMaintenance) >= 0 ? '+' : '';
    hudStatsEl.innerHTML = `資金: ${Math.floor(globalFunds)} <span style="font-size:11px; opacity:0.8;">(${sign}${Math.floor(globalTax - globalMaintenance)})</span><br>
      <span style="font-size:11px; font-weight:normal; color:#d8dee9;">インフラ維持費: -${Math.floor(globalMaintenance)} / 税収: +${Math.floor(globalTax)}</span>`;
    const dateLabel = formatGameDate();
    const turnLabel = formatSuccessionCountdown();
    hudStatsEl.innerHTML += `<br><span style="font-size:11px; font-weight:normal; color:#d8dde9;">${dateLabel} / ${turnLabel}</span>`;
    const militaryState = getMilitaryState();
    const totalDefense = Object.values(militaryState.cities).reduce((sum, entry) => sum + (Number(entry) || 0), 0);
    const totalDivisions = Object.values(militaryState.regions).reduce((sum, entry) => sum + (Number(entry) || 0), 0);
    if (totalDefense || totalDivisions) {
      hudStatsEl.innerHTML += `<br><span style="font-size:11px; font-weight:normal; color:#ffae6f;">軍備：防衛団 ${totalDefense} / 師団 ${totalDivisions}</span>`;
    }
    if (railRevenueLastTurn || railMaintenanceLastTurn || railPassengerFlow) {
      const railNet = railRevenueLastTurn - railMaintenanceLastTurn;
      const netLabel = railNet >= 0 ? `+${railNet}` : `${railNet}`;
      hudStatsEl.innerHTML += `<br><span style="font-size:11px; font-weight:normal; color:#a8ffb5;">鉄道 ${railPassengerFlow}人 / ${netLabel}資金 (${railRevenueLastTurn}収 / ${railMaintenanceLastTurn}維)</span>`;
    }
    updateMobileContextHeading();
  }

function markSnow(rand) {
    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const t = map[y][x];
        if (t.base !== BASE.MOUNTAIN) {
          t.snow = false;
          continue;
        }
        const heightFactor = clamp((t.h - 6) / Math.max(1, (maxZ - 6)), 0, 1);
        const jitter = rand()*0.45;
        t.snow = (heightFactor - jitter) > 0.25;
      }
    }
  }

  function generateRivers(rand) {
    const candidates = [];
    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const t = map[y][x];
        if (isWaterBase(t.base)) continue;
        if (t.h < 4) continue;
        const centerBias = 1 - (Math.abs(x - W/2) + Math.abs(y - H/2)) / (W+H);
        const score = t.h + centerBias*1.5 + rand()*0.3;
        candidates.push({x,y,score});
      }
    }
    candidates.sort((a,b)=>b.score-a.score);
    const riverCount = 4 + Math.floor(rand()*3);
    let created = 0;
    for (const c of candidates) {
      if (created >= riverCount) break;
      if (map[c.y][c.x].river) continue;
      if (carveRiver(c.x, c.y, rand)) created++;
    }
  }

  function applyRiverPath(path) {
    if (path.length < 6) return false;
    for (let i=0;i<path.length;i++) {
      const seg = path[i];
      const tile = map[seg.y][seg.x];
      tile.river = true;
      tile.riverWidth = Math.max(tile.riverWidth, seg.width);
      if (!isWaterBase(tile.base)) {
        if (tile.base === BASE.MOUNTAIN || tile.base === BASE.FOREST) tile.base = BASE.GRASS;
        tile.h = Math.max(0, tile.h-1);
      }
      tile.riverDirs = tile.riverDirs || [];
      const prev = i>0 ? path[i-1] : null;
      const next = i<path.length-1 ? path[i+1] : null;
      if (prev) {
        addRiverDir(tile, dirFromDelta(prev.x - seg.x, prev.y - seg.y));
      }
      if (next) {
        addRiverDir(tile, dirFromDelta(next.x - seg.x, next.y - seg.y));
      }
    }
    return true;
  }

  function carveRiver(sx, sy, rand) {
    let x = sx, y = sy;
    let width = 0.65;
    let lastDir = null;
    const visited = new Set();
    const path = [];
    for (let step=0; step<260; step++) {
      const key = x+','+y;
      if (visited.has(key)) break;
      visited.add(key);
      const tile = map[y][x];
      path.push({x,y,width});
      if (isWaterBase(tile.base) && step>0) {
        return applyRiverPath(path);
      }
      const neighbors = [];
      for (const [dx,dy,dir] of [[0,-1,'N'],[1,0,'E'],[0,1,'S'],[-1,0,'W']]) {
        const nx = x+dx, ny = y+dy;
        if (nx<0||ny<0||nx>=W||ny>=H) continue;
        const nt = map[ny][nx];
        let score = nt.h;
        if (isWaterBase(nt.base)) score -= 10;
        if (nt.river) score -= 4;
        if (lastDir && dir === lastDir) score -= 0.2;
        score += rand()*0.3;
        neighbors.push({nx,ny,dir,score});
      }
      if (!neighbors.length) break;
      neighbors.sort((a,b)=>a.score-b.score);
      const next = neighbors[0];
      x = next.nx;
      y = next.ny;
      lastDir = next.dir;
      width = Math.min(1.4, width + 0.01);
    }
    return false;
  }

  function terrainDecay(tile) {
    if (isWaterBase(tile.base)) return 99;
    if (tile.farmland > 0) return 1;
    if (tile.base === BASE.GRASS) return tile.h >= 5 ? 3 : 1;
    if (tile.base === BASE.FOREST) return 2;
    if (tile.road) return 1;
    if (tile.base === BASE.MOUNTAIN) return tile.snow ? 6 : 5;
    if (tile.snow) return 5;
    return 3;
  }

  function spreadCivilization(iter=60) {
    const current = Array.from({length:H}, (_,y)=>Array.from({length:W}, (_,x)=>map[y][x].civ));
    const next = Array.from({length:H}, ()=>Array(W).fill(0));
    for (let k=0;k<iter;k++) {
      for (let y=0;y<H;y++) {
        for (let x=0;x<W;x++) {
          let best = current[y][x];
          for (const delta of Object.values(DIR_DELTA)) {
            const nx = x + delta.dx;
            const ny = y + delta.dy;
            if (nx<0||ny<0||nx>=W||ny>=H) continue;
            if (isWaterBase(map[ny][nx].base)) continue;
            const neighbor = current[ny][nx];
            let decay = terrainDecay(map[y][x]);
            if (map[y][x].road && map[ny][nx].road) decay = Math.max(1, Math.floor(decay/2));
            const cand = neighbor - decay;
            if (cand > best) best = cand;
          }
          next[y][x] = Math.max(current[y][x], best);
        }
      }
      for (let y=0;y<H;y++) for (let x=0;x<W;x++) current[y][x] = Math.max(0, next[y][x]);
    }
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) map[y][x].civ = current[y][x];
  }

  function computeCityDistanceField() {
    const dist = Array.from({length:H}, ()=>Array(W).fill(Infinity));
    const queue = [];
    for (const city of cities) {
      dist[city.y][city.x] = 0;
      map[city.y][city.x].owner = city.id;
      queue.push({x:city.x,y:city.y,owner:city.id});
    }
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      const base = dist[cur.y][cur.x];
      for (const delta of Object.values(DIR_DELTA)) {
        const nx = cur.x + delta.dx;
        const ny = cur.y + delta.dy;
        if (nx<0||ny<0||nx>=W||ny>=H) continue;
        if (isWaterBase(map[ny][nx].base)) continue;
        if (dist[ny][nx] > base + 1) {
          dist[ny][nx] = base + 1;
          map[ny][nx].owner = cur.owner;
          queue.push({x:nx,y:ny,owner:cur.owner});
        }
      }
    }
    return dist;
  }

  function growFarmland(distanceField, rand) {
    for (let y=0;y<H;y++) {
      for (let x=0;x<W;x++) {
        const tile = map[y][x];
        if (tile.base === BASE.FOREST && tile.civ > 8) tile.base = BASE.GRASS;
        if (tile.base !== BASE.GRASS) {
          tile.farmland = 0;
          continue;
        }
        if (!distanceField || distanceField[y][x] === Infinity || distanceField[y][x] > 12) {
          tile.farmland = 0;
          continue;
        }
        if (tile.civ <= 6) {
          tile.farmland *= 0.5;
          continue;
        }
        let chance = 0.12 + tile.civ * 0.015;
        chance += Math.max(0, 10 - distanceField[y][x]) * 0.02;
        if (tile.road || hasRoadNearby(x,y)) chance += 0.25;
        if (rand() < chance) {
          tile.farmland = Math.min(1, tile.farmland + 0.8);
        } else {
          tile.farmland *= 0.9;
        }
      }
    }
  }

  function farmlandStats(x, y, radius=6) {
    let farmland = 0;
    let grass = 0;
    let road = 0;
    for (let dy=-radius; dy<=radius; dy++) {
      for (let dx=-radius; dx<=radius; dx++) {
        const nx = x+dx, ny = y+dy;
        if (nx<0||ny<0||nx>=W||ny>=H) continue;
        if (Math.abs(dx)+Math.abs(dy) > radius) continue;
        const tile = map[ny][nx];
        if (tile.farmland > 0) farmland += tile.farmland;
        if (tile.base === BASE.GRASS) grass++;
        if (tile.road) road++;
      }
    }
    return {farmland, grass, road};
  }

  function tryPromoteCity(city) {
    if (city.kind === CITY.CAPITAL || city.kind === CITY.CASTLE) return;
    if (city.kind === CITY.VILLAGE && city.pop > 800) {
      city.kind = CITY.TOWN;
    } else if (city.kind === CITY.TOWN && city.pop > 2500) {
      city.kind = CITY.WALLED;
    } else if (city.kind === CITY.WALLED && city.pop > 6000) {
      city.kind = CITY.CITY;
    }
    map[city.y][city.x].city = city.kind;
    city.civCore = CIV_CORE[city.kind] || city.civCore;
    map[city.y][city.x].civ = Math.max(map[city.y][city.x].civ, city.civCore);
  }

  function ensureSuccessionDecision() {
    if (!isStoryMode || successionResult) return;
    if (typeof successionTurnPlanned !== 'number' || !Number.isFinite(successionTurnPlanned)) return;
    if (currentTurn < successionTurnPlanned) return;
    computeSuccessionResult();
    applySuccessionRoles();
    if (!storyFlags.successionShown) {
      storyFlags.successionShown = true;
      showSuccessionOverlay();
    }
  }

  function simulateOneTurn() {
    let taxTotal = 0;
    let roadCount = 0;
    for(let y=0; y<H; y++) for(let x=0; x<W; x++) if(map[y][x].road) roadCount++;

    for (const city of cities) {
      const stats = farmlandStats(city.x, city.y, 6);
      const tile = map[city.y][city.x];
      const food = stats.farmland * 3 + stats.grass * 1 - city.pop * 0.01;
      const roadBonus = (tile.road ? (tile.road * 2) : 0) + stats.road * 0.2;
      const wealth = roadBonus + tile.civ * 0.2;
      const delta = clamp(food*0.5 + wealth*0.1 - city.pop*0.005, -50, 120);
      city.food = food;
      city.wealth = wealth;
      city.prod = stats.grass * 0.2 + stats.road * 0.5;
      city.pop = Math.max(150, city.pop + delta);
      city.lastDelta = delta;
      city.prosperity = clamp(city.prosperity + wealth*0.02 - 0.05, 0.2, 8);
      city.stability = clamp(city.stability + (food > 0 ? 0.6 : -1) + (city.prosperity-2)*0.2, 15, 120);
      city.military = clamp(city.military + roadBonus*0.4 + city.defense*0.3 - 0.5, 20, 260);
      city.megacity = city.megacity || city.pop > 11000 || (city.kind === CITY.CAPITAL && city.pop > 8500);
      
      taxTotal += city.pop * 0.05 * (city.prosperity * 0.5 + 0.5);
      tryPromoteCity(city);
    }
    applyMetropolitanGrowth();
    
    globalTax = taxTotal;
    globalMaintenance = roadCount * 0.8;
    const schedules = getRailSchedules();
    let railRevenue = 0;
    let railMaintenanceCost = 0;
    let passengerFlowTotal = 0;
    schedules.forEach(schedule => {
      const econ = estimateScheduleEconomy(schedule);
      railRevenue += econ.revenue;
      railMaintenanceCost += econ.maintenance;
      passengerFlowTotal += econ.passengers * (schedule.frequency || 1);
    });
    railRevenueLastTurn = Math.round(railRevenue);
    railMaintenanceLastTurn = Math.round(railMaintenanceCost);
    railPassengerFlow = Math.max(0, Math.round(passengerFlowTotal));
    const railNet = Math.round(railRevenue - railMaintenanceCost);
    globalFunds += (globalTax - globalMaintenance) + railNet;
    currentTurn += 1;

    // 政治ターン（行動ターン）の進行を同期し、行動ポイントやクールダウンを更新
    tickActionTurnIfNeeded();
    updateKingAIState();
    ensureSuccessionDecision();

    maybeTriggerStorySequence();
    maybeTriggerWorldEvent();
    updateStoryEndCondition();

    updateHudStats();
    if (globalFunds <= 0) {
      showGameOver();
    }
  }

  function designateCapital(city) {
    if (!city) return false;
    const current = cities.find(c=>c.kind === CITY.CAPITAL);
    if (current && current.id === city.id) return false;
    if (current) {
      current.kind = current.pop > 5000 ? CITY.CITY : CITY.WALLED;
      current.megacity = current.pop > 9000;
      map[current.y][current.x].city = current.kind;
      current.civCore = CIV_CORE[current.kind] || current.civCore;
    }
    city.kind = CITY.CAPITAL;
    city.megacity = true;
    city.civCore = CIV_CORE[CITY.CAPITAL];
    map[city.y][city.x].city = CITY.CAPITAL;
    markWorldDirty();
    if (isStoryMode && !storyFlags.firstCapitalSet) {
      storyFlags.firstCapitalSet = true;
      handleFirstCapitalSet(city);
    }
    return true;
  }

  function createFrontierVillage(x, y, randFn=Math.random) {
    if (x<0||y<0||x>=W||y>=H) return null;
    const tile = map[y][x];
    if (tile.city || isWaterBase(tile.base) || tile.base === BASE.MOUNTAIN) return null;
    const heightLimit = tile.manualRoad ? 5 : 4;
    if (tile.h < 1 || tile.h > heightLimit) return null;
    if (!nearWater(x,y,3) && !hasRoadNearby(x,y) && !tile.manualRoad) return null;
    const city = addCityRecord(x,y,CITY.VILLAGE, randFn);
    markWorldDirty();
    return city;
  }

  function refreshAfterCityChange(rebuildRoads=true) {
    const randFn = Math.random;
    if (rebuildRoads) buildRoadNetwork(cities, randFn);
    assignCityRelations(randFn);
    refreshCivilization(60, randFn);
    simulateOneTurn();
    if (lastTileInfo) {
      updateTileInfo({ x:lastTileInfo.x, y:lastTileInfo.y });
    }
    updateControlButtons();
    markWorldDirty();
    render();
  }

  // --- 描画 ---
  function clear() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#07090c';
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  function drawTileIso(x,y) {
    const t = map[y][x];
    const { sx, sy } = toScreen(x,y,t.h);
    const isWaterTile = (t.base === BASE.SEA || t.base === BASE.LAKE);
    const cityObj = (t.city && t.owner != null && cities[t.owner]) ? cities[t.owner] : null;

    // 画面外ざっくりスキップ（軽量化）
    if (sx < -tileW || sx > canvas.width + tileW) return;
    if (sy < -tileH - 60 || sy > canvas.height + tileH + 60) return;

    // 上面菱形
    const top = [
      {x:sx, y:sy},
      {x:sx + tileW/2, y:sy + tileH/2},
      {x:sx, y:sy + tileH},
      {x:sx - tileW/2, y:sy + tileH/2},
    ];

    // 側面・傾斜
    const h = t.h;
    const neighborN = heightAt(x, y-1);
    const neighborE = heightAt(x+1, y);
    const neighborS = heightAt(x, y+1);
    const neighborW = heightAt(x-1, y);
    const gentleSlopes = [];

    function considerSlope(dir, neighborHeight) {
      const dz = h - neighborHeight;
      if (dz <= 0) return;
      if ((dir === 'S' || dir === 'E') && dz > 2) {
        drawVerticalFace(top, dir, dz);
        return;
      }
      gentleSlopes.push({dir, dz: Math.min(dz, 2)});
    }

    considerSlope('S', neighborS);
    considerSlope('E', neighborE);
    considerSlope('N', neighborN);
    considerSlope('W', neighborW);

    // 上面
    ctx.fillStyle = baseFill(t);
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(top[2].x, top[2].y);
    ctx.lineTo(top[3].x, top[3].y);
    ctx.closePath();
    ctx.fill();

    // 上面の模様 or 田園
    const hasFarmland = t.farmland > 0 && !isWaterTile;
    if (hasFarmland && !tinyDetailMode) {
      drawFarmlandOverlay(sx, sy, t);
    } else {
      if (hasFarmland && tinyDetailMode) {
        ctx.fillStyle = 'rgba(220,180,100,0.35)';
        ctx.beginPath();
        ctx.moveTo(top[0].x, top[0].y);
        ctx.lineTo(top[1].x, top[1].y);
        ctx.lineTo(top[2].x, top[2].y);
        ctx.lineTo(top[3].x, top[3].y);
        ctx.closePath();
        ctx.fill();
      }
      if (!lowDetailMode) {
        drawTopPattern(sx, sy, t);
      }
    }

    if (cityObj && (cityObj.megacity || cityObj.kind === CITY.CAPITAL || cityObj.kind === CITY.CITY || (cityObj.kind === CITY.WALLED && cityObj.pop > 3500))) {
      drawCityAura(top, cityObj);
    }

    if (t.river) {
      drawRiverOverlay(top, t);
    }

    if (t.road) {
      drawRoadOverlay(top, x, y);
    }

    if (!lowDetailMode) {
      for (const slope of gentleSlopes) {
        drawSlopePlane(x, y, top, slope.dir, slope.dz);
      }
      const info = slopeInfo(x,y);
      drawSlopeOrCliffTexture(sx, sy, info);
    }

    if (t.snow && !tinyDetailMode) {
      drawSnowcap(top);
    }

    // 影（段差＋一方向）: 水は影をほぼ描かない
    if (!isWaterTile && !tinyDetailMode) {
      drawShadowRD(x,y);
    }

    if ((showCivOverlay || (!is2DMode)) && t.civ > 0.05 && !(t.base === BASE.SEA || t.base === BASE.LAKE)) {
      drawCivGlow(sx, sy, t);
    }

    // エッジ
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.stroke();

    if (selectedTile && selectedTile.x === x && selectedTile.y === y) {
      drawSelectionOutline(top);
    }

    // 都市
    if (t.city) {
      drawCityIcon(sx, sy, t.city);
    }
  }

  function drawMapIso() {
    for (const c of drawOrder) drawTileIso(c.x, c.y);
  }

  function renderMapLayer(mode, { clearLayer=true, alpha=1 } = {}) {
    const prevMode = is2DMode;
    const prevLow = lowDetailMode;
    const prevTiny = tinyDetailMode;
    if (clearLayer) clear();
    is2DMode = mode;
    lowDetailMode = tileW < 16;
    tinyDetailMode = tileW < 11;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (mode) {
      drawMap2D();
      drawTrafficOverlay();
    } else {
      drawMapIso();
    }
    ctx.restore();
    is2DMode = prevMode;
    lowDetailMode = prevLow;
    tinyDetailMode = prevTiny;
  }

  function draw() {
    if (is2DMode) {
      renderChunks2D();
    } else {
      renderMapLayer(false, { clearLayer:true, alpha:1 });
    }
  }

  // PWA 向けの保存容量を意識したセーブ関数（古いスロットから順に整理）
  function saveWorldToSlot(slotIndex=DEFAULT_SAVE_SLOT) {
    if (appState !== 'map' || !worldReady) {
      tileInfoEl.textContent = 'ゲーム中のみ保存できます';
      return false;
    }
    if (typeof localStorage === 'undefined') {
      tileInfoEl.textContent = 'この環境では保存機能が利用できません';
      return false;
    }
    const idx = normalizeSlotIndex(slotIndex);
    const key = getSlotKey(idx);
    const payload = serializeWorld();
    const json = JSON.stringify(payload);

    function tryWrite() {
      localStorage.setItem(key, json);
      setLastSaveSlotIndex(idx);
      tileInfoEl.textContent = `セーブスロット${idx}に保存しました`;
      worldDirty = false;
        return true;
    }

    try {
      return tryWrite();
    } catch (err) {
      console.error('save failed', err);
      if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
        // 容量不足時: 他スロット（1〜SAVE_SLOT_COUNT）のうち最も古いものから順に削除して再試行
        try {
          const victims = [];
          for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
            if (i === idx) continue;
            const info = readSlotInfo(i);
            if (info && info.exists && info.savedAt) {
              victims.push({ slotIndex: i, savedAt: info.savedAt });
            }
          }
          victims.sort((a, b) => a.savedAt - b.savedAt);
          for (const v of victims) {
            try {
              localStorage.removeItem(getSlotKey(v.slotIndex));
            } catch {}
            try {
              if (tryWrite()) return true;
            } catch (err2) {
              console.error('save retry failed', err2);
            }
          }
        } catch (err3) {
          console.error('save cleanup failed', err3);
        }
        tileInfoEl.textContent = '保存容量の上限に達しました。古いセーブを削除してから再度お試しください';
      } else {
        tileInfoEl.textContent = '保存に失敗しました';
      }
      return false;
    }
  }



  generate();
  worldDirty = false;
  updateUIState();
  setupMobileUI();
  render();
  requestAnimationFrame(animationLoop);
  window.addEventListener('beforeunload', () => {
    if (bgmBlobUrl) {
      try { URL.revokeObjectURL(bgmBlobUrl); } catch {}
      bgmBlobUrl = '';
    }
  });
  requestAnimationFrame(simulationLoop);
})();
