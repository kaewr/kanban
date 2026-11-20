import { Alert, AlertDescription } from "@/components/ui/alert";

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (success) {
    return (
      <Alert role="status" className="border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
        <AlertDescription className="text-inherit">{success}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
