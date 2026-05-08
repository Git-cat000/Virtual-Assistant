import { useEffect, useState } from "react";
import type { AgentUiState } from "../../../shared/types";

type PetAssetKind = "image" | "video" | "lottie";

export type PetAsset = {
  src: string;
  kind?: PetAssetKind;
};

type PetManifest = {
  name?: string;
  states?: Partial<Record<AgentUiState, string | PetAsset>>;
};

const stateOrder: AgentUiState[] = ["idle", "thinking", "working", "alert", "error"];
const manifestUrl = "/pets/current/manifest.json";
const conventionalExtensions = ["webp", "gif", "png", "apng", "webm", "mp4", "json"];

export function usePetManifest(state: AgentUiState): PetAsset | null {
  const [assets, setAssets] = useState<Partial<Record<AgentUiState, PetAsset>> | null>(null);

  useEffect(() => {
    let active = true;

    async function loadManifest() {
      try {
        const response = await fetch(manifestUrl, { cache: "no-store" });
        if (!response.ok) {
          if (active) setAssets(createConventionalAssets());
          return;
        }

        const manifest = (await response.json()) as PetManifest;
        const nextAssets: Partial<Record<AgentUiState, PetAsset>> = {};

        for (const item of stateOrder) {
          const value = manifest.states?.[item];
          if (!value) continue;
          nextAssets[item] = normalizeAsset(value);
        }

        if (active) setAssets(Object.keys(nextAssets).length > 0 ? nextAssets : createConventionalAssets());
      } catch {
        if (active) setAssets(createConventionalAssets());
      }
    }

    void loadManifest();
    return () => {
      active = false;
    };
  }, []);

  if (!assets) return null;
  return assets[state] ?? assets.idle ?? null;
}

function createConventionalAssets(): Partial<Record<AgentUiState, PetAsset>> {
  return Object.fromEntries(
    stateOrder.map((item) => {
      const src = `/pets/current/${item}.${conventionalExtensions[0]}`;
      return [item, { src, kind: inferKind(src) }];
    })
  );
}

function normalizeAsset(value: string | PetAsset): PetAsset {
  if (typeof value !== "string") {
    return {
      ...value,
      src: withPetBase(value.src),
      kind: value.kind ?? inferKind(value.src)
    };
  }

  return {
    src: withPetBase(value),
    kind: inferKind(value)
  };
}

function withPetBase(src: string) {
  if (/^(https?:|file:|data:|\/)/i.test(src)) return src;
  return `/pets/current/${src}`;
}

function inferKind(src: string): PetAssetKind {
  if (/\.(webm|mp4|mov)$/i.test(src)) return "video";
  if (/\.json$/i.test(src)) return "lottie";
  return "image";
}
