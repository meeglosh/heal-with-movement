# Hero video

Real footage is now in place (AI-generated with Veo, supplied by the client
in `/Users/mikejerugim/heal-with-movement/videos/`, originals left untouched
there). This folder holds the web-encoded derivatives actually used by the
site:

| File | Purpose |
|---|---|
| `hero.mp4` | Desktop/tablet loop, H.264, 1920x1080, ~2.7MB |
| `hero.webm` | Desktop/tablet loop, VP9, 1920x1080, ~1.8MB |
| `hero-mobile.mp4` | Phone loop (portrait crop), H.264, 720x1280, ~0.7MB |
| `hero-mobile.webm` | Phone loop (portrait crop), VP9, 720x1280, ~0.7MB |
| `hero-poster.jpg` | First frame of `hero.mp4`, used as the desktop `poster` |
| `hero-poster-mobile.jpg` | First frame of `hero-mobile.mp4`, used as the mobile `poster` |

## What's in the two source clips

- **Desktop source** (`... 1_10PM.mp4`, 1920x1080, 8s): a slow macro shot of
  an adult's hands gently cradling and adjusting a small child's foot, on a
  bed with warm terracotta linen and soft window light. This matches the
  original shot spec closely and is the primary hero visual.
- **Mobile source** (`... 1_14PM.mp4`, 1080x1920, 8s): a different scene, an
  adult's two hands (in a rust/pink knit sweater) clasped together on warm
  bedding, in a different room/light setup. It is warm and on-brand in tone,
  but it does **not** show a child, and it is not the same scene as the
  desktop clip. Reviewed frame-by-frame (every ~1s plus start/mid/end): no
  obvious extra or fused fingers or warped anatomy, though the finger
  interlacing in the middle of the clip has a slightly soft/rubbery AI-video
  quality up close. At the size and blur level it plays on a phone hero,
  this reads fine, but it's worth knowing about.
- **Recommendation for Heidi**: the desktop clip is ready to ship as-is. For
  full brand consistency, consider commissioning (or generating) a true
  mobile/portrait version of the *same* hands-and-child's-foot scene to
  replace `hero-mobile.*` before this goes fully live. Until then, the
  current mobile clip is used because it's warm, calm, and gentle in the
  same visual language, just not a literal match to the desktop shot.

## How it's built

Both source clips run 8s at normal speed. Client feedback was that the
motion read as too fast for ABM's very slow, unhurried pace, so both were
slowed to 0.5x (16s) with frame-interpolated retiming before any other
processing.

**Two interpolation approaches were compared** on the desktop clip before
picking one (frames extracted every ~0.5s and a cropped, zoomed comparison
around the hands at several points):

- `setpts=2*PTS,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`
  (motion-compensated interpolation)
- `setpts=2*PTS,minterpolate=fps=24:mi_mode=blend` (frame blending)

At this footage's genuinely slow, small motion, both looked essentially
identical and clean, no warping, no doubled fingers, no ghosting from
either method. **Blend was used for both final clips** as the safer,
more conservative choice: it can only ever soften a frame via
cross-dissolve, it has no motion-vector field to get wrong on the
hardest case in this footage (fingers overlapping/interlacing), where
motion-compensated interpolation occasionally can warp.

Since the first and last frames of the 16s slowed clip aren't identical, a
1.2s **crossfade loop** (tail dissolved into head via `xfade`) was used
instead of a ping-pong (which would have doubled length to 32s, too long
and too heavy for a background hero loop at this point). The crossfade
brings each clip to ~14.7s. Checked the loop seam directly (frame just
before the cut vs. just after): the crossfade is imperceptible, hand and
foot position are close enough between the two that the dissolve reads as
continuous motion, not a jump.

```bash
# 1. Slow to 0.5x with frame blending
ffmpeg -i source.mp4 -filter:v "setpts=2*PTS,minterpolate=fps=24:mi_mode=blend" \
  -an slowed.mp4

# 2. Crossfade the tail into the head for a seamless loop (dur/offset computed
#    from the slowed clip's actual duration, 1.2s overlap)
ffmpeg -i slowed.mp4 -filter_complex \
  "[0:v]split[a][b];[a]trim=0:OFFSET,setpts=PTS-STARTPTS[main]; \
   [b]trim=OFFSET:DUR,setpts=PTS-STARTPTS[tail]; \
   [main][tail]xfade=transition=fade:duration=1.2:offset=OFFSET[out]" \
  -map "[out]" -an loop.mp4

# 3. Final web encode (note the explicit yuv420p — minterpolate/xfade can
#    otherwise hand libx264 a pixel format its High profile rejects)
ffmpeg -i loop.mp4 -an -vf "scale=1920:1080,format=yuv420p" -c:v libx264 \
  -profile:v high -crf 26 -preset slow -movflags +faststart hero.mp4
ffmpeg -i loop.mp4 -an -vf "scale=1920:1080,format=yuv420p" -c:v libvpx-vp9 \
  -b:v 0 -crf 34 -row-mt 1 hero.webm
```

Posters were extracted as the literal first frame of each final encoded
file (not the source), so the poster-to-video transition on load is
pixel-matched and invisible.

## How it's wired in (see `heroSection()` in `../../build.mjs`)

- `<source media="(max-width: 640px)">` entries serve the mobile files to
  narrow viewports declaratively; wider viewports fall through to the
  desktop sources.
- A small inline (non-deferred) script sets the correct `poster` for the
  viewport before first paint, and only adds `autoplay` + calls `.play()`
  when the visitor has **not** requested `prefers-reduced-motion: reduce`
  and does **not** have `navigator.connection.saveData` on. In both of
  those cases the video stays paused and only the poster frame shows.
- `js/main.js` also has a redundant safety check that pauses the video and
  strips `autoplay` under reduced motion, in case anything else on the page
  ever sets it directly.

## Original shot spec (for reference / if new footage is ever commissioned)

Macro, soft natural window light, warm and slightly desaturated grade,
extremely slow and small movement, near-static camera, 10-20s loopable,
minimum 1920x1080 for desktop with a true portrait crop/edit for mobile,
no audio needed. The desktop clip in place today matches this spec well.
