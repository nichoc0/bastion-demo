import { useEffect, useState } from 'react';

// Reusable playback clock. `t` runs 0..max; the agent tree and the assessment
// graph both reveal items whose `at <= t`, so they scrub on the same timeline.
// Past runs start fully revealed (t=max) with the scrubber available to replay.
export function usePlayback(max, { startAtEnd = true, stepMs = 850 } = {}) {
  const [t, setT] = useState(startAtEnd ? max : 0);
  const [playing, setPlaying] = useState(false);

  // clamp if max changes
  useEffect(() => { setT((x) => Math.min(x, max)); }, [max]);

  useEffect(() => {
    if (!playing) return undefined;
    if (t >= max) { setPlaying(false); return undefined; }
    const id = setTimeout(() => setT((x) => Math.min(max, x + 1)), stepMs);
    return () => clearTimeout(id);
  }, [playing, t, max, stepMs]);

  const toggle = () => {
    if (t >= max) setT(0);        // replay from the start
    setPlaying((p) => !p);
  };
  const restart = () => { setT(0); setPlaying(true); };

  return { t, setT, max, playing, toggle, restart };
}
