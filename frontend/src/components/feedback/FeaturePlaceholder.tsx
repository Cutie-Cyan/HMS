interface FeaturePlaceholderProps {
  title: string;
  description: string;
}

export function FeaturePlaceholder({
  title,
  description,
}: FeaturePlaceholderProps) {
  return (
    <section className="mx-auto max-w-4xl rounded-xl border border-dashed border-slate-300 bg-white p-6 md:p-8">
      <p className="text-sm font-medium text-teal-700">Feature module</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
        {description}
      </p>
      <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        This module is scaffolded but not operational yet. No sample patient or
        financial records are shown.
      </p>
    </section>
  );
}
