import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Clock3, RefreshCw, Stethoscope, UserRound } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import { useDoctors } from "../patients/data";

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(value ?? 0));

export function AvailableDoctorsWorkspace() {
  const navigate = useNavigate();
  const doctors = useDoctors();
  const orderedDoctors = useMemo(
    () => [...(doctors.data ?? [])].sort((a, b) => Number(b.is_on_duty) - Number(a.is_on_duty) || a.full_name.localeCompare(b.full_name)),
    [doctors.data],
  );
  const availableCount = orderedDoctors.filter((doctor) => doctor.is_on_duty).length;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Doctor availability</h2>
          <p className="mt-1 text-sm text-slate-500">Check who is currently marked on duty and start a consultation with that doctor.</p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void doctors.refetch()} disabled={doctors.isFetching}>
          <RefreshCw size={15} className={doctors.isFetching ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {doctors.isError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          Could not load doctor availability. Refresh to try again.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3 p-1">
              <div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Activity size={20} /></div>
              <div><p className="text-sm text-slate-500">On duty</p><p className="text-2xl font-semibold">{doctors.isLoading ? "—" : availableCount}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3 p-1">
              <div className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-600"><UserRound size={20} /></div>
              <div><p className="text-sm text-slate-500">Active doctors</p><p className="text-2xl font-semibold">{doctors.isLoading ? "—" : orderedDoctors.length}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3 p-1">
              <div className="grid size-11 place-items-center rounded-xl bg-sky-50 text-sky-700"><Clock3 size={20} /></div>
              <div><p className="text-sm text-slate-500">Status source</p><p className="text-sm font-semibold">Staff duty status</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold">Doctors</h3>
        </CardHeader>
        <CardContent>
          {doctors.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading doctor availability…</p>
          ) : orderedDoctors.length === 0 ? (
            <div className="py-10 text-center">
              <Stethoscope className="mx-auto mb-3 text-slate-400" size={28} />
              <p className="font-medium">No active doctors found</p>
              <p className="mt-1 text-sm text-slate-500">Ask the administrator to activate doctor records.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {orderedDoctors.map((doctor) => (
                <article key={doctor.id} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className={`grid size-11 shrink-0 place-items-center rounded-full ${doctor.is_on_duty ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      <Stethoscope size={19} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{doctor.full_name}</h4>
                        <Badge tone={doctor.is_on_duty ? "success" : "neutral"}>{doctor.is_on_duty ? "On duty" : "Off duty"}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{doctor.specialty || "General practice"}</p>
                      <p className="mt-2 text-xs text-slate-500">Consultation fee: {money(doctor.fixed_fee)}</p>
                    </div>
                  </div>
                  {doctor.is_on_duty ? (
                    <Button type="button" onClick={() => { navigate(`/encounters?doctorId=${encodeURIComponent(doctor.id)}`); }}>
                      Select doctor
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" disabled>Unavailable</Button>
                  )}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">Availability reflects the doctor’s current on-duty setting in HMS; confirm with staff for urgent cases.</p>
    </div>
  );
}
