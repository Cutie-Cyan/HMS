export interface EncounterSummary {
  encounterId: string;
  patientId: string;
  patientNumber: string;
  patientName: string;
  doctorId: string | null;
  doctorName: string | null;
  findings: string | null;
  recommendations: string | null;
  encounterStatus: "open" | "awaiting_discharge" | "closed";
  admittedAt: string | null;
  dischargedAt: string | null;
  bedId: string | null;
  currentWardId: string | null;
  createdAt: string;
}
