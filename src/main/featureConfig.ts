import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type FeatureConfig = {
  clipboard: {
    enabled: boolean;
    pollMs: number;
    maxPreviewLength: number;
  };
};

const defaultConfig: FeatureConfig = {
  clipboard: {
    enabled: false,
    pollMs: 1200,
    maxPreviewLength: 160
  }
};

export function loadFeatureConfig(): FeatureConfig {
  const configPath = resolve(process.cwd(), "config", "features.config.json");
  if (!existsSync(configPath)) return defaultConfig;

  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<FeatureConfig>;
  return {
    clipboard: {
      enabled: parsed.clipboard?.enabled ?? defaultConfig.clipboard.enabled,
      pollMs: parsed.clipboard?.pollMs ?? defaultConfig.clipboard.pollMs,
      maxPreviewLength: parsed.clipboard?.maxPreviewLength ?? defaultConfig.clipboard.maxPreviewLength
    }
  };
}
