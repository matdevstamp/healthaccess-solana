import { isStaffRole } from "@/lib/auth/permissions";
import { canViewNote } from "@/lib/notes/visibility";
import { getSocketServer } from "@/lib/realtime/socket-server";
import type { AccessLogEvent, Note, SessionUser } from "@/lib/types/api";

export async function broadcastNoteCreated(patientId: number, note: Note): Promise<void> {
  const io = getSocketServer();
  const sockets = await io.in(`patient:${patientId}`).fetchSockets();

  for (const socket of sockets) {
    const user = socket.data.user as SessionUser | undefined;

    if (user && canViewNote(note, user)) {
      socket.emit("note-created", {
        patientId,
        note,
      });
    }
  }
}

export async function broadcastAccessLogCreated(accessLog: AccessLogEvent): Promise<void> {
  const io = getSocketServer();
  const sockets = await io.in(`patient:${accessLog.patientId}`).fetchSockets();

  for (const socket of sockets) {
    const user = socket.data.user as SessionUser | undefined;

    if (!user) {
      continue;
    }

    const canReceive = isStaffRole(user.role) || user.patientId === accessLog.patientId;
    if (canReceive) {
      socket.emit("access-log-created", {
        accessLog,
      });
    }
  }
}
