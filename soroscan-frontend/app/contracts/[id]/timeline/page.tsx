import { TimelineView } from "@/components/ingest/TimelineView";

export default function ContractTimelinePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  return <TimelineView contractId={id} />;
}
