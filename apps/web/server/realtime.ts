// Publish event scan ke Redis pub/sub (worker broadcast via Socket.io).
// Helper milik web (web tidak mengimpor kode worker).
import { Redis } from "ioredis";

export interface ScanEvent {
  schoolId: string;
  studentId: string;
  name: string;
  className: string | null;
  scannedAt: string;
}

let _pub: Redis | null = null;

export async function publishScan(ev: ScanEvent): Promise<void> {
  if (!_pub) {
    _pub = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  await _pub.publish("att:scan", JSON.stringify(ev));
}
