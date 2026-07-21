"use client";

import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StudentPickerOption = {
  id: string;
  name: string;
};

type StudentMultiPickerProps = {
  students: StudentPickerOption[];
  value: string[];
  onChange: (studentIds: string[]) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
};

export function StudentMultiPicker({
  students,
  value,
  onChange,
  label = "Students involved",
  placeholder = "Search students by name...",
  disabled = false,
}: StudentMultiPickerProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const selected = useMemo(
    () => students.filter((student) => value.includes(student.id)),
    [students, value],
  );

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const available = students.filter((student) => !value.includes(student.id));
    if (!q) return available.slice(0, 40);
    return available
      .filter((student) => student.name.toLowerCase().includes(q))
      .slice(0, 40);
  }, [students, value, deferredQuery]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function addStudent(id: string) {
    if (value.includes(id)) return;
    onChange([...value, id]);
    setQuery("");
    setOpen(true);
  }

  function removeStudent(id: string) {
    onChange(value.filter((studentId) => studentId !== id));
  }

  return (
    <div ref={rootRef} className="space-y-2">
      <label htmlFor={listId} className="text-sm font-medium">
        {label}
      </label>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected students">
          {selected.map((student) => (
            <li key={student.id}>
              <Badge
                variant="secondary"
                className="gap-1 rounded-xl px-2.5 py-1.5 text-sm font-medium"
              >
                {student.name}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-muted"
                  onClick={() => removeStudent(student.id)}
                  aria-label={`Remove ${student.name}`}
                  disabled={disabled}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={listId}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          value={query}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          className="min-h-11 pl-9"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (filtered[0]) addStudent(filtered[0].id);
            }
            if (event.key === "Backspace" && !query && selected.length > 0) {
              removeStudent(selected[selected.length - 1]!.id);
            }
          }}
        />

        {open && (
          <ul
            id={`${listId}-listbox`}
            role="listbox"
            className={cn(
              "absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-md",
            )}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                {deferredQuery.trim()
                  ? "No matching students"
                  : value.length === students.length
                    ? "All students selected"
                    : "Start typing a name"}
              </li>
            ) : (
              filtered.map((student) => (
                <li key={student.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-accent"
                    onClick={() => addStudent(student.id)}
                  >
                    {student.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Select at least one student involved in this incident.
        </p>
      )}
    </div>
  );
}
