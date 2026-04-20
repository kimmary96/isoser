import { AssistantPreviewClient } from "./assistant-preview-client";

export default function AssistantPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <AssistantPreviewClient />
      </div>
    </main>
  );
}
