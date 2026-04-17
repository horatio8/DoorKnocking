import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-50 px-4 py-12">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-widest text-navy-500">Campaign OS</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-navy-900">
            Door Knock
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to continue.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
