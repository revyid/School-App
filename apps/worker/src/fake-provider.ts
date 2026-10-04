// FakeProvider untuk tes otomatis: merekam kiriman tanpa jaringan WA.
import type { MessageProvider } from "@sms/shared/notify";

export class FakeProvider implements MessageProvider {
  readonly name = "fake";
  sent: { to: string; text: string }[] = [];
  connected = true;

  async send(to: string, text: string) {
    if (!this.connected) return { ok: false as const, error: "disconnected" };
    this.sent.push({ to, text });
    return { ok: true as const, messageId: `fake-${this.sent.length}` };
  }

  async status() {
    return { connected: this.connected };
  }
}
