import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { PetBubble } from "./components/PetBubble";
import { PetCanvas } from "./components/PetCanvas";
import { SettingsPanel } from "./components/SettingsPanel";
import { useAgentEvents } from "./hooks/useAgentEvents";
import { useAssistantConfig } from "./hooks/useAssistantConfig";
import { usePetStore } from "./stores/petStore";

export default function App() {
  const [chatVisible, setChatVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const hoverZoneRef = useRef<HTMLDivElement>(null);
  const hasDraftRef = useRef(false);
  const chatVisibleRef = useRef(false);
  const showTextBubble = usePetStore((store) => store.showTextBubble);
  const showClipboardSuggestion = usePetStore((store) => store.showClipboardSuggestion);
  const assistantConfig = useAssistantConfig();

  useAgentEvents();

  useEffect(() => {
    const unsubscribeInput = window.virtualAssistant.onToggleInput(() => {
      setChatVisible((visible) => {
        const next = !visible;
        window.virtualAssistant.setMouseInteractive(next);
        return next;
      });
    });

    const unsubscribeSettings = window.virtualAssistant.onToggleSettings(() => {
      setSettingsVisible((visible) => {
        window.virtualAssistant.setMouseInteractive(!visible);
        return !visible;
      });
    });

    const unsubscribeHistory = window.virtualAssistant.onToggleHistory(() => {
      setHistoryVisible((visible) => {
        window.virtualAssistant.setMouseInteractive(!visible);
        return !visible;
      });
    });

    return () => {
      unsubscribeInput();
      unsubscribeSettings();
      unsubscribeHistory();
    };
  }, []);

  useEffect(() => {
    if (!assistantConfig) return;
    if (assistantConfig.showGreeting === false) return;
    const name = assistantConfig.assistantName || "Virtual Assistant";
    const message = assistantConfig.greeting || `你好，我是你的私人助手 ${name}`;
    const timer = window.setTimeout(() => showTextBubble(message), 450);
    return () => window.clearTimeout(timer);
  }, [assistantConfig, showTextBubble]);

  useEffect(() => {
    return window.virtualAssistant.onClipboardSuggestion((suggestion) => {
      showClipboardSuggestion(suggestion);
    });
  }, [showClipboardSuggestion]);

  const showInput = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    window.virtualAssistant.setMouseInteractive(true);
    chatVisibleRef.current = true;
    setChatVisible(true);
  };

  const hideInput = () => {
    chatVisibleRef.current = false;
    setChatVisible(false);
    window.virtualAssistant.setMouseInteractive(false);
  };

  const hideInputIfEmpty = async () => {
    const zone = hoverZoneRef.current;
    if (!zone || hasDraftRef.current) return;

    const rect = zone.getBoundingClientRect();
    const hovering = await window.virtualAssistant.isCursorInWindowRect({
      left: rect.left - 8,
      top: rect.top - 8,
      right: rect.right + 8,
      bottom: rect.bottom + 8
    });

    if (hovering || hasDraftRef.current) return;
    hideInput();
  };

  const scheduleHideInput = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }
    hideTimer.current = window.setTimeout(() => {
      void hideInputIfEmpty();
    }, 260);
  };

  useEffect(() => {
    if (!chatVisible) return;

    chatVisibleRef.current = true;
    const interval = window.setInterval(() => {
      void hideInputIfEmpty();
    }, 220);
    return () => window.clearInterval(interval);
  }, [chatVisible]);

  return (
    <main className="app-shell">
      <section className="pet-stage" aria-label="">
        <PetBubble />
        <div ref={hoverZoneRef} className="pet-hover-zone" onPointerEnter={showInput} onPointerLeave={scheduleHideInput}>
          <button className="pet-button" type="button" aria-label="desktop pet">
            <PetCanvas />
          </button>
          <ChatPanel
            visible={chatVisible}
            onDraftChange={(hasDraft) => {
              hasDraftRef.current = hasDraft;
              if (!hasDraft) scheduleHideInput();
            }}
            onClose={() => {
              hasDraftRef.current = false;
              hideInput();
            }}
          />
        </div>
        <SettingsPanel
          visible={settingsVisible}
          onClose={() => {
            setSettingsVisible(false);
            window.virtualAssistant.setMouseInteractive(false);
          }}
        />
        <HistoryPanel
          visible={historyVisible}
          onClose={() => {
            setHistoryVisible(false);
            window.virtualAssistant.setMouseInteractive(false);
          }}
        />
      </section>
    </main>
  );
}
