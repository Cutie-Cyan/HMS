export interface PatientSummary {
  patientId: string;
  patientNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  status: "outpatient" | "admitted" | "discharged";
  currentWardId: string | null;
  createdAt: string;
}
