import { Scene, Ticker as Crawl } from '@single-studio/core'

/** Add to OBS as a Browser source pointed at #/source/ticker */
export default function TickerSource() {
  return (
    <Scene className="flex items-end">
      <div className="h-14 w-full bg-slate-950/90 text-2xl text-white ring-1 ring-white/10">
        <Crawl name="ticker" speed={120} className="px-6" />
      </div>
    </Scene>
  )
}
