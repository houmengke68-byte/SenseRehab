import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Wind, Eye, RotateCcw } from 'lucide-react';
import type { SceneId } from '../types';
import { SCENE_META } from '../utils/labels';

interface ImmersiveViewportProps {
  scene: SceneId;
  isPaused: boolean;
  audioEnabled: boolean;
  volumePercent: number;
  maxVolumePercent: number;
  olfactoryActive: boolean;
  olfactoryProfile: string;
  onToggleAudio: () => void;
  onVolumeChange: (val: number) => void;
  onShutoffOlfactory: () => void;
}

export const ImmersiveViewport: React.FC<ImmersiveViewportProps> = ({
  scene,
  isPaused,
  audioEnabled,
  volumePercent,
  maxVolumePercent,
  olfactoryActive,
  olfactoryProfile,
  onToggleAudio,
  onVolumeChange,
  onShutoffOlfactory,
}) => {
  const meta = SCENE_META[scene];
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [imgError, setImgError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setImgError(false);
    setPanOffset({ x: 0, y: 0 });
  }, [scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    const particles = Array.from({ length: 28 }, (_, idx) => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.5 + (idx % 3) * 1.1,
      vx: scene === 'stream' ? 0.0004 + Math.random() * 0.0005 : (Math.random() - 0.5) * 0.00025,
      vy: scene === 'stream' ? 0.00015 : -0.0002 - Math.random() * 0.00025,
      alpha: 0.25 + Math.random() * 0.45,
    }));

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!isPaused && !prefersReduced) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x > 1) p.x = 0;
          if (p.x < 0) p.x = 1;
          if (p.y < 0) p.y = 1;
          if (p.y > 1) p.y = 0;
        }
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.r, 0, Math.PI * 2);
        ctx.fillStyle =
          scene === 'forest'
            ? `rgba(253, 230, 138, ${p.alpha})`
            : `rgba(224, 242, 254, ${p.alpha})`;
        ctx.fill();
      }

      if (!prefersReduced) {
        rafId = window.requestAnimationFrame(render);
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(320, Math.floor(rect.width));
      canvas.height = Math.max(200, Math.floor(rect.height));
      if (prefersReduced) render();
    };

    resize();
    window.addEventListener('resize', resize);
    if (!prefersReduced) {
      rafId = window.requestAnimationFrame(render);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [scene, isPaused]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPaused) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setPanOffset({
      x: Math.max(-24, Math.min(24, -nx * 18)),
      y: Math.max(-12, Math.min(12, -ny * 10)),
    });
  };

  return (
    <div
      onPointerMove={handlePointerMove}
      className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 select-none"
      style={{ minHeight: '400px' }}
    >
      {/* Scene Image Layer with smooth look-around pan */}
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          transform: `scale(1.08) translate3d(${panOffset.x}px, ${panOffset.y}px, 0)`,
          filter: isPaused ? 'brightness(0.45) blur(3px)' : 'brightness(0.95)',
        }}
      >
        {!imgError ? (
          <img
            src={meta.imageUrl}
            alt={meta.name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center ${
              scene === 'forest'
                ? 'bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900'
                : 'bg-gradient-to-br from-sky-950 via-teal-900 to-slate-900'
            }`}
          >
            <div className="text-center text-slate-200">
              <Eye className="mx-auto mb-2 h-8 w-8 opacity-75" />
              <p className="text-sm font-medium">{meta.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Animated ambient light/ripple canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      />

      {/* Contrast scrim */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-slate-950/55" />

      {/* Top Overlay: Scene info & Web Simulation Honesty Notice */}
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4 p-5 text-white">
        <div>
          <p className="text-xs font-medium tracking-wide text-teal-200">
            Web Demo 沉浸视角模拟 · 移动指针环视环境
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{meta.name}</h3>
          <p className="mt-0.5 text-xs text-slate-200/90">{meta.visualElements}</p>
        </div>

        <button
          type="button"
          onClick={() => setPanOffset({ x: 0, y: 0 })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-slate-950/55 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-slate-900/80 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          回正视角
        </button>
      </div>

      {/* Center Pause State Overlay */}
      {isPaused && (
        <div className="relative z-10 mx-auto my-12 max-w-md rounded-xl border border-white/20 bg-slate-950/80 p-5 text-center text-white backdrop-blur-md">
          <p className="text-base font-semibold">训练已暂停</p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
            环境动态与声音输出已暂缓。您可以按自己舒适的节奏选择继续、调整声音设置或安全退出本次训练。
          </p>
        </div>
      )}

      {/* Bottom Sensory Control Bar (Independent Audio & Olfactory Shutoff §10.1) */}
      <div className="relative z-10 mt-28 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 bg-slate-950/65 px-5 py-3.5 text-white backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onToggleAudio}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              audioEnabled
                ? 'bg-white/15 text-white hover:bg-white/25'
                : 'bg-amber-500/25 text-amber-100 border border-amber-400/40 hover:bg-amber-500/35'
            }`}
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {audioEnabled ? '关闭自然声音' : '声音已静音（点击恢复）'}
          </button>

          <label className="flex items-center gap-2.5 text-xs text-slate-200">
            <span className="whitespace-nowrap">音量</span>
            <input
              type="range"
              min={0}
              max={maxVolumePercent}
              value={audioEnabled ? volumePercent : 0}
              disabled={!audioEnabled}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="h-1.5 w-28 accent-teal-400"
              aria-label="自然环境音量调节"
            />
            <span className="font-mono tabular-nums text-slate-100">
              {audioEnabled ? volumePercent : 0}% / 上限 {maxVolumePercent}%
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          {olfactoryActive ? (
            <button
              type="button"
              onClick={onShutoffOlfactory}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-500/30 whitespace-nowrap shrink-0"
            >
              <Wind className="h-3.5 w-3.5" />
              关闭气味模拟（{olfactoryProfile.split('（')[0]}）
            </button>
          ) : (
            <span className="text-xs text-slate-300">气味通道：未开启或已关闭</span>
          )}
        </div>
      </div>
    </div>
  );
};
