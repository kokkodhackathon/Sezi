"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CodeVerify } from "@/components/account/code-input";

function VerifyContent() {
  const sp = useSearchParams();
  const email = sp.get("email") ?? "";
  return <CodeVerify mode="signup" email={email} />;
}

/** Kayıt doğrulama kodu sayfası (`/hesap/dogrula?email=`). */
export default function VerifySignupPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
