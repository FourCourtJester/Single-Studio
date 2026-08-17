import { Scene, Toggle, Variable } from '@single-studio/core'

/** Add to OBS as a Browser source pointed at #/source/lowerthird */
export default function LowerThird() {
  return (
    <Scene className="flex items-end p-16">
      <Toggle name="lowerthird" className="w-full max-w-2xl">
        <div className="overflow-hidden rounded-md bg-slate-950/90 shadow-2xl ring-1 ring-white/10">
          <div className="border-l-4 border-sky-500 px-6 py-4">
            <div className="text-3xl font-semibold text-white">
              <Variable name="lowerthird.title" fallback="Title" fit />
            </div>
            <div className="text-lg text-slate-300">
              <Variable name="lowerthird.subtitle" fallback="" />
            </div>
          </div>
        </div>
      </Toggle>
    </Scene>
  )
}
