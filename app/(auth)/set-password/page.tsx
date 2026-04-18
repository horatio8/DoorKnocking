import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";

export default function SetPasswordPage() {
  return (
    <div className="mx-auto mt-10 w-full max-w-sm px-4">
      <h1 className="font-serif text-2xl font-semibold text-navy-900">Set your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a password you&apos;ll remember. You can change it later in Settings.
      </p>
      <div className="mt-6">
        <SetPasswordForm />
      </div>
    </div>
  );
}
