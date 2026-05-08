export type EnqueueResult = {
  queued: boolean;
};

export interface AgentBridge {
  enqueue(prompt: string): EnqueueResult;
  respondPermission(id: string, allowed: boolean): void;
}

export type AgentBridgeCallbacks = {
  onTaskStart?: (id: string, prompt: string) => void;
  onTaskComplete?: (id: string, summary?: string) => void;
  onTaskError?: (id: string, message: string) => void;
};
