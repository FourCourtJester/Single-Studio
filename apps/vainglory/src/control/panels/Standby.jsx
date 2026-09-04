import { useAssetLibrary } from '@single-studio/core'
import { AssetLibrary, Break, CountdownTo, Field, Panel, Toggle } from '@single-studio/core/control'

import { SLIDE_PREFIX } from '../../show'

export default function Standby() {
  const { assets } = useAssetLibrary()
  const slides = assets.filter((entry) => entry.here && entry.key.startsWith(SLIDE_PREFIX))

  return (
    <>
      <Panel title="Standby">
        <Field name="standby.message" label="Message" placeholder="Coming up next" className="basis-full" />
        <Toggle name="standby.card" label="message" />
        <Break />
        <CountdownTo name="golive" label="Live at" />
        <Toggle name="standby.clock" label="countdown" />
      </Panel>

      <Panel title="Slides">
        {/*
          A count rather than a picker. The slideshow plays whatever is filed under
          the prefix, so the only question worth answering on the board is whether
          the pictures actually arrived on this machine -- which is what `here`
          means, and why an empty count is worth reading before air.
        */}
        <p className="basis-full text-sm text-slate-400">
          {slides.length ? (
            <>
              Playing <span className="font-semibold text-slate-200">{slides.length}</span> {slides.length === 1 ? 'picture' : 'pictures'} filed under{' '}
              <code className="text-slate-300">{SLIDE_PREFIX}</code>.
            </>
          ) : (
            <>
              Nothing under <code className="text-slate-300">{SLIDE_PREFIX}</code> yet. Drop a folder named{' '}
              <code className="text-slate-300">{SLIDE_PREFIX.replace('/', '')}</code> below, or type it into the box above the drop zone before adding files.
            </>
          )}
        </p>
        <AssetLibrary />
      </Panel>
    </>
  )
}
