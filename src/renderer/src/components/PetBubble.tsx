import { useEffect } from "react";
import { usePetStore } from "../stores/petStore";

export function PetBubble() {
  const bubble = usePetStore((store) => store.bubble);
  const resolvePermission = usePetStore((store) => store.resolvePermission);
  const hideTextBubble = usePetStore((store) => store.hideTextBubble);
  const dismissBubble = usePetStore((store) => store.dismissBubble);

  useEffect(() => {
    if (bubble.type !== "text") return;
    const timer = window.setTimeout(hideTextBubble, 8000);
    return () => window.clearTimeout(timer);
  }, [bubble, hideTextBubble]);

  if (bubble.type === "hidden") return null;

  return (
    <aside
      className={`bubble bubble-${bubble.type}`}
      onMouseEnter={() => window.virtualAssistant.setMouseInteractive(true)}
      onMouseLeave={() => window.virtualAssistant.setMouseInteractive(false)}
    >
      {bubble.type === "permission" ? (
        <>
          <strong>{bubble.toolName}</strong>
          <p>{bubble.message}</p>
          <div className="bubble-actions">
            <button type="button" className="icon-button allow" onClick={() => resolvePermission(bubble.id, true)} title="允许">
              ✓
            </button>
            <button type="button" className="icon-button deny" onClick={() => resolvePermission(bubble.id, false)} title="拒绝">
              ×
            </button>
          </div>
        </>
      ) : bubble.type === "clipboard" ? (
        <>
          <strong>剪贴板</strong>
          <p>{bubble.suggestion.preview}</p>
          <div className="bubble-actions">
            <button
              type="button"
              className="icon-button allow"
              onClick={() => {
                void window.virtualAssistant.acceptClipboardSuggestion(bubble.suggestion.id);
                dismissBubble();
              }}
              title="处理"
            >
              ✓
            </button>
            <button type="button" className="icon-button deny" onClick={dismissBubble} title="忽略">
              ×
            </button>
          </div>
        </>
      ) : (
        <p>{bubble.message}</p>
      )}
    </aside>
  );
}
