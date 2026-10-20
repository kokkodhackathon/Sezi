"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CodeVerify } from "@/components/account/code-input";

function ResetCodeContent() {
  const sp = useSearchParams();
  const email = sp.get("email") ?? "";
  return <CodeVerify mode="recovery" email={email} />;
}

/** Şifre sıfırlama kodu doğrulama sayfası (`/hesap/sifirlama-kodu?email=`). */
export default function ResetCodePage() {
  return (
    <Suspense>
      <ResetCodeContent />
    </Suspense>
  );
}
