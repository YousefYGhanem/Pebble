import { Composition } from 'remotion'
import { Launch, type LaunchProps } from './launch/Launch'
import { DURATION } from './launch/cues'

// One composition per language. fps is a prop: 30 for drafts and stills, 60 for the final (calculateMetadata).
export function Root() {
  return (
    <>
      {(['en', 'ar'] as const).map(lang => (
        <Composition
          key={lang}
          id={`Launch-${lang}`}
          component={Launch}
          width={1080}
          height={1350}
          fps={30}
          durationInFrames={Math.round(DURATION * 30)}
          defaultProps={{ lang, fps: 30 } satisfies LaunchProps}
          calculateMetadata={({ props }) => ({ fps: props.fps, durationInFrames: Math.round(DURATION * props.fps) })}
        />
      ))}
    </>
  )
}
