import { z } from "zod";

import { AuthError, requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api/http";
import { logNoteAccess } from "@/lib/notes/log";
import { serializeNote } from "@/lib/notes/serialization";
import { prisma } from "@/lib/prisma";
import { NOTE_VISIBILITIES } from "@/lib/types/api";
import type { NoteDeleteResponse, NoteMutationResponse } from "@/lib/types/api";

const updateNoteSchema = z
  .object({
    text: z.string().trim().min(1).max(1000).optional(),
    visibility: z.enum(NOTE_VISIBILITIES).optional(),
  })
  .refine((data) => data.text !== undefined || data.visibility !== undefined);

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requirePermission("createNote");

    const { id } = await context.params;
    const noteId = Number(id);

    if (!Number.isInteger(noteId) || noteId <= 0) {
      return fail("INVALID_REQUEST", "Invalid note id", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return fail("INVALID_REQUEST", "Invalid request body", 400);
    }

    const parsed = updateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return fail("INVALID_REQUEST", "Invalid note data", 400);
    }

    const note = await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        record: {
          select: {
            patientId: true,
          },
        },
      },
    });

    if (!note) {
      return fail("NOT_FOUND", "Note not found", 404);
    }

    if (note.authorId !== user.id) {
      return fail("UNAUTHORIZED", "Only the note author can edit this note", 403);
    }

    const updatedNote = await prisma.note.update({
      where: { id: noteId },
      data: {
        ...(parsed.data.text !== undefined && { content: parsed.data.text }),
        ...(parsed.data.visibility !== undefined && { visibility: parsed.data.visibility }),
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

    await logNoteAccess(user.id, note.record.patientId, note.recordId, "edit", user.role);

    return ok({
      note: serializeNote(updatedNote),
    } satisfies NoteMutationResponse);
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.code, error.message, error.code === "UNAUTHENTICATED" ? 401 : 403);
    }
    console.error("Failed to edit note:", error);
    return fail("NOTE_EDIT_FAILED", "Could not edit note", 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requirePermission("createNote");

    const { id } = await context.params;
    const noteId = Number(id);

    if (!Number.isInteger(noteId) || noteId <= 0) {
      return fail("INVALID_REQUEST", "Invalid note id", 400);
    }

    const note = await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        record: {
          select: {
            patientId: true,
          },
        },
      },
    });

    if (!note) {
      return fail("NOT_FOUND", "Note not found", 404);
    }

    if (note.authorId !== user.id) {
      return fail("UNAUTHORIZED", "Only the note author can delete this note", 403);
    }

    await prisma.note.delete({
      where: { id: noteId },
    });

    await logNoteAccess(user.id, note.record.patientId, note.recordId, "delete", user.role);

    return ok({
      deletedId: noteId,
    } satisfies NoteDeleteResponse);
  } catch (error) {
    if (error instanceof AuthError) {
      return fail(error.code, error.message, error.code === "UNAUTHENTICATED" ? 401 : 403);
    }
    console.error("Failed to delete note:", error);
    return fail("NOTE_DELETE_FAILED", "Could not delete note", 500);
  }
}
