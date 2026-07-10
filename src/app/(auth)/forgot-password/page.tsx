import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ForgotPasswordPage() {
  return (
    <Card className="border-none shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl">Reset your password</CardTitle>
        <CardDescription>
          Magic link password reset will be available in a later stage. For now,
          contact your camp administrator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          We&apos;re setting up email delivery next. Your admin can reset your
          password from Settings once that&apos;s live.
        </p>
      </CardContent>
      <CardFooter>
        <Link
          href="/login"
          className={cn(buttonVariants(), "min-h-11 w-full")}
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
