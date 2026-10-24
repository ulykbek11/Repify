import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { dominantSide, frameAngles, nearestPose } from '../lib/replay';

const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];
const POINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];

// Plays the analysed video with landmarks, skeleton and live joint angles drawn on a canvas.
// uri: object URL of the video. poses: [{ landmarks, timestamp }] from extraction.
export default function ReplayVideo({ uri, poses, signal, labels, testID }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [aspect, setAspect] = useState(16 / 9);
  const [readout, setReadout] = useState([]);
  const side = useMemo(() => dominantSide(poses), [poses]);

  useEffect(() => {
    let raf = 0;
    let lastKey = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const video = videoRef.current, canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth) return;
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const i = nearestPose(poses, video.currentTime * 1000);
      if (i < 0 || Math.abs(poses[i].timestamp - video.currentTime * 1000) > 250) return;
      const lms = poses[i].landmarks;
      const P = (p) => [p.x * w, p.y * h];
      const s = Math.max(2.5, w / 260);
      ctx.lineCap = 'round';
      ctx.lineWidth = s;
      ctx.strokeStyle = 'rgba(255,107,0,0.9)';
      for (const [a, b] of BONES) {
        if ((lms[a].visibility ?? 0) < 0.3 || (lms[b].visibility ?? 0) < 0.3) continue;
        ctx.beginPath(); ctx.moveTo(...P(lms[a])); ctx.lineTo(...P(lms[b])); ctx.stroke();
      }
      for (const n of POINTS) {
        if ((lms[n].visibility ?? 0) < 0.3) continue;
        const [x, y] = P(lms[n]);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, s * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = colors.primary; ctx.lineWidth = s * 0.6; ctx.stroke();
        ctx.lineWidth = s; ctx.strokeStyle = 'rgba(255,107,0,0.9)';
      }
      const angles = frameAngles(lms, signal, side);
      ctx.font = `700 ${Math.round(Math.max(13, w / 40))}px system-ui, sans-serif`;
      for (const { deg, a, b, c } of angles) {
        const [bx, by] = P(b), [ax, ay] = P(a), [cx, cy] = P(c);
        const r = Math.max(22, w / 18);
        const t1 = Math.atan2(ay - by, ax - bx), t2 = Math.atan2(cy - by, cx - bx);
        let d = t2 - t1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        ctx.fillStyle = 'rgba(34,197,94,0.22)'; ctx.strokeStyle = colors.success; ctx.lineWidth = s * 0.8;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.arc(bx, by, r, t1, t1 + d, d < 0); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(bx, by, r, t1, t1 + d, d < 0); ctx.stroke();
        const mid = t1 + d / 2, label = `${Math.round(deg)}°`;
        const lx = bx - Math.cos(mid) * (r + 10), ly = by - Math.sin(mid) * (r + 10);
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(10,14,26,0.8)';
        ctx.fillRect(lx - tw / 2 - 6, ly - 13, tw + 12, 24);
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, lx, ly);
      }
      const key = angles.map((x) => `${x.key}:${Math.round(x.deg)}`).join('|');
      if (key !== lastKey) { lastKey = key; setReadout(angles.map((x) => ({ key: x.key, deg: Math.round(x.deg) }))); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [poses, signal, side]);

  return (
    <View testID={testID}>
      <View style={[styles.frame, { aspectRatio: aspect }]}>
        <video
          ref={videoRef} src={uri} autoPlay loop muted playsInline controls={false}
          onLoadedMetadata={(e) => { const v = e.currentTarget; if (v.videoWidth) setAspect(v.videoWidth / v.videoHeight); }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
        />
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </View>
      <View style={styles.readout}>
        {readout.map((r) => (
          <View key={r.key} style={styles.chip}>
            <Text style={styles.chipLabel}>{labels?.[r.key] || r.key}</Text>
            <Text style={styles.chipValue}>{r.deg}°</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  readout: { flexDirection: 'row', gap: 10, marginTop: 12, minHeight: 52 },
  chip: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  chipLabel: { color: colors.muted, fontSize: 12 },
  chipValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
});
