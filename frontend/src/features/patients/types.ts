export type PatientStatus =
  | "registered"
  | "in_emergency"
  | "admitted"
  | "awaiting_discharge"
  | "discharged"
  | "outpatient";

export interface PatientSummary {
  patientId: string;
  patientNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status: PatientStatus;
  currentWardId: string | null;
  createdAt: string;
}
