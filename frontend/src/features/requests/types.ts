export type RequestType = "medicine" | "lab";
export type RequestStatus =
  | "pending_payment"
  | "paid"
  | "in_progress"
  | "completed"
  | "released"
  | "cancelled";

export interface RequestSummary {
  requestId: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  encounterId: string;
  requestType: RequestType;
  requestStatus: RequestStatus;
  wardId: string | null;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
  labResult: string | null;
}
