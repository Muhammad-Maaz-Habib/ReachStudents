"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { onboardingSchema } from "@/lib/validations/auth";

export function OnboardingForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const values = {
      organizationName: String(formData.get("organizationName") ?? ""),
      sessionName: String(formData.get("sessionName") ?? ""),
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? ""),
      adminName: String(formData.get("adminName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };

    const parsed = onboardingSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0];
        if (typeof key === "string") fieldErrors[key] = issue.message;
      });
      setErrors(fieldErrors);
      setIsLoading(false);
      return;
    }

    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    const data = await response.json();
    setIsLoading(false);

    if (!response.ok) {
      toast.error(data.error ?? "Could not create organization");
      return;
    }

    const signInResult = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });

    if (signInResult?.error) {
      toast.success("Organization created! Please sign in.");
      router.push("/login");
      return;
    }

    toast.success("Welcome to Waypoint!");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="border-none shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Set up your organization</CardTitle>
        <CardDescription>
          Create your camp, first summer session, and admin account in one step.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="organizationName">Organization name</Label>
            <Input
              id="organizationName"
              name="organizationName"
              placeholder="Summit Summer Camps"
              className="min-h-11"
            />
            {errors.organizationName && (
              <p className="text-sm text-destructive">{errors.organizationName}</p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="sessionName">First session name</Label>
            <Input
              id="sessionName"
              name="sessionName"
              placeholder="Session 1 — June 2026"
              className="min-h-11"
            />
            {errors.sessionName && (
              <p className="text-sm text-destructive">{errors.sessionName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Session start</Label>
            <Input id="startDate" name="startDate" type="date" className="min-h-11" />
            {errors.startDate && (
              <p className="text-sm text-destructive">{errors.startDate}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">Session end</Label>
            <Input id="endDate" name="endDate" type="date" className="min-h-11" />
            {errors.endDate && (
              <p className="text-sm text-destructive">{errors.endDate}</p>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="adminName">Your name</Label>
            <Input id="adminName" name="adminName" className="min-h-11" />
            {errors.adminName && (
              <p className="text-sm text-destructive">{errors.adminName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Admin email</Label>
            <Input id="email" name="email" type="email" className="min-h-11" />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              className="min-h-11"
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="min-h-11 w-full" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create organization"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
