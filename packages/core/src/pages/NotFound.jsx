export function NotFoundPage({ title = 'Not found', detail }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-2 bg-slate-950 p-8 text-center text-slate-300">
      <h1 className="text-lg font-semibold">{title}</h1>
      {detail ? <p className="max-w-prose text-sm text-slate-500">{detail}</p> : null}
    </div>
  )
}
