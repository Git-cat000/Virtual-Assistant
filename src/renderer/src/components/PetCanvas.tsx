import { useEffect, useRef, useState } from "react";
import Lottie from "lottie-react";
import { usePetManifest } from "../hooks/usePetManifest";
import { usePetStore } from "../stores/petStore";

export function PetCanvas() {
  const state = usePetStore((store) => store.state);
  const ref = useRef<HTMLDivElement>(null);
  const asset = usePetManifest(state);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  useEffect(() => {
    setFailedSrc(null);
  }, [asset?.src]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;

    const onMouseDown = (event: MouseEvent) => {
      dragging = true;
      startX = event.screenX;
      startY = event.screenY;
      element.classList.add("dragging");
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!dragging) return;
      const dx = event.screenX - startX;
      const dy = event.screenY - startY;
      startX = event.screenX;
      startY = event.screenY;
      window.virtualAssistant.moveBy(dx, dy);
    };

    const onMouseUp = () => {
      dragging = false;
      element.classList.remove("dragging");
    };

    element.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      element.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div ref={ref} className={`pet-canvas pet-${state}`}>
      {asset && asset.src !== failedSrc ? (
        <PetAssetView asset={asset} state={state} onAssetError={() => setFailedSrc(asset.src)} />
      ) : (
        <FallbackPet />
      )}
    </div>
  );
}

function PetAssetView({
  asset,
  state,
  onAssetError
}: {
  asset: NonNullable<ReturnType<typeof usePetManifest>>;
  state: string;
  onAssetError: () => void;
}) {
  const shouldLoop = state !== "alert" && state !== "error";

  if (asset.kind === "video") {
    return <video className="pet-custom-media" src={asset.src} autoPlay muted playsInline loop={shouldLoop} onError={onAssetError} />;
  }

  if (asset.kind === "lottie") {
    return <LottieAsset src={asset.src} loop={shouldLoop} onAssetError={onAssetError} />;
  }

  if (asset.kind === "spritesheet") {
    return <SpriteSheetAsset asset={asset} state={state} loop={shouldLoop} onAssetError={onAssetError} />;
  }

  return <img className="pet-custom-media" src={asset.src} alt="" draggable={false} onError={onAssetError} />;
}

function SpriteSheetAsset({
  asset,
  state,
  loop,
  onAssetError
}: {
  asset: NonNullable<ReturnType<typeof usePetManifest>>;
  state: string;
  loop: boolean;
  onAssetError: () => void;
}) {
  const columns = asset.columns ?? 1;
  const rows = asset.rows ?? 1;
  const frames = asset.animations?.[state as keyof typeof asset.animations] ?? asset.animations?.idle ?? [0];
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
  }, [asset.src, state]);

  useEffect(() => {
    if (frames.length <= 1) return;

    const interval = window.setInterval(() => {
      setFrameIndex((current) => {
        const next = current + 1;
        if (next < frames.length) return next;
        return loop ? 0 : current;
      });
    }, 1000 / (asset.fps ?? 6));

    return () => window.clearInterval(interval);
  }, [asset.fps, frames, loop]);

  const frame = frames[Math.min(frameIndex, frames.length - 1)] ?? 0;
  const column = frame % columns;
  const row = Math.floor(frame / columns);
  const x = columns > 1 ? (column / (columns - 1)) * 100 : 0;
  const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;

  return (
    <div
      className="pet-custom-spritesheet"
      style={{
        backgroundImage: `url("${asset.src}")`,
        backgroundPosition: `${x}% ${y}%`,
        backgroundSize: `${columns * 100}% ${rows * 100}%`
      }}
      role="img"
      aria-label=""
      onError={onAssetError}
    />
  );
}

function LottieAsset({ src, loop, onAssetError }: { src: string; loop: boolean; onAssetError: () => void }) {
  const [animationData, setAnimationData] = useState<unknown>(null);

  useEffect(() => {
    let active = true;

    async function loadAnimation() {
      try {
        const response = await fetch(src, { cache: "no-store" });
        if (!response.ok) {
          onAssetError();
          return;
        }
        const data = await response.json();
        if (active) setAnimationData(data);
      } catch {
        if (active) setAnimationData(null);
        onAssetError();
      }
    }

    setAnimationData(null);
    void loadAnimation();

    return () => {
      active = false;
    };
  }, [src]);

  if (!animationData) return null;

  return <Lottie className="pet-custom-lottie" animationData={animationData} loop={loop} autoplay />;
}

function FallbackPet() {
  return (
    <>
      <div className="pet-core">
        <div className="ear ear-left" />
        <div className="ear ear-right" />
        <div className="pet-face">
          <div className="eye eye-left" />
          <div className="eye eye-right" />
          <div className="mouth" />
        </div>
      </div>
      <div className="pet-shadow" />
    </>
  );
}
