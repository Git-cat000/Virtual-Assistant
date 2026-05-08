export type TtsRequest = {
  text: string;
  voice?: string;
  speed?: number;
};

export interface TtsProvider {
  speak(request: TtsRequest): Promise<void>;
  stop?(): Promise<void>;
}

export class DisabledTtsProvider implements TtsProvider {
  async speak() {
    // TTS is intentionally left as an integration point for future providers.
  }
}
