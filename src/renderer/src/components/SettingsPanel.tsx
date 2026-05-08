import { useEffect, useState } from "react";
import type { AppRuntimeInfo } from "../../../shared/types";

type SettingsPanelProps = {
  visible: boolean;
  onClose: () => void;
};

export function SettingsPanel({ visible, onClose }: SettingsPanelProps) {
  const [info, setInfo] = useState<AppRuntimeInfo | null>(null);

  useEffect(() => {
    if (!visible) return;
    window.virtualAssistant.setMouseInteractive(true);
    void window.virtualAssistant.getRuntimeInfo().then(setInfo);
  }, [visible]);

  if (!visible) return null;

  return (
    <section className="side-panel" onMouseEnter={() => window.virtualAssistant.setMouseInteractive(true)}>
      <header className="side-panel-header">
        <strong>设置</strong>
        <button type="button" className="icon-button close" onClick={onClose} title="关闭">
          ×
        </button>
      </header>
      <dl className="settings-list">
        <dt>Agent</dt>
        <dd>{info?.provider ?? "-"}</dd>
        <dt>工作目录</dt>
        <dd>{info?.workspace ?? "-"}</dd>
        <dt>权限模式</dt>
        <dd>{info?.permissionMode ?? "-"}</dd>
        <dt>自动允许</dt>
        <dd>{info?.allowedTools.join(", ") || "-"}</dd>
        <dt>禁用工具</dt>
        <dd>{info?.disallowedTools.join(", ") || "-"}</dd>
      </dl>
      <p className="panel-note">修改配置请编辑 config/agent.config.json 和 public 配置文件。</p>
    </section>
  );
}
