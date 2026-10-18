// Live camera for the web build: getUserMedia preview, MediaPipe pose skeleton overlay, framing and
// lighting checks, countdown, live rep counter. Landmarks are collected in memory and handed to
// onSession when the set ends. No frame or video is ever uploaded or stored.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle, Camera, CameraOff, CheckCircle2, RefreshCw, ShieldCheck, Square, Play } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { useLanguage } from '../i18n';
import { createLandmarker } from '../lib/poseExtractor';
import { DARK_LUMA, checkFraming, meanLuma } from '../lib/framing';
import { RepCounter, signalAngle } from '../lib/liveCounter';

export const liveCameraSupported =
  typeof navigator !== 'undefined' && typeof document !== 'undefined' && typeof WebAssembly !== 'undefined';

const COUNTDOWN_SECONDS = 3;
const SAMPLE_FPS = 15;
const MAX_SET_SECONDS = 60; // keeps the landmark payload far below the 4.5 MB request limit
const MIN_FRAMES = 15;
const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
];
const round = (n) => Math.round(n * 10000) / 10000;

function cameraErrorKey(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'noCamera';
    default:
      return 'inUse';
  }
}

// spec: entry of GET /api/exercises ({ signal, mode, rest, enter, required }) or null
// disabled: the analysis service is unavailable or a set is being analysed
export default function LiveCamera({ exercise, spec, disabled, hold, onSession }) {
  const { t } = useLanguage();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(0);
  const phaseRef = useRef('idle');
  const specRef = useRef(spec);
  const sessionRef = useRef({ frames: [], counter: null, start: 0, lastSample: 0, holdStart: null });
  const lightRef = useRef({ at: 0, canvas: null });
  const cuesKeyRef = useRef('');
  const facingRef = useRef('user');

  const [phase, setPhase] = useState('idle'); // idle | starting | ready | countdown | recording
  const [error, setError] = useState(null); // { key, message? }
  const [modelPct, setModelPct] = useState(0);
  const [delegate, setDelegate] = useState(null);
  const [facing, setFacing] = useState('user');
  const [cues, setCues] = useState({ cues: ['noBody'], blocking: true });
  const [dark, setDark] = useState(false);
  const [count, setCount] = useState(COUNTDOWN_SECONDS);
  const [live, setLive] = useState({ reps: 0, seconds: 0, angle: null });
  const [notice, setNotice] = useState(null);

  const setPhaseBoth = (p) => { phaseRef.current = p; setPhase(p); };
  useEffect(() => { specRef.current = spec; }, [spec]);

  const stopLoop = () => { cancelAnimationFrame(rafRef.current); rafRef.current = 0; };
  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const turnOff = useCallback(() => {
    stopLoop();
    stopStream();
    setPhaseBoth('idle');
  }, []);

  useEffect(() => () => {
    stopLoop();
    stopStream();
    try { landmarkerRef.current?.close(); } catch (_) {}
  }, []);

  const draw = (lms, ok) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lms) return;
    const w = canvas.width, h = canvas.height;
    const color = ok ? '#22C55E' : '#FF6B00';
    ctx.lineWidth = Math.max(3, w / 220);
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    for (const [a, b] of BONES) {
      const p = lms[a], q = lms[b];
      if ((p.visibility ?? 0) < 0.4 || (q.visibility ?? 0) < 0.4) continue;
      ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(q.x * w, q.y * h); ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    for (let i = 11; i < 33; i++) {
      const p = lms[i];
      if ((p.visibility ?? 0) < 0.4) continue;
      ctx.beginPath(); ctx.arc(p.x * w, p.y * h, Math.max(4, w / 160), 0, Math.PI * 2); ctx.fill();
    }
    const nose = lms[0];
    if ((nose.visibility ?? 0) > 0.4) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(nose.x * w, nose.y * h, Math.max(5, w / 130), 0, Math.PI * 2); ctx.fill();
    }
  };

  const sampleLight = (now) => {
    const l = lightRef.current;
    if (now - l.at < 700) return;
    l.at = now;
    const video = videoRef.current;
    if (!l.canvas) { l.canvas = document.createElement('canvas'); l.canvas.width = 64; l.canvas.height = 48; }
    const ctx = l.canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, 64, 48);
    setDark(meanLuma(ctx.getImageData(0, 0, 64, 48).data) < DARK_LUMA);
  };

  const finish = useCallback(async (reason) => {
    if (phaseRef.current !== 'recording') return;
    const { frames } = sessionRef.current;
    setPhaseBoth('ready');
    if (reason === 'limit') setNotice('live.stoppedAuto');
    if (frames.length < MIN_FRAMES) {
      setError({ key: 'tooShort' });
      return;
    }
    // The camera and the model are no longer needed while the set is analysed.
    stopLoop();
    stopStream();
    setPhaseBoth('idle');
    await onSession(frames);
  }, [onSession]);

  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; }, [finish]);

  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick);
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2 || !video.videoWidth) return;
    const s = sessionRef.current;
    if (video.currentTime === s.lastVideoTime) return;
    s.lastVideoTime = video.currentTime;

    const now = performance.now();
    const ts = Math.max((s.lastTs || 0) + 1, Math.round(now));
    s.lastTs = ts;
    let result;
    try { result = landmarker.detectForVideo(video, ts); } catch (_) { return; }
    const lms = result?.landmarks?.[0] || null;
    const framing = checkFraming(lms, specRef.current?.required);
    draw(lms, !framing.blocking && !framing.cues.length);
    sampleLight(now);

    const key = framing.cues.join(',');
    if (key !== cuesKeyRef.current) { cuesKeyRef.current = key; setCues(framing); }

    if (phaseRef.current !== 'recording') return;
    const elapsed = now - s.start;
    if (elapsed >= MAX_SET_SECONDS * 1000) { finishRef.current('limit'); return; }
    if (!lms) return;
    const sp = specRef.current;
    const angle = sp ? signalAngle(lms, framing.side, sp.signal) : null;
    if (s.counter) s.counter.push(angle);
    if (now - s.lastSample >= 1000 / SAMPLE_FPS - 3) {
      s.lastSample = now;
      s.frames.push({
        landmarks: lms.slice(0, 33).map((p) => ({ x: round(p.x), y: round(p.y), z: round(p.z), visibility: round(p.visibility ?? 0) })),
        timestamp: Math.round(elapsed),
      });
    }
    if (now - (s.lastUi || 0) > 150) {
      s.lastUi = now;
      setLive({ reps: s.counter ? s.counter.reps : 0, seconds: Math.floor(elapsed / 1000), angle: angle == null ? null : Math.round(angle) });
    }
  }, []);

  async function openCamera(nextFacing = facingRef.current) {
    setError(null);
    setNotice(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ key: window.isSecureContext === false ? 'insecure' : 'unsupported' });
      return;
    }
    stopLoop();
    stopStream();
    setPhaseBoth('starting');
    setModelPct(0);
    try {
      // The browser asks for permission while the model downloads.
      const modelPromise = landmarkerRef.current
        ? Promise.resolve(null)
        : createLandmarker((f) => setModelPct(Math.round(f * 100))).then((r) => { landmarkerRef.current = r.landmarker; setDelegate(r.delegate); });
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e) {
        modelPromise.catch(() => {});
        setError({ key: cameraErrorKey(e) });
        setPhaseBoth('idle');
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      try {
        await modelPromise;
      } catch (e) {
        stopStream();
        setError({ key: 'model', message: e.message });
        setPhaseBoth('idle');
        return;
      }
      cuesKeyRef.current = 'noBody';
      setCues({ cues: ['noBody'], blocking: true });
      setPhaseBoth('ready');
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      stopStream();
      setError({ key: 'inUse' });
      setPhaseBoth('idle');
    }
  }

  const flip = () => {
    const next = facingRef.current === 'user' ? 'environment' : 'user';
    facingRef.current = next;
    setFacing(next);
    openCamera(next);
  };

  async function startSet() {
    setError(null);
    setNotice(null);
    setPhaseBoth('countdown');
    for (let n = COUNTDOWN_SECONDS; n >= 1; n--) {
      setCount(n);
      await new Promise((r) => setTimeout(r, 1000));
      if (phaseRef.current !== 'countdown') return; // cancelled
    }
    const sp = specRef.current;
    sessionRef.current = {
      frames: [], start: performance.now(), lastSample: 0, lastTs: sessionRef.current.lastTs,
      lastVideoTime: sessionRef.current.lastVideoTime,
      counter: sp && sp.mode !== 'hold' ? new RepCounter(sp) : null,
    };
    setLive({ reps: 0, seconds: 0, angle: null });
    setPhaseBoth('recording');
  }

  const cancelCountdown = () => setPhaseBoth('ready');

  const mirrored = facing === 'user';
  const active = phase !== 'idle';
  const issue = cues.cues.find((c) => c !== 'turn') || (cues.cues.includes('turn') ? 'turn' : null);
  const canStart = phase === 'ready' && !cues.blocking && !disabled;
  const cueKey = cues.cues.length ? cues.cues[0] : null;

  return (
    <View style={styles.wrap} testID="live-camera" dataSet={{ phase, delegate: delegate || '' }}>
      <View style={styles.privacy}>
        <ShieldCheck size={16} color={colors.success} />
        <Text style={styles.privacyText}>{t('live.privacy')}</Text>
      </View>

      <View style={[styles.stage, !active && styles.stageHidden]}>
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          style={{ width: '100%', maxHeight: '68vh', minHeight: 200, objectFit: 'contain', display: 'block', background: '#000', transform: mirrored ? 'scaleX(-1)' : 'none' }}
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', objectFit: 'contain', transform: mirrored ? 'scaleX(-1)' : 'none' }}
        />

        {phase === 'starting' ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.overlayText}>{modelPct >= 100 ? t('live.startingModel') : t('live.loadingModel', { pct: modelPct })}</Text>
          </View>
        ) : null}

        {phase === 'countdown' ? (
          <View style={styles.overlay}>
            <Text style={styles.bigCount}>{count}</Text>
            <Text style={styles.overlayText}>{t('live.getReady')}</Text>
          </View>
        ) : null}

        {phase === 'recording' ? (
          <View style={styles.hud} pointerEvents="none">
            <View style={styles.rec}><View style={styles.recDot} /><Text style={styles.hudText}>{t('live.recording')} {live.seconds}s</Text></View>
            <View style={styles.counter}>
              <Text style={styles.counterValue}>{hold ? live.seconds : live.reps}</Text>
              <Text style={styles.counterLabel}>{hold ? t('live.hold') : t('live.reps')}</Text>
            </View>
          </View>
        ) : null}

        {phase === 'ready' || phase === 'recording' ? (
          <View style={styles.cueBar} pointerEvents="none">
            {cueKey ? <AlertTriangle size={16} color={colors.warning} /> : <CheckCircle2 size={16} color={colors.success} />}
            <Text style={styles.cueText}>{cueKey ? t(`live.cue.${cueKey}`) : t('live.cue.ok')}</Text>
          </View>
        ) : null}
        {dark && (phase === 'ready' || phase === 'recording') ? (
          <View style={[styles.cueBar, { bottom: 52 }]} pointerEvents="none">
            <AlertTriangle size={16} color={colors.warning} />
            <Text style={styles.cueText}>{t('live.cue.dark')}</Text>
          </View>
        ) : null}
      </View>

      {error ? (
        <View style={styles.error} accessibilityRole="alert">
          <CameraOff size={18} color={colors.danger} />
          <Text style={styles.errorText}>{t(`live.err.${error.key}`, { message: error.message || '' })}</Text>
        </View>
      ) : null}
      {notice ? <Text style={styles.notice}>{t(notice)}</Text> : null}
      {phase === 'recording' && !hold ? <Text style={styles.hint}>{t('live.repsNote')}</Text> : null}
      {issue && phase === 'ready' && cues.blocking ? <Text style={styles.hint}>{t('live.startBlocked')}</Text> : null}

      <View style={styles.actions}>
        {phase === 'idle' ? (
          <Btn icon={Camera} title={t('live.enable')} onPress={() => openCamera()} disabled={disabled} testID="live-enable" />
        ) : null}
        {phase === 'starting' ? <Btn title={t('live.requesting')} loading disabled /> : null}
        {phase === 'ready' ? (
          <>
            <Btn icon={Play} title={t('live.start')} onPress={startSet} disabled={!canStart} testID="live-start" />
            <View style={styles.row}>
              <Btn ghost icon={RefreshCw} title={t('live.flip')} onPress={flip} style={{ flex: 1 }} />
              <Btn ghost icon={CameraOff} title={t('live.off')} onPress={turnOff} style={{ flex: 1 }} />
            </View>
          </>
        ) : null}
        {phase === 'countdown' ? <Btn ghost title={t('common.cancel')} onPress={cancelCountdown} /> : null}
        {phase === 'recording' ? <Btn icon={Square} title={t('live.stop')} onPress={() => finish('stop')} testID="live-stop" /> : null}
      </View>
    </View>
  );
}

function Btn({ title, onPress, icon: Icon, ghost, loading, disabled, style, testID }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.btn, ghost ? styles.btnGhost : styles.btnPrimary, (disabled || loading) && { opacity: 0.55 }, style]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : Icon ? <Icon size={19} color={ghost ? colors.primary : '#fff'} /> : null}
      <Text style={[styles.btnText, { color: ghost ? colors.primary : '#fff' }]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  privacyText: { color: colors.muted, fontSize: 12.5, lineHeight: 18, flex: 1 },
  stage: { position: 'relative', borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: colors.border },
  stageHidden: { height: 0, borderWidth: 0 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(10,14,26,0.72)' },
  overlayText: { color: colors.text, fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 20 },
  bigCount: { color: colors.primary, fontSize: 96, fontWeight: '800' },
  hud: { position: 'absolute', left: 10, right: 10, top: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,14,26,0.75)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  hudText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  counter: { alignItems: 'center', backgroundColor: 'rgba(10,14,26,0.75)', borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 16 },
  counterValue: { color: colors.text, fontSize: 34, fontWeight: '800', lineHeight: 38 },
  counterLabel: { color: colors.muted, fontSize: 11.5, fontWeight: '600' },
  cueBar: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,14,26,0.8)', borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 },
  cueText: { color: colors.text, fontSize: 13.5, flex: 1, lineHeight: 18 },
  error: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, padding: 12 },
  errorText: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
  notice: { color: colors.warning, fontSize: 13.5 },
  hint: { color: colors.muted, fontSize: 12.5, lineHeight: 18 },
  actions: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md },
  btnPrimary: { backgroundColor: colors.primary },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnText: { fontSize: 16, fontWeight: '700' },
});
