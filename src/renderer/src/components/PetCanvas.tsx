import { useCallback, useEffect, useRef, useState } from "react";
import Lottie from "lottie-react";
import type { PetAnimationName } from "../../../shared/types";
import { usePetManifest } from "../hooks/usePetManifest";
import { usePetStore } from "../stores/petStore";

export function PetCanvas({ interaction }: { interaction?: PetAnimationName }) {
  const state = usePetStore((store) => store.state);
  const animation = interaction ?? state;
  const ref = useRef<HTMLDivElement>(null);
  const asset = usePetManifest(state);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const sourceWidth = asset?.kind === "spritesheet" ? asset.frameWidth ?? 256 : 96;
  const sourceHeight = asset?.kind === "spritesheet" ? asset.frameHeight ?? 256 : 96;
  const displayScale = asset?.kind === "spritesheet" ? (asset.displayScale ?? 0.5) * 0.75 : 1;
  const width = Math.round(sourceWidth * displayScale);
  const height = Math.round(sourceHeight * displayScale);
  const handleAssetError = useCallback(() => {
    if (asset) setFailedSrc(asset.src);
  }, [asset]);

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
    <div ref={ref} className={`pet-canvas pet-${animation}`} style={{ width, height }}>
      {asset && asset.src !== failedSrc ? (
        <PetAssetView asset={asset} animation={animation} onAssetError={handleAssetError} />
      ) : (
        <FallbackPet />
      )}
    </div>
  );
}

function PetAssetView({
  asset,
  animation,
  onAssetError
}: {
  asset: NonNullable<ReturnType<typeof usePetManifest>>;
  animation: PetAnimationName;
  onAssetError: () => void;
}) {
  const shouldLoop = animation !== "alert" && animation !== "error";

  if (asset.kind === "video") {
    return <video className="pet-custom-media" src={asset.src} autoPlay muted playsInline loop={shouldLoop} onError={onAssetError} />;
  }

  if (asset.kind === "lottie") {
    return <LottieAsset src={asset.src} loop={shouldLoop} onAssetError={onAssetError} />;
  }

  if (asset.kind === "spritesheet") {
    return <SpriteSheetAsset asset={asset} animation={animation} loop={shouldLoop} onAssetError={onAssetError} />;
  }

  return <img className="pet-custom-media" src={asset.src} alt="" draggable={false} onError={onAssetError} />;
}

function SpriteSheetAsset({
  asset,
  animation,
  loop,
  onAssetError
}: {
  asset: NonNullable<ReturnType<typeof usePetManifest>>;
  animation: PetAnimationName;
  loop: boolean;
  onAssetError: () => void;
}) {
  const frames = asset.animations?.[animation] ?? asset.animations?.idle ?? [0];
  const [frameIndex, setFrameIndex] = useState(0);
  const [grid, setGrid] = useState({
    columns: asset.columns ?? 1,
    rows: asset.rows ?? 1
  });
  const [sourceFrame, setSourceFrame] = useState({
    width: asset.frameWidth ?? 256,
    height: asset.frameHeight ?? 256
  });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const image = new Image();
    imageRef.current = image;
    image.onload = () => {
      const inferred = inferSpriteGeometry(image, frames, asset.frameWidth, asset.frameHeight, asset.columns, asset.rows);
      const { columns, rows, frameWidth, frameHeight } = inferred;
      setGrid({ columns, rows });
      setSourceFrame({ width: frameWidth, height: frameHeight });
      drawSpriteFrame(canvasRef.current, image, frames[0] ?? 0, columns, frameWidth, frameHeight);
    };
    image.onerror = onAssetError;
    image.src = asset.src;
    return () => {
      image.onerror = null;
      image.onload = null;
      if (imageRef.current === image) imageRef.current = null;
    };
  }, [asset.columns, asset.frameHeight, asset.frameWidth, asset.rows, asset.src, frames, onAssetError]);

  useEffect(() => {
    setFrameIndex(0);
  }, [asset.src, animation]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || !image.complete) return;
    const frame = frames[Math.min(frameIndex, frames.length - 1)] ?? 0;
    drawSpriteFrame(canvasRef.current, image, frame, grid.columns, sourceFrame.width, sourceFrame.height);
  }, [frameIndex, frames, grid.columns, sourceFrame.height, sourceFrame.width]);

  useEffect(() => {
    if (frames.length <= 1) return;

    const interval = window.setInterval(() => {
      setFrameIndex((current) => {
        const next = current + 1;
        if (next < frames.length) return next;
        return loop ? 0 : current;
      });
    }, asset.frameMs?.[animation] ?? Math.round(1000 / (asset.fps ?? 6)));

    return () => window.clearInterval(interval);
  }, [animation, asset.fps, asset.frameMs, frames, loop]);

  return (
    <canvas
      ref={canvasRef}
      className="pet-custom-spritesheet"
      width={sourceFrame.width}
      height={sourceFrame.height}
      data-columns={grid.columns}
      data-rows={grid.rows}
      aria-label=""
    />
  );
}

function inferSpriteGeometry(
  image: HTMLImageElement,
  frames: number[],
  frameWidth?: number,
  frameHeight?: number,
  columns?: number,
  rows?: number
) {
  if (frameWidth && frameHeight) {
    return {
      frameWidth,
      frameHeight,
      columns: columns ?? Math.max(1, Math.floor(image.naturalWidth / frameWidth)),
      rows: rows ?? Math.max(1, Math.floor(image.naturalHeight / frameHeight))
    };
  }

  if (columns && rows) {
    return {
      frameWidth: Math.floor(image.naturalWidth / columns),
      frameHeight: Math.floor(image.naturalHeight / rows),
      columns,
      rows
    };
  }

  if (!frameWidth && !frameHeight && !columns && !rows && image.naturalWidth % 256 === 0) {
    const inferredColumns = Math.max(1, image.naturalWidth / 256);
    const minRows = Math.max(1, Math.floor(Math.max(...frames, 0) / inferredColumns) + 1);
    const inferredRows = chooseLikelyRowCount(image.naturalHeight, 256, minRows);
    return {
      frameWidth: 256,
      frameHeight: Math.floor(image.naturalHeight / inferredRows),
      columns: inferredColumns,
      rows: inferredRows
    };
  }

  const defaultCodexColumns = 7;
  const frameSize = Math.max(1, Math.floor(image.naturalWidth / defaultCodexColumns));
  return {
    frameWidth: frameSize,
    frameHeight: frameSize,
    columns: defaultCodexColumns,
    rows: Math.max(1, Math.floor(image.naturalHeight / frameSize))
  };
}

function chooseLikelyRowCount(totalHeight: number, expectedFrameHeight: number, minRows: number) {
  let bestRows = Math.max(1, minRows);
  let bestScore = Number.POSITIVE_INFINITY;

  for (let candidate = minRows; candidate <= 24; candidate += 1) {
    if (totalHeight % candidate !== 0) continue;
    const frameHeight = totalHeight / candidate;
    const score = Math.abs(frameHeight - expectedFrameHeight);
    if (score < bestScore) {
      bestScore = score;
      bestRows = candidate;
    }
  }

  return bestRows;
}

function drawSpriteFrame(
  canvas: HTMLCanvasElement | null,
  image: HTMLImageElement,
  frame: number,
  columns: number,
  frameWidth: number,
  frameHeight: number
) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;

  const sourceX = (frame % columns) * frameWidth;
  const sourceY = Math.floor(frame / columns) * frameHeight;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, sourceX, sourceY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
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
      <div className="baymax-core">
        <div className="baymax-head">
          <div className="baymax-eye baymax-eye-left" />
          <div className="baymax-eye-line" />
          <div className="baymax-eye baymax-eye-right" />
        </div>
      </div>
      <div className="pet-shadow" />
    </>
  );
}
