import { cn } from "@/lib/utils";

// Skeleton = state memuat (bukan teks "Memuat…") — lihat Aturan Main §0.8.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-xl bg-paper-deep", className)}
      {...props}
    />
  );
}

export { Skeleton };
