import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../../lib/supabase";

export interface PatientRecord {
  patient_id: string;
  patient_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  sex: string;
  phone: string | null;
  address: string | null;
  pwd_or_senior: boolean;
  status: string;
  current_ward_id: string | null;
  created_at: string;
}
export interface PatientRegistrationSubmission {
  submission_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  sex: string;
  phone: string | null;
  address: string | null;
  pwd_or_senior: boolean;
  submitted_at: string;
}
export interface DoctorRecord {
  id: string;
  full_name: string;
  specialty: string | null;
  is_on_duty: boolean;
  fixed_fee: number;
  is_active: boolean;
}
export interface EncounterRecord {
  encounter_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string | null;
  findings: string | null;
  recommendations: string | null;
  recommendation_type: string | null;
  encounter_status: "open" | "awaiting_discharge" | "closed";
  admitted_at: string | null;
  discharged_at: string | null;
  bed_id: string | null;
  patient_status: string;
  current_ward_id: string | null;
  created_at: string;
}
export interface RegisterPatientInput {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  address: string;
  pwdOrSenior: boolean;
}
export interface DoctorInput {
  fullName: string;
  specialty: string;
  isOnDuty: boolean;
  fixedFee: number;
  doctorId?: string;
}
export interface EncounterInput {
  patientId: string;
  findings: string;
  recommendations: string;
  recommendationType: string;
  doctorId: string | null;
  encounterId?: string;
}
export function humanizeError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "The request could not be completed.";
  if (message.includes("42501") || message.toLowerCase().includes("permission"))
    return "Your staff role is not allowed to perform this action.";
  if (
    message.includes("23505") ||
    message.toLowerCase().includes("already has an open encounter")
  )
    return "This patient already has an open encounter. Select it from the queue to update the form.";
  if (message.includes("P0002") || message.toLowerCase().includes("not found"))
    return "The selected record could not be found. Refresh the list and try again.";
  if (message.includes("22023"))
    return message.replace(/^.*?message:\s*/i, "").replace(/^\[.*?\]\s*/, "");
  return message;
}
export function usePatientDirectory(search = "", enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["patients", "directory", search],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "staff_patient_directory",
        { p_search: search.trim() || null },
      );
      if (error) throw error;
      return (data ?? []) as PatientRecord[];
    },
  });
}
export function useDoctors(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["doctors", "active"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("doctors")
        .select("id,full_name,specialty,is_on_duty,fixed_fee,is_active")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as DoctorRecord[];
    },
  });
}
export function useOpenEncounters(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["encounters", "open"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "staff_encounter_queue",
        { p_status: "open" },
      );
      if (error) throw error;
      return (data ?? []) as EncounterRecord[];
    },
  });
}

export function usePendingPatientSubmissions(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["patients", "registration-submissions", "pending"],
    queryFn: async () => {
      const { data, error } = await getSupabaseClient().rpc(
        "info_officer_pending_patient_submissions",
      );
      if (error) throw error;
      return (data ?? []) as PatientRegistrationSubmission[];
    },
  });
}
export function useReviewPatientSubmission() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { submissionId: string; approve: boolean }) => {
      const { data, error } = await getSupabaseClient().rpc(
        "info_officer_review_patient_submission",
        { p_submission_id: input.submissionId, p_approve: input.approve },
      );
      if (error) throw error;
      const rows = data as { submission_id: string; submission_status: string; patient_id: string | null; patient_number: string | null }[] | null;
      if (!rows?.[0]) throw new Error("The submission review did not return a result.");
      return rows[0];
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useRegisterPatient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterPatientInput) => {
      const { data, error } = await getSupabaseClient().rpc(
        "info_officer_register_patient",
        {
          p_first_name: input.firstName,
          p_middle_name: input.middleName || null,
          p_last_name: input.lastName,
          p_date_of_birth: input.dateOfBirth,
          p_sex: input.sex,
          p_phone: input.phone || null,
          p_address: input.address || null,
          p_pwd_or_senior: input.pwdOrSenior,
        },
      );
      if (error) throw error;
      const rows = data as
        | { patient_id: string; patient_number: string }[]
        | null;
      if (!rows?.[0])
        throw new Error("Registration did not return a patient number.");
      return rows[0];
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["patients"] }),
  });
}
export function useSaveDoctor() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: DoctorInput) => {
      const { data, error } = await getSupabaseClient().rpc(
        "info_officer_save_doctor",
        {
          p_full_name: input.fullName,
          p_specialty: input.specialty || null,
          p_is_on_duty: input.isOnDuty,
          p_fixed_fee: input.fixedFee,
          p_doctor_id: input.doctorId ?? null,
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["doctors"] }),
  });
}
export function useSaveEncounter() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: EncounterInput) => {
      const { data, error } = await getSupabaseClient().rpc(
        "emergency_nurse_save_encounter",
        {
          p_patient_id: input.patientId,
          p_findings: input.findings || null,
          p_recommendations: input.recommendations || null,
          p_recommendation_type: input.recommendationType || null,
          p_doctor_id: input.doctorId || null,
          p_encounter_id: input.encounterId ?? null,
        },
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["encounters"] });
      client.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
