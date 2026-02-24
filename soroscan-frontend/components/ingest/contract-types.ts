export interface Contract {
  id: string;
  contractId: string;
  name: string;
  description?: string;
  tags?: string[];
  status: "active" | "inactive";
  eventCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContractFormData {
  contractId: string;
  name: string;
  description?: string;
  tags?: string[];
  status: "active" | "inactive";
}

export interface BackfillTask {
  taskId: string;
  contractId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  message?: string;
}
