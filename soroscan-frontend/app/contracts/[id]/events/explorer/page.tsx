import { EventExplorerView } from "@/components/ingest/EventExplorerView";

export default function ContractExplorerPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  return <EventExplorerView contractId={id} />;
}
