import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../../lib/supabase";
import type { PatientRecord, EncounterRecord } from "../patients/data";

export type RequestType = "medicine" | "lab";
export type RequestStatus =
  | "pending_payment"
  | "paid"
  | "in_progress"
  | "completed"
  | "released"
  | "cancelled";
export interface RequestItem {
  id: string;
  inventory_item_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}
export interface HmsRequest {
  request_id: string;
  patient_id: string;
  encounter_id: string;
  patient_number: string;
  patient_name: string;
  request_type: RequestType;
  status: RequestStatus;
  lab_result: string | null;
  created_at: string;
  ward_name: string | null;
  total: number;
  items: RequestItem[];
  bill_paid: boolean;
}
export interface InventoryItem {
  id: string;
  department: RequestType;
  item_name: string;
  item_code: string;
  unit: string;
  quantity_on_hand: number;
  unit_price: number;
  unit_cost: number;
  low_stock_threshold: number;
  is_active: boolean;
  catalog_type?: "requestable" | "supply";
}
export interface RequestableItem {
  id: string;
  department: RequestType;
  item_name: string;
  item_code: string;
  unit: string;
  quantity_on_hand: number;
  unit_price: number;
}
export function requestError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "The request could not be completed.";
  if (
    message.includes("42501") ||
    /permission|only an active|only the assigned/i.test(message)
  )
    return "Your staff role is not allowed to perform this action.";
  if (message.includes("23505"))
    return "That item code already exists in this department.";
  if (message.includes("P0002") || /not found/i.test(message))
    return "The selected record was not found. Refresh and try again.";
  if (
    /payment is required|awaiting payment|not awaiting payment/i.test(message)
  )
    return "This request must be paid by the Cashier before it can be released.";
  if (/result before releasing/i.test(message))
    return "Enter the lab result before releasing this request.";
  if (/stock changed since you opened|stale stock/i.test(message))
    return "Stock changed while you were editing. Refresh inventory, review the latest quantity, and try again.";
  if (/stock|quantity exceeds/i.test(message))
    return "There is not enough stock for that quantity.";
  return message.replace(/^.*?message:\\s*/i, "").replace(/^\\[.*?\\]\\s*/, "");
}
export function useRequestWorkspace() {
  return useQuery({
    queryKey: ["requests", "workspace"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "staff_request_workspace",
      );
      if (error) throw error;
      return (data ?? []) as HmsRequest[];
    },
  });
}
export function useRequestableItems(type: RequestType, enabled = true) {
  return useQuery({
    queryKey: ["requestable-items", type],
    enabled,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "staff_requestable_items",
        { p_department: type },
      );
      if (error) throw error;
      return (data ?? []) as RequestableItem[];
    },
  });
}
export function useInventoryItems(type: RequestType) {
  return useQuery({
    queryKey: ["inventory", type],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "staff_inventory_items",
        { p_department: type },
      );
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });
}
export function useCreateRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      patientId: string;
      encounterId: string;
      type: RequestType;
      itemId: string;
      quantity: number;
    }) => {
      const { data, error } = await getSupabaseClient().rpc(
        "create_hms_request",
        {
          p_patient_id: input.patientId,
          p_encounter_id: input.encounterId,
          p_type: input.type,
          p_items: [
            { inventory_item_id: input.itemId, quantity: input.quantity },
          ],
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["requests"] }),
        client.invalidateQueries({ queryKey: ["requestable-items"] }),
      ]);
    },
  });
}
export function usePayRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await getSupabaseClient().rpc(
        "cashier_pay_hms_request",
        { p_request_id: requestId },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["requests"] }),
        client.invalidateQueries({ queryKey: ["billing"] }),
      ]);
    },
  });
}
export function useAcceptLabRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await getSupabaseClient().rpc("lab_accept_hms_request", {
        p_request_id: requestId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["requests"] });
    },
  });
}
export function useFulfillRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requestId: string; labResult?: string }) => {
      const { data, error } = await getSupabaseClient().rpc(
        "fulfill_hms_request",
        {
          p_request_id: input.requestId,
          p_lab_result: input.labResult ?? null,
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["requests"] }),
        client.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
    },
  });
}
export function useSaveInventoryItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      type: RequestType;
      name: string;
      code: string;
      unit: string;
      stock: number;
      price: number;
      cost: number;
      lowStock: number;
      expectedStock: number | null;
      catalogType?: "requestable" | "supply";
      id?: string;
    }) => {
      const { data, error } = await getSupabaseClient().rpc(
        "inventory_save_item_typed",
        {
          p_department: input.type,
          p_item_name: input.name,
          p_item_code: input.code,
          p_unit: input.unit,
          p_quantity_on_hand: input.stock,
          p_unit_price: input.price,
          p_unit_cost: input.cost,
          p_low_stock_threshold: input.lowStock,
          p_expected_quantity: input.expectedStock,
          p_item_id: input.id ?? null,
          p_catalog_type: input.catalogType ?? "requestable",
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["inventory"] }),
        client.invalidateQueries({ queryKey: ["requestable-items"] }),
      ]);
    },
  });
}
export type { PatientRecord, EncounterRecord };
