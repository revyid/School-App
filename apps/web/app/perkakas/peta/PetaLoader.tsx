"use client";
import dynamic from "next/dynamic";

const PetaClient = dynamic(() => import("./PetaClient"), { ssr: false });

export default function PetaLoader() {
  return <PetaClient />;
}
