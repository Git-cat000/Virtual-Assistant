import { FormEvent, useState } from "react";
import { usePetStore } from "../stores/petStore";

type ChatPanelProps = {
  visible: boolean;
  onDraftChange: (hasDraft: boolean) => void;
  onClose: () => void;
};

export function ChatPanel({ visible, onDraftChange, onClose }: ChatPanelProps) {
  const [prompt, setPrompt] = useState("");
  const markQueued = usePetStore((store) => store.markQueued);

  if (!visible) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text) return;

    const result = await window.virtualAssistant.runAgent(text);
    if (result.queued) markQueued();
    setPrompt("");
    onDraftChange(false);
    onClose();
  };

  return (
    <form
      className="chat-panel"
      onSubmit={submit}
      onMouseEnter={() => window.virtualAssistant.setMouseInteractive(true)}
    >
      <input
        autoFocus
        value={prompt}
        onChange={(event) => {
          const next = event.target.value;
          setPrompt(next);
          onDraftChange(next.trim().length > 0);
        }}
        placeholder="输入任务..."
      />
      <button type="submit" className="send-button" title="发送">
        →
      </button>
    </form>
  );
}
