import { SignedInGate } from "@/components/signed-in-gate";
import { Placement } from "./placement";

export default function WelcomePage() {
  return (
    <main className="pt-safe mx-auto min-h-dvh max-w-xl px-5 pb-10">
      <SignedInGate>
        <Placement />
      </SignedInGate>
    </main>
  );
}
