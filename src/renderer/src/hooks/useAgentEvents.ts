import { useEffect } from "react";
import type { AgentUiEvent } from "../../../shared/types";
import { usePetStore } from "../stores/petStore";

export function useAgentEvents() {
  const applyAgentEvent = usePetStore((store) => store.applyAgentEvent);

  useEffect(() => {
    const unsubscribe = window.virtualAssistant.onAgentEvent((event: AgentUiEvent) => {
      applyAgentEvent(event);
    });

    return unsubscribe;
  }, [applyAgentEvent]);
}
