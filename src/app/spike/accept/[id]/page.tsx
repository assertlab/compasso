import { Suspense } from "react";
import { AcceptInvitation } from "./accept";

export default function AcceptPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <Inner params={params} />
    </Suspense>
  );
}

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AcceptInvitation id={id} />;
}
