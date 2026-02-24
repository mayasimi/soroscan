import { graphqlRequest } from "./graphql";
import type { Contract, ContractFormData, BackfillTask } from "./contract-types";

export const LIST_CONTRACTS_QUERY = `
  query ListContracts {
    contracts {
      id
      contractId
      name
      description
      tags
      status
      eventCount
      createdAt
      updatedAt
    }
  }
`;

export const GET_CONTRACT_QUERY = `
  query GetContract($id: String!) {
    contract(id: $id) {
      id
      contractId
      name
      description
      tags
      status
      eventCount
      createdAt
      updatedAt
    }
  }
`;

export const REGISTER_CONTRACT_MUTATION = `
  mutation RegisterContract($input: ContractInput!) {
    registerContract(input: $input) {
      id
      contractId
      name
      description
      tags
      status
      eventCount
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_CONTRACT_MUTATION = `
  mutation UpdateContract($id: String!, $input: ContractInput!) {
    updateContract(id: $id, input: $input) {
      id
      contractId
      name
      description
      tags
      status
      eventCount
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_CONTRACT_MUTATION = `
  mutation DeleteContract($id: String!) {
    deleteContract(id: $id) {
      success
    }
  }
`;

export const TRIGGER_BACKFILL_MUTATION = `
  mutation TriggerBackfill($contractId: String!) {
    triggerBackfill(contractId: $contractId) {
      taskId
      contractId
      status
      message
    }
  }
`;

export async function listContracts(): Promise<Contract[]> {
  const data = await graphqlRequest<{ contracts: Contract[] }, Record<string, never>>(
    LIST_CONTRACTS_QUERY,
    {}
  );
  return data.contracts;
}

export async function getContract(id: string): Promise<Contract> {
  const data = await graphqlRequest<{ contract: Contract }, { id: string }>(
    GET_CONTRACT_QUERY,
    { id }
  );
  return data.contract;
}

export async function registerContract(input: ContractFormData): Promise<Contract> {
  const data = await graphqlRequest<
    { registerContract: Contract },
    { input: ContractFormData }
  >(REGISTER_CONTRACT_MUTATION, { input });
  return data.registerContract;
}

export async function updateContract(
  id: string,
  input: ContractFormData
): Promise<Contract> {
  const data = await graphqlRequest<
    { updateContract: Contract },
    { id: string; input: ContractFormData }
  >(UPDATE_CONTRACT_MUTATION, { id, input });
  return data.updateContract;
}

export async function deleteContract(id: string): Promise<boolean> {
  const data = await graphqlRequest<
    { deleteContract: { success: boolean } },
    { id: string }
  >(DELETE_CONTRACT_MUTATION, { id });
  return data.deleteContract.success;
}

export async function triggerBackfill(contractId: string): Promise<BackfillTask> {
  const data = await graphqlRequest<
    { triggerBackfill: BackfillTask },
    { contractId: string }
  >(TRIGGER_BACKFILL_MUTATION, { contractId });
  return data.triggerBackfill;
}
