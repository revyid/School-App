import { redirect } from "next/navigation";

// /pantau → dasbor root (satu shell di (dash)/pantau).
export default function PantauIndex() {
  redirect("/pantau/dashboard");
}
