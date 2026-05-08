import { useEffect, useState } from "react";

export type AssistantConfig = {
  assistantName?: string;
  greeting?: string;
  showGreeting?: boolean;
};

const defaultConfig: Required<AssistantConfig> = {
  assistantName: "Virtual Assistant",
  greeting: "你好，我是你的私人助手 Virtual Assistant",
  showGreeting: true
};

export function useAssistantConfig() {
  const [config, setConfig] = useState<Required<AssistantConfig> | null>(null);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const response = await fetch("/assistant.config.json", { cache: "no-store" });
        if (!response.ok) {
          if (active) setConfig(defaultConfig);
          return;
        }

        const data = (await response.json()) as AssistantConfig;
        const assistantName = data.assistantName?.trim() || defaultConfig.assistantName;
        const greeting = data.greeting?.trim() || `你好，我是你的私人助手 ${assistantName}`;

        if (active) {
          setConfig({
            assistantName,
            greeting,
            showGreeting: data.showGreeting ?? defaultConfig.showGreeting
          });
        }
      } catch {
        if (active) setConfig(defaultConfig);
      }
    }

    void loadConfig();

    return () => {
      active = false;
    };
  }, []);

  return config;
}
