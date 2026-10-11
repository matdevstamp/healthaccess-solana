"use client";

import { useState } from "react";
import Link from "next/link";
import { SearchIcon, UserRoundIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api/client";
import type { PatientSearchFilter, PatientSearchResponse, PatientSummary } from "@/lib/types/api";

const FILTER_OPTIONS: Array<{ value: PatientSearchFilter; label: string }> = [
  { value: "name", label: "Name" },
  { value: "dob", label: "Date of birth" },
  { value: "personalNumber", label: "Personal number" },
];

export function PatientSearch() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PatientSearchFilter>("name");
  const [result, setResult] = useState<PatientSearchResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const hasSearched = result !== null || error !== null;

  async function searchPatients(nextPage = 1) {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams({
      q: trimmedQuery,
      page: String(nextPage),
      filter,
    });

    try {
      const data = await apiRequest<PatientSearchResponse>(`/api/patients?${params}`);
      setResult(data);
      setPage(data.page);
    } catch {
      setError("Could not search patients. Try again or check your role.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void searchPatients(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Find patient</CardTitle>
          <CardDescription>Search by name, date of birth, or personal number.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_190px_auto]" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="patient-search">Search</Label>
              <div className="relative">
                <SearchIcon
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="patient-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search patients..."
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-filter">Filter</Label>
              <Select
                value={filter}
                onValueChange={(value) => setFilter(value as PatientSearchFilter)}
              >
                <SelectTrigger id="patient-filter" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="mt-auto h-10" disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isLoading ? (
        <SearchLoading />
      ) : (
        <SearchResults
          error={error}
          hasSearched={hasSearched}
          page={page}
          query={result?.query ?? trimmedQuery}
          result={result}
          onPageChange={(nextPage) => void searchPatients(nextPage)}
        />
      )}
    </div>
  );
}

function SearchResults({
  error,
  hasSearched,
  page,
  query,
  result,
  onPageChange,
}: {
  error: string | null;
  hasSearched: boolean;
  page: number;
  query: string;
  result: PatientSearchResponse | null;
  onPageChange: (page: number) => void;
}) {
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h2 className="font-medium">Search failed</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!hasSearched) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h2 className="font-medium">Start with a search</h2>
          <p className="mt-2 text-sm text-muted-foreground">No search results yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (!result || result.patients.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h2 className="font-medium">No patients found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another fictional patient or change the selected filter.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Showing {result.patients.length} of {result.total} result{result.total === 1 ? "" : "s"}.
      </p>
      {result.patients.map((patient) => (
        <PatientResultCard key={patient.id} patient={patient} query={query} />
      ))}
      {result.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {result.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= result.totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PatientResultCard({ patient, query }: { patient: PatientSummary; query: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <UserRoundIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-medium">{highlight(patient.name, query)}</h2>
            <p className="text-sm text-muted-foreground">
              DOB {highlight(patient.dateOfBirth, query)} -{" "}
              {highlight(patient.personalNumber, query)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">{patient.recordCount} records</Badge>
              <Badge variant="secondary">{patient.noteCount} notes</Badge>
              <Badge variant="outline">Last visit {patient.lastVisit}</Badge>
            </div>
          </div>
        </div>
        <Button asChild>
          <Link href={`/patients/${patient.id}`}>Open journal</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SearchLoading() {
  return (
    <div className="grid gap-3">
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
      <Skeleton className="h-28" />
    </div>
  );
}

function highlight(value: string, query: string) {
  const trimmedQuery = query.trim();
  const index = trimmedQuery
    ? value.toLocaleLowerCase("pl-PL").indexOf(trimmedQuery.toLocaleLowerCase("pl-PL"))
    : -1;

  if (index === -1) {
    return value;
  }

  const before = value.slice(0, index);
  const match = value.slice(index, index + trimmedQuery.length);
  const after = value.slice(index + trimmedQuery.length);

  return (
    <>
      {before}
      <mark className="rounded bg-yellow-200 px-0.5 text-yellow-950">{match}</mark>
      {after}
    </>
  );
}
