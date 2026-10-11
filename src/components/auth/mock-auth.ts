"use client";

import { useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "@/lib/api/client";
import type { LoginResponse } from "@/lib/types/api";
import type { Role, SessionUser } from "@/lib/types/api";

export const MOCK_USERS: Array<SessionUser & { displayName: string }> = [
  {
    id: 1,
    username: "dr_test",
    role: "doctor",
    organizationId: 1,
    patientId: null,
    displayName: "Dr. Sofia Berg",
  },
  {
    id: 2,
    username: "nurse_test",
    role: "nurse",
    organizationId: 1,
    patientId: null,
    displayName: "Nurse Alex Lind",
  },
  {
    id: 3,
    username: "amb_test",
    role: "ambulance",
    organizationId: 2,
    patientId: null,
    displayName: "Ambulance Unit A",
  },
  {
    id: 4,
    username: "patient_test",
    role: "patient",
    organizationId: null,
    patientId: 1,
    displayName: "Anna Kowalska",
  },
  {
    id: 5,
    username: "unauth_test",
    role: "unauthorized",
    organizationId: null,
    patientId: null,
    displayName: "Unauthorized visitor",
  },
  {
    id: 6,
    username: "vc_test",
    role: "primary_care",
    organizationId: 3,
    patientId: null,
    displayName: "Ekfors Primary Care Centre (nurse)",
  },
];

export function roleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    doctor: "Doctor",
    nurse: "Nurse",
    ambulance: "Ambulance",
    primary_care: "Primary care",
    patient: "Patient",
    unauthorized: "Unauthorized",
  };
  return labels[role];
}

export function getMockUserDisplayName(user: SessionUser): string {
  return MOCK_USERS.find((candidate) => candidate.id === user.id)?.displayName ?? user.username;
}

export function useSession(): SessionUser | null | undefined {
  const [session, setSession] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    apiRequest<LoginResponse>("/api/auth/me")
      .then(({ user }) => {
        if (isMounted) setSession(user);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        if (error instanceof ApiClientError && error.status === 401) {
          setSession(null);
          return;
        }
        setSession(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return session;
}
