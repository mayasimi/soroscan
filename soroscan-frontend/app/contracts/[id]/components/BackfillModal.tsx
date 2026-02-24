"use client";

import * as React from "react";
import { Modal } from "@/components/terminal/Modal";
import { Button } from "@/components/terminal/Button";
import type { BackfillTask } from "@/components/ingest/contract-types";

interface BackfillModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: BackfillTask | null;
}

export function BackfillModal({ isOpen, onClose, task }: BackfillModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="BACKFILL_TASK">
      <div className="space-y-4">
        {task ? (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-terminal-cyan">Task ID:</span>
                <span className="font-mono text-terminal-green">{task.taskId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-terminal-cyan">Status:</span>
                <span
                  className={`font-mono ${
                    task.status === "completed"
                      ? "text-terminal-green"
                      : task.status === "failed"
                        ? "text-terminal-danger"
                        : task.status === "running"
                          ? "text-terminal-cyan"
                          : "text-terminal-gray"
                  }`}
                >
                  {task.status.toUpperCase()}
                </span>
              </div>
              {task.progress !== undefined && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-terminal-cyan">Progress:</span>
                    <span className="font-mono text-terminal-green">{task.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-terminal-black border border-terminal-green/30">
                    <div
                      className="h-full bg-terminal-green transition-all duration-300"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                </div>
              )}
              {task.message && (
                <div className="mt-4 p-3 bg-terminal-green/10 border border-terminal-green/30 text-sm">
                  {task.message}
                </div>
              )}
            </div>

            <div className="pt-4">
              <Button variant="primary" onClick={onClose} className="w-full">
                CLOSE
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center text-terminal-gray">No task information available</div>
        )}
      </div>
    </Modal>
  );
}
