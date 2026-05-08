import { useEffect, useState } from "react";
import type { AgentUiState, PetAsset, PetRuntimeConfig } from "../../../shared/types";

const stateOrder: AgentUiState[] = ["idle", "thinking", "working", "alert", "error"];
const conventionalExtensions = ["webp", "gif", "png", "apng", "webm", "mp4", "json"];

export type { PetAsset };

export function usePetManifest(state: AgentUiState): PetAsset | null {
  const [runtimeConfig, setRuntimeConfig] = useState<PetRuntimeConfig | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPetConfig() {
      try {
        const config = await window.virtualAssistant.getPetRuntimeConfig();
        if (active) setRuntimeConfig(config);
      } catch {
        if (active) {
          setRuntimeConfig({
            name: "Default CSS fallback",
            assets: createConventionalAssets()
          });
        }
      }
    }

    void loadPetConfig();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return window.virtualAssistant.onSettingsUpdated(() => {
      void window.virtualAssistant.getPetRuntimeConfig().then(setRuntimeConfig);
    });
  }, []);

  if (!runtimeConfig) return null;
  return runtimeConfig.assets[state] ?? runtimeConfig.assets.idle ?? null;
}

function createConventionalAssets(): Partial<Record<AgentUiState, PetAsset>> {
  return Object.fromEntries(
    stateOrder.map((item) => {
      const src = `/pets/current/${item}.${conventionalExtensions[0]}`;
      return [item, { src, kind: inferKind(src) }];
    })
  );
}

function inferKind(src: string) {
  if (/\.(webm|mp4|mov)$/i.test(src)) return "video";
  if (/\.json$/i.test(src)) return "lottie";
  return "image";
}
