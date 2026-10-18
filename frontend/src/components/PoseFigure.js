import React from 'react';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';

const BONES = [['shoulder', 'hip'], ['hip', 'knee'], ['knee', 'ankle'], ['ankle', 'foot_index'], ['ankle', 'heel']];

// Side-view stick figure drawn from the joints the backend returns (normalised coords).
export default function PoseFigure({ joints, angles, size = 260, kneeLabel, hipLabel }) {
  const names = Object.keys(joints || {}).filter((n) => joints[n]);
  if (!names.length) return null;
  const xs = names.map((n) => joints[n].x);
  const ys = names.map((n) => joints[n].y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 0.01);
  const pad = 36;
  const scale = (size - pad * 2) / span;
  const px = (x) => pad + (x - minX) * scale + ((size - pad * 2) - (maxX - minX) * scale) / 2;
  const py = (y) => pad + (y - minY) * scale + ((size - pad * 2) - (maxY - minY) * scale) / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {BONES.map(([a, b]) =>
        joints[a] && joints[b] ? (
          <Line key={`${a}-${b}`} x1={px(joints[a].x)} y1={py(joints[a].y)} x2={px(joints[b].x)} y2={py(joints[b].y)}
            stroke={colors.primary} strokeWidth={5} strokeLinecap="round" />
        ) : null
      )}
      {names.map((n) => (
        <Circle key={n} cx={px(joints[n].x)} cy={py(joints[n].y)} r={6} fill={colors.text} stroke={colors.primary} strokeWidth={2} />
      ))}
      {joints.knee && angles?.knee_angle != null && kneeLabel ? (
        <SvgText x={px(joints.knee.x) + 12} y={py(joints.knee.y) + 4} fill={colors.text} fontSize={13} fontWeight="700" fontFamily="System">
          {kneeLabel}
        </SvgText>
      ) : null}
      {joints.hip && angles?.hip_angle != null && hipLabel ? (
        <SvgText x={px(joints.hip.x) - 12} y={py(joints.hip.y) - 10} fill={colors.muted} fontSize={13} fontWeight="700" fontFamily="System" textAnchor="end">
          {hipLabel}
        </SvgText>
      ) : null}
    </Svg>
  );
}
