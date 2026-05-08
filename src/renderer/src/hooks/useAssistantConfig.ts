import { useEffect, useState } from "react";
import type { AssistantConfig } from "../../../shared/types";

const defaultConfig: AssistantConfig = {
  assistantName: "Virtual Assistant",
  greeting: "你好，我是你的私人助手 Virtual Assistant",
  showGreeting: true
};

export function useAssistantConfig() {
  const [config, setConfig] = useState<AssistantConfig | null>(null);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const data = await window.virtualAssistant.getAssistantConfig();
        if (active) setConfig(data);
      } catch {
        if (active) setConfig(defaultConfig);
      }
    }

    void loadConfig();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return window.virtualAssistant.onSettingsUpdated((settings) => {
      setConfig(settings.assistant);
    });
  }, []);

  return config;
}
