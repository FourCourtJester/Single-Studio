import { Image, Scene, Toggle, Variable } from '@single-studio/core'

/**
 * Add to OBS as a Browser source pointed at #/source/sponsor
 *
 * Demonstrates the two image shapes. The badge is templated from a value
 * (`:value:` substituted with a slugified team name); the sponsor card is a URL
 * the operator pastes straight in, with no studio code involved.
 *
 * `vars` maps a colour the operator controls onto a CSS custom property, so the
 * card's accent is driven by the board without needing a component for it.
 */
export default function Sponsor() {
  return (
    <Scene className="flex items-end justify-start p-12" vars={{ '--accent': 'variables.sponsor.color' }}>
      <Toggle name="sponsor">
        <div className="flex items-center gap-4 rounded-lg bg-slate-950/90 p-4 ring-1 ring-white/10" style={{ borderLeft: '6px solid var(--accent, #0ea5e9)' }}>
          <div className="flex h-24 w-40 items-center justify-center">
            <Image name="sponsor.url" fallback="./logos/placeholder.svg" retries={1} alt="" className="sponsor-image" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-widest text-slate-400">Brought to you by</span>
            <span className="text-2xl font-semibold text-white">
              <Variable name="sponsor.name" fallback="" />
            </span>
          </div>
        </div>
      </Toggle>
    </Scene>
  )
}
