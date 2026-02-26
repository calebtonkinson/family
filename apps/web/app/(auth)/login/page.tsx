import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;

  if (session) {
    redirect("/dashboard");
  }

  const error = params?.error;
  const devLoginEnabled = process.env.DEV_LOGIN_ENABLED === "true";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Home Management</CardTitle>
          <CardDescription>Keep the household in sync</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
              {error === "AccessDenied"
                ? "Access denied. This email is not authorized."
                : error === "CredentialsSignin"
                  ? "Invalid email or password."
                  : "An error occurred. Please try again."}
            </div>
          )}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              <GoogleIcon className="mr-2 h-5 w-5" />
              Sign in with Google
            </Button>
          </form>
          {devLoginEnabled && (
            <>
              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  or
                </span>
              </div>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await signIn("dev-credentials", {
                    email: formData.get("email") as string,
                    password: formData.get("password") as string,
                    redirectTo: "/dashboard",
                  });
                }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="dev@example.com" required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" placeholder="Dev password" required />
                </div>
                <Button type="submit" variant="outline" className="w-full" size="lg">
                  Dev Login
                </Button>
              </form>
            </>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Only authorized family members can sign in.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
