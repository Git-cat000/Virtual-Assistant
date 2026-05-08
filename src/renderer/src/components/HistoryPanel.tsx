import { useEffect, useState } from "react";
import type { TaskHistoryItem } from "../../../shared/types";

type HistoryPanelProps = {
  visible: boolean;
  onClose: () => void;
};

export function HistoryPanel({ visible, onClose }: HistoryPanelProps) {
  const [items, setItems] = useState<TaskHistoryItem[]>([]);

  useEffect(() => {
    if (!visible) return;
    window.virtualAssistant.setMouseInteractive(true);
    void window.virtualAssistant.getTaskHistory().then(setItems);
    return window.virtualAssistant.onTaskHistoryUpdated(setItems);
  }, [visible]);

  if (!visible) return null;

  return (
    <section className="side-panel" onMouseEnter={() => window.virtualAssistant.setMouseInteractive(true)}>
      <header className="side-panel-header">
        <strong>任务历史</strong>
        <button type="button" className="icon-button close" onClick={onClose} title="关闭">
          ×
        </button>
      </header>
      {items.length === 0 ? (
        <p className="panel-note">还没有任务。</p>
      ) : (
        <ol className="history-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className={`history-status history-${item.status}`}>{item.status}</span>
              <p>{item.prompt}</p>
              {item.summary && <small>{item.summary}</small>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
