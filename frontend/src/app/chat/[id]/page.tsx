import { ChatWorkspace } from "@/components/dashboard/chat-workspace";

export const metadata = {
  title: "Chat Session | Draythos",
};

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatWorkspace initialSessionId={id} />;
}

