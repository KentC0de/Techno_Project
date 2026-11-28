import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Web-only SVG charts (the admin dashboard runs on web). Native renders nothing.

export function DonutChart({ segments, size = 190, thickness = 22, centerValue, centerLabel }) {
  if (Platform.OS !== 'web') return null;
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerValue} ${centerLabel}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={thickness} />
          {total > 0 &&
            segments.map((s) => {
              if (s.value <= 0) return null;
              const len = (s.value / total) * c;
              const el = (
                <circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
        </g>
      </svg>
      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutValue}>{centerValue}</Text>
        <Text style={styles.donutLabel}>{centerLabel}</Text>
      </View>
    </View>
  );
}

// series: [{ key, name, color, values: [number|null, ...] }], labels: string[]
export function LineChart({ series, labels, height = 260 }) {
  const [width, setWidth] = useState(0);
  if (Platform.OS !== 'web') return null;
  const padL = 44;
  const padR = 16;
  const padT = 14;
  const padB = 30;
  const w = Math.max(width, 320);
  const innerW = w - padL - padR;
  const innerH = height - padT - padB;
  const n = labels.length;
  const x = (i) => padL + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const y = (v) => padT + innerH - (v / 100) * innerH;
  const ticks = [0, 25, 50, 75, 100];
  const step = Math.max(1, Math.ceil(n / 7));

  const paths = series.map((s) => {
    let d = '';
    let pen = false;
    s.values.forEach((v, i) => {
      if (v == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return { ...s, d };
  });

  return (
    <View style={styles.chartWrap} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label="Group performance chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.14)" strokeDasharray="4 4" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{t}%</text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={l} x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="#94A3B8">{l}</text>
          ) : null
        )}
        {paths.map((s) => (
          <g key={s.key}>
            <path d={s.d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {s.values.map((v, i) =>
              v != null && i === s.values.length - 1 ? <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={s.color} /> : null
            )}
          </g>
        ))}
      </svg>
    </View>
  );
}

const styles = StyleSheet.create({
  donutCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  donutValue: { fontSize: 30, fontWeight: '600', color: '#202B3C' },
  donutLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  chartWrap: { width: '100%' },
});
