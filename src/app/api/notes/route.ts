import { NextResponse } from "next/server";
import { z } from "zod";

import { AuthError, requirePermission } from "@/lib/auth";
import { canAccessPatient } from "@/lib/auth/permissions";
import { fail, ok } from "@/lib/api/http";
import { logNoteAccess } from "@/lib/notes/log";
import { serializeNote } from "@/lib/notes/serialization";
import { canViewNote } from "@/lib/notes/visibility";
import { prisma } from "@/lib/prisma";
import { NOTE_VISIBILITIES } from "@/lib/types/api";
import type { NoteListResponse, NoteMutationResponse } from "@/lib/types/api";
import { sendNoteToPeer } from "@/lib/p2p/transport";
import { broadcastNoteCreated } from "@/lib/realtime/broadcast";

const createNoteSchema = z.object({
  recordId: z.number().int().positive(),
  text: z.string().trim().min(1).max(1000),
  visibility: z.enum(NOTE_VISIBILITIES),
});

export async function GET(request: Request) {
  try {
    const user = await requirePermission("readPatient");

    const url = new URL(request.url);
    const recordIdParam = url.searchParams.get("recordId");
    const recordId = Number(recordIdParam);

    if (!recordIdParam || !Number.isInteger(recordId) || recordId <= 0) {
      return fail("INVALID_REQUEST", "A valid recordId is required", 400);
    }

    const record = await prisma.medicalRecord.findUnique({
      where: { id: recordId },
      select: {
        id: true,
        patientId: true,
      },
    });

    if (!record) {
      return fail("NOT_FOUND", "Medical record not found", 404);
    }

    if (!canAccessPatient(user, record.patientId)) {
      await logNoteAccess(user.id, record.patientId, record.id, "view_denied", user.role);
      return fail("UNAUTHORIZED", "Patients can only read their own journal notes.", 403);
    }

    const notes = await prisma.note.findMany({
      where: { recordId },
      include: {
        author: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const readNotes = notes.filter((note) =>
      canViewNote({ visibility: note.visibility, authorUserId: note.authorId }, user),
    );

    await logNoteAccess(user.id, record.patientId, record.id, "view", user.role);

    return ok({
      notes: readNotes.map(serializeNote),
      hiddenNotesCount: notes.length - readNotes.length,
    } satisfies NoteListResponse);
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.code, error.message, error.code === "UNAUTHENTICATED" ? 401 : 403);
    }
    console.error("Failed to load notes:", error);
    return fail("NOTES_FAILED", "Could not load notes", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePermission("createNote");

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail("INVALID_REQUEST", "Invalid request body", 400);
    }

    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      return fail("INVALID_REQUEST", "Invalid note data", 400);
    }

    const record = await prisma.medicalRecord.findUnique({
      where: {
        id: parsed.data.recordId,
      },
      select: {
        id: true,
        patientId: true,
      },
    });

    if (!record) {
      return fail("NOT_FOUND", "Medical record not found", 404);
    }

    const note = await prisma.note.create({
      data: {
        recordId: record.id,
        authorId: user.id,
        content: parsed.data.text,
        visibility: parsed.data.visibility,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    await logNoteAccess(user.id, record.patientId, record.id, "create", user.role);

    const serializedNote = serializeNote(note);

    await broadcastNoteCreated(record.patientId, serializedNote);
    await sendNoteToPeer(record.patientId, serializedNote);

    return NextResponse.json(
      {
        ok: true,
        data: {
          note: serializedNote,
        },
      } satisfies { ok: true; data: NoteMutationResponse },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.code, error.message, error.code === "UNAUTHENTICATED" ? 401 : 403);
    }
    console.error("Failed to create note:", error);
    return fail("NOTE_CREATE_FAILED", "Could not create note", 500);
  }
}
