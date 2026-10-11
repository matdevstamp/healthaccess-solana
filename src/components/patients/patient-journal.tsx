"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Link from "next/link";
import {
  ActivityIcon,
  CheckCircle2Icon,
  FileTextIcon,
  LockIcon,
  NotebookPenIcon,
} from "lucide-react";

import { RoleBadge } from "@/components/common/role-badge";
import { PatientNotesPanel } from "@/components/patients/patient-notes-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/api/client";
import { roleLabel } from "@/components/auth/mock-auth";
import type {
  AccessLogActorMap,
  AccessLogEvent,
  ChainVerificationBlock,
  JournalNotePreview,
  NoteMutationResponse,
  NoteVisibility,
  PatientJournalResponse,
  SessionUser,
} from "@/lib/types/api";

export function PatientJournal({ patientId, user }: { patientId: string; user: SessionUser }) {
  const [journal, setJournal] = useState<PatientJournalResponse | null>(null);
  const [accessLogs, setAccessLogs] = useState<AccessLogEvent[]>([]);
  const [actors, setActors] = useState<AccessLogActorMap>({});
  const [verification, setVerification] = useState<ChainVerificationBlock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  useEffect(() => {
    const socketPort =
      process.env.NEXT_PUBLIC_SOCKET_PORT ?? String(Number(window.location.port || "3000") + 1000);

    const socket = io(`${window.location.protocol}//${window.location.hostname}:${socketPort}`, {
      reconnection: true,
      reconnectionAttempts: 5,
      withCredentials: true,
    });

    function joinPatientRoom() {
      setSocketConnected(true);
      setSocketError(null);
      socket.emit("join-patient", Number(patientId));
    }

    socket.on("connect", joinPatientRoom);

    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    socket.on("note-created", ({ note }: { note: JournalNotePreview }) => {
      setJournal((currentJournal) => {
        if (!currentJournal) return currentJournal;

        const alreadyExists = currentJournal.notes.some(
          (existingNote) => existingNote.id === note.id,
        );

        if (alreadyExists) return currentJournal;

        return {
          ...currentJournal,
          notes: [note, ...currentJournal.notes],
        };
      });
    });
    socket.on("access-log-created", ({ accessLog }: { accessLog: AccessLogEvent }) => {
      setAccessLogs((currentLogs) => {
        const alreadyExists = currentLogs.some((log) => log.eventId === accessLog.eventId);

        if (alreadyExists) {
          return currentLogs;
        }

        return [accessLog, ...currentLogs];
      });
    });
    socket.on("socket-error", ({ message }: { code: string; message: string }) => {
      console.error("[socket-error]", message);
      setSocketError(message);
    });

    socket.on("connect_error", (connectError) => {
      console.error("[socket] connection error:", connectError.message);
      setSocketError(`Realtime connection error: ${connectError.message}`);
    });
    return () => {
      socket.disconnect();
    };
  }, [patientId]);

  useEffect(() => {
    let isMounted = true;

    async function loadJournal() {
      try {
        const data = await apiRequest<PatientJournalResponse>(`/api/patients/${patientId}`);
        const accessLogData = await apiRequest<{
          accessLogs: AccessLogEvent[];
          actors: AccessLogActorMap;
          verification: ChainVerificationBlock;
          viewerUserId: number;
        }>("/api/access-log");
        if (isMounted) {
          setJournal(data);
          setAccessLogs(accessLogData.accessLogs);
          setActors(accessLogData.actors ?? {});
          setVerification(accessLogData.verification);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError("You are not allowed to open this patient journal.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadJournal();

    return () => {
      isMounted = false;
    };
  }, [patientId, user]);

  if (isLoading) {
    return (
      <section className="mx-auto grid w-full max-w-6xl gap-4 p-4 md:grid-cols-2 md:p-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </section>
    );
  }

  if (error || !journal) {
    return (
      <section className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <Card>
          <CardHeader>
            <LockIcon className="size-5 text-destructive" aria-hidden="true" />
            <CardTitle>Access denied</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const title = journal.isOwnJournal ? "My health record" : journal.patient.name;
  async function handleCreateNote(text: string, visibility: NoteVisibility) {
    if (!journal) {
      return;
    }

    const record = journal.records[0];

    if (!record) {
      return;
    }

    const result = await apiRequest<NoteMutationResponse>("/api/notes", {
      method: "POST",
      body: JSON.stringify({
        recordId: record.id,
        text,
        visibility,
      }),
    });

    const note: JournalNotePreview = {
      id: result.note.id,
      createdAt: result.note.createdAt,
      author: result.note.author,
      authorUserId: result.note.authorUserId,
      visibility: result.note.visibility,
      text: result.note.text,
    };

    setJournal((currentJournal) => {
      if (!currentJournal) {
        return currentJournal;
      }

      // The room broadcast usually beats the POST response (it fires mid-
      // request), so the socket handler has already added this note. Skip
      // when the id is already in the list, or the author sees duplicates.
      const alreadyExists = currentJournal.notes.some(
        (existingNote) => existingNote.id === note.id,
      );

      if (alreadyExists) {
        return currentJournal;
      }

      return {
        ...currentJournal,
        notes: [note, ...currentJournal.notes],
      };
    });
  }

  return (
    <>
      <section className="border-b bg-background px-4 py-6 md:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <RoleBadge role={journal.viewerRole} />
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`size-2 rounded-full ${socketConnected ? "bg-green-500" : "bg-red-500"}`}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">
              Realtime {socketConnected ? "connected" : "disconnected"}
            </span>
          </div>
          <Badge variant={socketConnected ? "secondary" : "outline"}>
            {socketConnected ? "Live connected" : (socketError ?? "Reconnecting...")}
          </Badge>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              DOB {journal.patient.dateOfBirth} - {journal.patient.personalNumber}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
        {!journal.isOwnJournal ? (
          <div>
            <Button asChild variant="outline">
              <Link href="/patients">Back to search</Link>
            </Button>
          </div>
        ) : null}

        <Tabs defaultValue="records" className="flex-col gap-4">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-3 bg-transparent p-0 md:grid-cols-3">
            <TabsTrigger
              value="records"
              className="h-auto justify-start gap-3 rounded-lg border bg-card p-4 text-left data-active:bg-primary data-active:text-primary-foreground"
            >
              <FileTextIcon className="size-5" aria-hidden="true" />
              <span>
                <span className="block font-medium">Records</span>
                <span className="block text-xs opacity-75">{journal.records.length} entries</span>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="h-auto justify-start gap-3 rounded-lg border bg-card p-4 text-left data-active:bg-primary data-active:text-primary-foreground"
            >
              <NotebookPenIcon className="size-5" aria-hidden="true" />
              <span>
                <span className="block font-medium">Notes</span>
                <span className="block text-xs opacity-75">{journal.notes.length} visible</span>
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="access"
              className="h-auto justify-start gap-3 rounded-lg border bg-card p-4 text-left data-active:bg-primary data-active:text-primary-foreground"
            >
              <ActivityIcon className="size-5" aria-hidden="true" />
              <span>
                <span className="block font-medium">Access log</span>
                <span className="block text-xs opacity-75">{accessLogs.length} events</span>
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records">
            <Card>
              <CardHeader>
                <FileTextIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                <CardTitle>Medical records</CardTitle>
                <CardDescription>Medical records live in SQL only. Never on chain.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {journal.records.map((record) => (
                  <div key={record.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{record.title}</h2>
                      <Badge variant="outline">{record.date}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{record.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{record.practitioner}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes">
            <PatientNotesPanel journal={journal} onCreateNote={handleCreateNote} />
          </TabsContent>

          <TabsContent value="access">
            <Card>
              <CardHeader>
                <ActivityIcon className="size-5 text-muted-foreground" aria-hidden="true" />
                <CardTitle>Access log</CardTitle>
                <CardDescription>
                  Access events anchored to Solana. Patient and staff ids are salted hashes; nothing
                  identifying is written on chain.
                  {verification ? (
                    <span data-testid="access-log-verification" className="mt-1 block">
                      {verification.match
                        ? `Local mirror matches the chain head (${verification.localHead.slice(0, 8)}…).`
                        : "Local mirror does not match the chain head."}
                    </span>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {accessLogs.map((log) => {
                  const actor = actors[String(log.userId)];

                  return (
                    <div
                      key={log.eventId}
                      data-testid="access-log-row"
                      className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-medium">
                          {actor?.username ?? `User ${log.userId}`}
                          {actor ? (
                            <span className="ml-2 font-normal text-muted-foreground">
                              {roleLabel(actor.role)}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {log.action.replace("_", " ")} - {log.timestamp}
                        </p>
                        <p className="text-xs text-muted-foreground">Server: {log.serverId}</p>
                      </div>

                      <Badge
                        variant={log.status === "failed" ? "destructive" : "secondary"}
                        className="w-fit"
                        data-testid="access-log-status"
                      >
                        <CheckCircle2Icon className="size-3" aria-hidden="true" />
                        {anchorLabel(log)}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}

/**
 * One row's anchoring state.
 *
 * `pending` is the normal state between the durable write and the flusher's
 * next pass, so it says "anchoring" rather than "failed": a queued event is
 * not an error, and a demo that shows every row red because the flusher has
 * not run yet reads as broken when it is merely in flight.
 */
function anchorLabel(log: AccessLogEvent): string {
  if (log.status === "anchored") {
    return log.signature ? `Anchored ${log.signature.slice(0, 8)}…` : "Anchored";
  }
  if (log.status === "failed") {
    return "Anchor failed";
  }
  return "Anchoring…";
}
