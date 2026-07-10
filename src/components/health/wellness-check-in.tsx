"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const MOOD_OPTIONS = [
  { value: "great", emoji: "😄", label: "Great" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "okay", emoji: "😐", label: "Okay" },
  { value: "low", emoji: "😔", label: "Low" },
  { value: "concern", emoji: "😟", label: "Concern" },
] as const;

type StudentOption = { id: string; name: string };

type WellnessCheckInProps = {
  students: StudentOption[];
};

export function WellnessCheckIn({ students }: WellnessCheckInProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filtered = students.filter((student) =>
    student.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const selected = students.find((student) => student.id === selectedId);

  async function saveCheckIn(moodValue: string) {
    if (!selectedId) {
      toast.error("Pick a student first");
      return;
    }
    setMood(moodValue);
    setIsSaving(true);

    const response = await fetch("/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "wellness",
        studentId: selectedId,
        mood: moodValue,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      toast.error("Could not save check-in");
      return;
    }

    const label = MOOD_OPTIONS.find((option) => option.value === moodValue)?.label;
    toast.success(`${selected?.name ?? "Student"} — ${label ?? moodValue}`);
    setMood(null);
    setSelectedId(null);
    setQuery("");
    router.refresh();
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-lg">Quick wellness check</CardTitle>
        <p className="text-sm text-muted-foreground">
          Tap a student, then tap how they&apos;re doing — two taps, done.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search student..."
            className="min-h-11 pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {filtered.slice(0, 12).map((student) => (
            <button
              key={student.id}
              type="button"
              className={cn(
                "min-h-11 rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                selectedId === student.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-muted/30 hover:bg-muted/60",
              )}
              onClick={() => setSelectedId(student.id)}
            >
              {student.name}
            </button>
          ))}
        </div>

        {selected && (
          <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
            <p className="text-center font-medium">{selected.name}</p>
            <div className="grid grid-cols-5 gap-2">
              {MOOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={isSaving}
                  className={cn(
                    "flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-2xl border bg-background transition-transform active:scale-95",
                    mood === option.value && "border-primary ring-2 ring-primary/30",
                    option.value === "concern" && "border-amber-300/60",
                  )}
                  onClick={() => void saveCheckIn(option.value)}
                >
                  <span className="text-3xl" aria-hidden>
                    {option.emoji}
                  </span>
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
