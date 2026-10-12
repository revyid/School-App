import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// cn = gabungan clsx + tailwind-merge (pola resmi shadcn/ui).
// Dipakai semua komponen di components/ui dan halaman.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
