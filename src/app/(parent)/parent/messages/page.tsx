import { ParentMessagingHub } from "@/components/messaging/parent-messaging-hub";

type ParentMessagesPageProps = {
  searchParams: Promise<{ thread?: string }>;
};

export default async function ParentMessagesPage({
  searchParams,
}: ParentMessagesPageProps) {
  const params = await searchParams;

  return (
    <ParentMessagingHub mode="parent" initialThreadId={params.thread} />
  );
}
