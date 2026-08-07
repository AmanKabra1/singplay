"use client";
import { useEffect, useRef } from "react";

type VinylPlatterProps = {
  playing: boolean;
  coverUrl: string | null;
  seed: string;
  accentColor: string;
  progress: number;
  onNudge?: (delta: number) => void;
};

const SIZE = 220;
const CENTER = SIZE / 2;
const GROOVE_RINGS = 18;
const PROGRESS_RADIUS = 98;

export function VinylPlatter({
  playing,
  coverUrl,
  seed,
  accentColor,
  progress,
  onNudge,
}: VinylPlatterProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!labelRef.current) return;
    if (playing) {
      const tick = (ts: number) => {
        if (lastTimeRef.current === 0) lastTimeRef.current = ts;
        const dt = ts - lastTimeRef.current;
        lastTimeRef.current = ts;
        angleRef.current = (angleRef.current + (dt / 1000) * 45) % 360;
        if (labelRef.current) {
          labelRef.current.style.transform = `rotate(${angleRef.current}deg)`;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimeRef.current = 0;
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    lastAngle: number;
    pointerId: number;
  } | null>(null);

  function getAngleFromCenter(
    clientX: number,
    clientY: number,
    rect: DOMRect
  ): number {
    const x = clientX - rect.left - CENTER;
    const y = clientY - rect.top - CENTER;
    return (Math.atan2(y, x) * 180) / Math.PI;
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const angle = getAngleFromCenter(e.clientX, e.clientY, rect);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastAngle: angle,
      pointerId: e.pointerId,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const newAngle = getAngleFromCenter(e.clientX, e.clientY, rect);
    let delta = newAngle - dragRef.current.lastAngle;
    // Normalize delta to [-180, 180] to handle the -180/180 wrap
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    dragRef.current.lastAngle = newAngle;

    // Also visually rotate the label while dragging
    angleRef.current = (angleRef.current + delta) % 360;
    if (labelRef.current) {
      labelRef.current.style.transform = `rotate(${angleRef.current}deg)`;
    }

    if (onNudge && Math.abs(delta) > 0) {
      onNudge((delta / 360) * 0.5);
    }
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  const circumference = 2 * Math.PI * PROGRESS_RADIUS;
  const dashOffset = circumference * (1 - progress);

  const seedHue =
    seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const placeholderGradient = `radial-gradient(circle at 40% 35%, hsl(${seedHue} 45% 35%), hsl(${(seedHue + 40) % 360} 30% 18%))`;

  return (
    <div
      style={{
        position: "relative",
        width: SIZE,
        height: SIZE,
        userSelect: "none",
        cursor: "grab",
        flexShrink: 0,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* SVG layer: outer disc, groove rings, progress arc */}
      <svg
        width={SIZE}
        height={SIZE}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {/* Drop shadow filter */}
        <defs>
          <filter id="platter-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="disc-texture" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2a2a2e" />
            <stop offset="100%" stopColor="#141416" />
          </radialGradient>
        </defs>

        {/* Outer ring border */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={CENTER - 1}
          fill="url(#disc-texture)"
          stroke="#3a3a3c"
          strokeWidth="1.5"
        />

        {/* Vinyl groove rings — denser inward, fading outward */}
        {Array.from({ length: GROOVE_RINGS }, (_, i) => {
          const t = i / (GROOVE_RINGS - 1);
          const innerBound = SIZE * 0.22;
          const outerBound = CENTER - 18;
          const r = innerBound + t * (outerBound - innerBound);
          const opacity = 0.08 + t * 0.18;
          return (
            <circle
              key={i}
              cx={CENTER}
              cy={CENTER}
              r={r}
              fill="none"
              stroke="#8888aa"
              strokeWidth={0.4 + t * 0.2}
              opacity={opacity}
            />
          );
        })}

        {/* Subtle radial sheen lines */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * 360;
          const rad = (angle * Math.PI) / 180;
          const x1 = CENTER + Math.cos(rad) * (SIZE * 0.2);
          const y1 = CENTER + Math.sin(rad) * (SIZE * 0.2);
          const x2 = CENTER + Math.cos(rad) * (CENTER - 4);
          const y2 = CENTER + Math.sin(rad) * (CENTER - 4);
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#ffffff"
              strokeWidth="0.3"
              opacity="0.04"
            />
          );
        })}

        {/* Progress arc — drawn behind the label but above grooves */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={PROGRESS_RADIUS}
          fill="none"
          stroke="#111"
          strokeWidth="5"
          opacity="0.6"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={PROGRESS_RADIUS}
          fill="none"
          stroke={accentColor}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          opacity="0.85"
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />

        {/* Thin accent ring just outside the label */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={SIZE * 0.32}
          fill="none"
          stroke={accentColor}
          strokeWidth="0.75"
          opacity="0.3"
        />
      </svg>

      {/* Spinning center label */}
      <div
        ref={labelRef}
        style={{
          position: "absolute",
          left: SIZE * 0.19,
          top: SIZE * 0.19,
          width: SIZE * 0.62,
          height: SIZE * 0.62,
          borderRadius: "50%",
          overflow: "hidden",
          background: coverUrl ? undefined : placeholderGradient,
          boxShadow: "inset 0 0 12px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
          willChange: "transform",
          pointerEvents: "none",
        }}
      >
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              pointerEvents: "none",
              draggable: false,
            } as React.CSSProperties & { draggable?: boolean }}
          />
        )}
        {/* Label decorative lines */}
        {!coverUrl && (
          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0 }}
          >
            {Array.from({ length: 6 }, (_, i) => {
              const t = (i + 1) / 8;
              return (
                <circle
                  key={i}
                  cx="50%"
                  cy="50%"
                  r={`${t * 46}%`}
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth="1"
                />
              );
            })}
          </svg>
        )}
      </div>

      {/* Center spindle hole */}
      <div
        style={{
          position: "absolute",
          left: CENTER - 4,
          top: CENTER - 4,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#0a0a0b",
          border: "1px solid #555",
          zIndex: 10,
          pointerEvents: "none",
          boxShadow: "0 0 3px rgba(0,0,0,0.9)",
        }}
      />
    </div>
  );
}
