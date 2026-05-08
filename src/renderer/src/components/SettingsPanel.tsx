import { useEffect, useMemo, useState } from "react";
import type { AgentProvider, EditableAppSettings } from "../../../shared/types";

type SettingsPanelProps = {
  visible: boolean;
  onClose: () => void;
  standalone?: boolean;
};

type SettingsForm = EditableAppSettings & {
  allowedToolsText: string;
  disallowedToolsText: string;
};

export function SettingsPanel({ visible, onClose, standalone = false }: SettingsPanelProps) {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (!standalone) window.virtualAssistant.setMouseInteractive(true);
    setStatus("");
    void window.virtualAssistant.getSettings().then((settings) => setForm(toForm(settings)));
  }, [visible, standalone]);

  const canSave = useMemo(() => Boolean(form && !saving), [form, saving]);

  if (!visible) return null;

  const update = (patch: Partial<SettingsForm>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
  };

  const updateAgent = (patch: Partial<EditableAppSettings["agent"]>) => {
    setForm((current) => (current ? { ...current, agent: { ...current.agent, ...patch } } : current));
  };

  const updateClaude = (patch: Partial<EditableAppSettings["agent"]["claudeCode"]>) => {
    setForm((current) =>
      current
        ? {
            ...current,
            agent: {
              ...current.agent,
              claudeCode: { ...current.agent.claudeCode, ...patch }
            }
          }
        : current
    );
  };

  const updateAssistant = (patch: Partial<EditableAppSettings["assistant"]>) => {
    setForm((current) => (current ? { ...current, assistant: { ...current.assistant, ...patch } } : current));
  };

  const updateClipboard = (patch: Partial<EditableAppSettings["features"]["clipboard"]>) => {
    setForm((current) =>
      current
        ? {
            ...current,
            features: {
              ...current.features,
              clipboard: { ...current.features.clipboard, ...patch }
            }
          }
        : current
    );
  };

  const chooseWorkspace = async () => {
    const workspace = await window.virtualAssistant.chooseWorkspace();
    if (workspace) updateAgent({ workspace });
  };

  const choosePetFolder = async () => {
    try {
      const pet = await window.virtualAssistant.choosePetFolder();
      if (!pet) return;
      setForm((current) => (current ? { ...current, pet } : current));
      setStatus("桌宠已导入并应用。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "导入桌宠失败。");
    }
  };

  const reload = async () => {
    const settings = await window.virtualAssistant.getSettings();
    setForm(toForm(settings));
    setStatus("");
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setStatus("正在保存...");
    try {
      const saved = await window.virtualAssistant.saveSettings(fromForm(form));
      setForm(toForm(saved));
      setStatus("已保存并刷新运行时配置。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className={standalone ? "settings-page" : "side-panel settings-panel"}
      onMouseEnter={() => {
        if (!standalone) window.virtualAssistant.setMouseInteractive(true);
      }}
    >
      <header className="side-panel-header">
        <strong>设置</strong>
        {!standalone ? (
          <button type="button" className="icon-button close" onClick={onClose} title="关闭">
            x
          </button>
        ) : null}
      </header>

      {!form ? (
        <p className="panel-note">正在读取配置...</p>
      ) : (
        <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
          <fieldset>
            <legend>助手</legend>
            <label>
              名称
              <input value={form.assistant.assistantName} onChange={(event) => updateAssistant({ assistantName: event.target.value })} />
            </label>
            <label>
              启动问候语
              <textarea rows={2} value={form.assistant.greeting} onChange={(event) => updateAssistant({ greeting: event.target.value })} />
            </label>
            <label className="inline-field">
              <input
                type="checkbox"
                checked={form.assistant.showGreeting}
                onChange={(event) => updateAssistant({ showGreeting: event.target.checked })}
              />
              启动时显示问候
            </label>
          </fieldset>

          <fieldset>
            <legend>桌宠</legend>
            <div className="readonly-line">
              <span>当前</span>
              <strong>{form.pet.name || "-"}</strong>
            </div>
            <button type="button" className="secondary-button" onClick={choosePetFolder}>
              导入 Codex 宠物文件夹
            </button>
            <p className="panel-note">选择包含 pet.json 和 spritesheet.webp 的文件夹即可。</p>
          </fieldset>

          <fieldset>
            <legend>Agent</legend>
            <label>
              模型/Provider
              <select value={form.agent.provider} onChange={(event) => updateAgent({ provider: event.target.value as AgentProvider })}>
                <option value="mock">Mock Agent，默认安全模型</option>
                <option value="claude-code">Claude Code</option>
              </select>
            </label>
            <label>
              工作区
              <div className="path-picker">
                <input value={form.agent.workspace} onChange={(event) => updateAgent({ workspace: event.target.value })} />
                <button type="button" className="secondary-button" onClick={chooseWorkspace}>
                  选择
                </button>
              </div>
            </label>
            <label>
              权限模式
              <select value={form.agent.claudeCode.permissionMode} onChange={(event) => updateClaude({ permissionMode: event.target.value })}>
                <option value="default">default，需要确认危险操作</option>
                <option value="acceptEdits">acceptEdits，自动接受编辑</option>
                <option value="bypassPermissions">bypassPermissions，跳过权限确认</option>
              </select>
            </label>
            <label>
              自动允许工具
              <textarea rows={3} value={form.allowedToolsText} onChange={(event) => update({ allowedToolsText: event.target.value })} />
            </label>
            <label>
              禁用工具
              <textarea rows={3} value={form.disallowedToolsText} onChange={(event) => update({ disallowedToolsText: event.target.value })} />
            </label>
            <label>
              权限等待时间，毫秒
              <input
                type="number"
                min={1000}
                step={1000}
                value={form.agent.claudeCode.permissionTimeoutMs}
                onChange={(event) => updateClaude({ permissionTimeoutMs: Number(event.target.value) })}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend>剪贴板感知</legend>
            <label className="inline-field">
              <input
                type="checkbox"
                checked={form.features.clipboard.enabled}
                onChange={(event) => updateClipboard({ enabled: event.target.checked })}
              />
              开启剪贴板建议
            </label>
            <label>
              检测间隔，毫秒
              <input
                type="number"
                min={500}
                step={100}
                value={form.features.clipboard.pollMs}
                onChange={(event) => updateClipboard({ pollMs: Number(event.target.value) })}
              />
            </label>
            <label>
              预览长度
              <input
                type="number"
                min={40}
                step={10}
                value={form.features.clipboard.maxPreviewLength}
                onChange={(event) => updateClipboard({ maxPreviewLength: Number(event.target.value) })}
              />
            </label>
          </fieldset>

          <footer className="settings-actions">
            {status ? <span className="settings-status">{status}</span> : <span />}
            <button type="button" className="secondary-button" onClick={() => void reload()}>
              还原
            </button>
            <button type="button" className="primary-button" disabled={!canSave} onClick={save}>
              保存
            </button>
          </footer>
        </form>
      )}
    </section>
  );
}

function toForm(settings: EditableAppSettings): SettingsForm {
  return {
    ...settings,
    allowedToolsText: settings.agent.claudeCode.allowedTools.join("\n"),
    disallowedToolsText: settings.agent.claudeCode.disallowedTools.join("\n")
  };
}

function fromForm(form: SettingsForm): EditableAppSettings {
  return {
    agent: {
      ...form.agent,
      claudeCode: {
        ...form.agent.claudeCode,
        allowedTools: splitLines(form.allowedToolsText),
        disallowedTools: splitLines(form.disallowedToolsText)
      }
    },
    assistant: form.assistant,
    features: form.features,
    pet: form.pet
  };
}

function splitLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}
