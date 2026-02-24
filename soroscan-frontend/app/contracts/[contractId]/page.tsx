"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/terminal/Card";
import { Button } from "@/components/terminal/Button";
import { ContractForm } from "./components/ContractForm";
import { BackfillModal } from "./components/BackfillModal";
import {
  getContract,
  updateContract,
  triggerBackfill,
} from "@/components/ingest/contract-graphql";
import type { Contract, ContractFormData, BackfillTask } from "@/components/ingest/contract-types";

export default function ContractDetailPage({ params }: { params: { contractId: string } }) {
  const router = useRouter();
  const [contract, setContract] = React.useState<Contract | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isEditing, setIsEditing] = React.useState(false);
  const [backfillTask, setBackfillTask] = React.useState<BackfillTask | null>(null);
  const [isBackfillModalOpen, setIsBackfillModalOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadContract = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getContract(params.contractId);
      setContract(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contract");
    } finally {
      setIsLoading(false);
    }
  }, [params.contractId]);

  React.useEffect(() => {
    loadContract();
  }, [loadContract]);

  const handleSave = async (data: ContractFormData) => {
    const updated = await updateContract(params.contractId, data);
    setContract(updated);
    setIsEditing(false);
  };

  const handleBackfill = async () => {
    if (!contract) return;

    try {
      const task = await triggerBackfill(contract.contractId);
      setBackfillTask(task);
      setIsBackfillModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger backfill");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-terminal-black p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <div className="text-center py-12 text-terminal-gray font-terminal-mono">
              LOADING...
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-terminal-black p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <div className="text-center py-12 text-terminal-danger font-terminal-mono">
              Contract not found
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-terminal-black p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-terminal-mono text-terminal-green mb-2">
              [CONTRACT_DETAIL]
            </h1>
            <p className="text-terminal-gray font-terminal-mono text-sm">
              {contract.contractId}
            </p>
          </div>
          <Button variant="secondary" onClick={() => router.push("/contracts")}>
            Back to List
          </Button>
        </div>

        {error && (
          <Card>
            <div className="p-4 border border-terminal-danger bg-terminal-danger/10 text-terminal-danger">
              {error}
            </div>
          </Card>
        )}

        <Card title={isEditing ? "EDIT_CONTRACT" : "CONTRACT_INFO"}>
          {isEditing ? (
            <ContractForm
              contract={contract}
              onSave={handleSave}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-terminal-cyan uppercase mb-1">Name</div>
                  <div className="text-terminal-green font-terminal-mono">{contract.name}</div>
                </div>
                <div>
                  <div className="text-xs text-terminal-cyan uppercase mb-1">Status</div>
                  <span
                    className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-mono ${
                      contract.status === "active"
                        ? "text-terminal-green border border-terminal-green/30 bg-terminal-green/10"
                        : "text-terminal-gray border border-terminal-gray/30 bg-terminal-gray/10"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        contract.status === "active"
                          ? "bg-terminal-green animate-pulse"
                          : "bg-terminal-gray"
                      }`}
                    />
                    {contract.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {contract.description && (
                <div>
                  <div className="text-xs text-terminal-cyan uppercase mb-1">Description</div>
                  <div className="text-terminal-green font-terminal-mono text-sm">
                    {contract.description}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-terminal-cyan uppercase mb-1">Event Count</div>
                <div className="text-terminal-green font-terminal-mono text-2xl">
                  {contract.eventCount.toLocaleString()}
                </div>
              </div>

              {contract.tags && contract.tags.length > 0 && (
                <div>
                  <div className="text-xs text-terminal-cyan uppercase mb-2">Tags</div>
                  <div className="flex gap-2 flex-wrap">
                    {contract.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-terminal-cyan/10 text-terminal-cyan border border-terminal-cyan/30 text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-terminal-green/30">
                <Button variant="primary" onClick={() => setIsEditing(true)}>
                  Edit Contract
                </Button>
                <Button variant="secondary" onClick={handleBackfill}>
                  Trigger Backfill
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push(`/contracts/${contract.contractId}/events/explorer`)}
                >
                  View Events
                </Button>
              </div>
            </div>
          )}
        </Card>

        <BackfillModal
          isOpen={isBackfillModalOpen}
          onClose={() => setIsBackfillModalOpen(false)}
          task={backfillTask}
        />
      </div>
    </div>
  );
}
