# ADR 03-004: Model Profiles — Creator-Attributed Post Cards and Profile Routes

## Status

Proposed

## Related

ADR 00-001 (Application Framework — Next.js)
ADR 00-002 (Rendering and Hosting Model)
ADR 00-005 (Internationalization)
ADR 00-006 (Media and Asset Pipeline)
ADR 00-007 (Quality Tooling and CI)
ADR 00-008 (Analytics and Consent)
ADR 00-011 (Page Model and Product Routes)
ADR 00-012 (Platform Posture)
ADR 03-001 (Design System and Visual Identity)
ADR 03-002 (Landing Page Composition)
ADR 03-003 (Promotion Bar)

## Context

The Feed Shell of ADR 03-002 mirrors the three-column social-feed
composition but, as first composed, attributed every Post Card to the
brand itself — the header carrying the own-brand avatar, name, and
decorative handle — and excluded social-platform concepts entirely:
profiles, messages, and notifications were not carried over. The
owner has approved carrying one bounded piece of that excluded
pattern: creator-style profiles for the models presenting the
products. Each model gets a profile page, her posts join the landing
feed attributed to her, and tapping her attribution navigates to her
page — the social-authenticity signal of a creator platform, bounded
to attribution only.

The architecture constrains the shape the feature can take. Profiles
are operator content, not visitor-generated — the same "feed is
editorial store content" posture as ADR 03-002: no accounts, no
authentication, no visitor-attributed publishing surface exists or is
added. Profile existence is filesystem-truth: a model exists iff her
image folder `public/images/profiles/<slug>/` exists in the
repository — the slug is the folder name — so adding or removing a
model is committing or removing her folder and redeploying,
deliberately outside the Admin Console. Her posts are
filesystem-truth the same way: every image inside her folder with a
slug-safe basename outside the `profile*` avatar convention is one of
her posts —
`id` `pp-<slug>-<basename>`, media the file path, order alphabetical
by filename — so posting and retiring are file commits and redeploys
too, and the runtime operator surface edits only overlays, never the
post set. Identifier hygiene (ADR
00-007) applies to the content itself: model slugs, folder names, and
handles are operator-entered identifiers never seeded into tracked
files — tracked defaults, fixtures, and tests carry placeholder slugs
only. There is no stored name field: the display name is derived from
the slug — `helena-duarte` renders as `Helena Duarte` — so a name is
not translated because no name is stored. ADR 00-005 requires every
visitor-facing string in both Locales, but post captions and alt text
are operator data, not chrome strings — post copy carries per-Locale
text rather than message-catalog keys: a committed `<basename>.txt`
sidecar beside each post image holds `[PT]` and `[EN]` sections, and
the operator records carry per-Locale `{pt, en}` overlay fields that
override them — the same deliberate deviation ADR 03-003 recorded for
Promotion Campaign copy. ADR 00-002 confines
request-time compute to an enumerated
dynamic surface: no new Route Handler is added — profile enumeration
is a `readdir` of the profiles folder and post enumeration a
`readdir` of each profile's own folder, performed at request time by
the landing feed and the Profile Routes inside the already-enumerated
render-per-request Locale tree, the managed store's dedicated profiles
keyspace holds one `profile:<slug>` operator document per existing
folder (no slug-list key) carrying only sparse overlays over the
filesystem-derived post set, and the existing like counter Route
Handler's accepted post-id domain is extended to cover profile posts
rather than gaining an endpoint. An unconfigured or failing store
means no profiles exist at runtime — the fail-closed posture of ADR
00-002 made explicit, with no silent fallback content: the landing
feed renders the authored interstitials only and Profile Routes
resolve not-found. ADR
00-006 fixes
the media posture: no upload pipeline exists and none is added —
profile folders, avatars, and post media are in-repo `public/` assets
created by committing the model's folder: the avatar is picked in the
Admin Console from the folder's images, while post media needs no
picker at all — every image with a slug-safe basename outside the
`profile*` avatar convention is already a post.

## Decision

The Storefront gains **Model Profiles** — creator personas whose
existence is the profiles image folder, whose posts are that folder's
images, and whose operator state lives in the managed store — and a
**Profile Route** per enabled
profile, composed inside the Feed Shell. Post Cards gain an **author
override** so a model's post presents her attribution instead of the
brand's. One decision: the attribution model of feed content and the
rules the profile system obeys.

- **Profile existence is the filesystem; profile state lives in the
  managed store.** A profile exists iff the image folder
  `public/images/profiles/<slug>/` exists in the repository: the slug
  is the folder name — lowercase `a-z0-9-` (`PROFILE_SLUG_REGEX`),
  with a reserved-slug list rejected so a profile can never shadow an
  existing route segment. Adding or removing a model is creating or
  removing her folder and redeploying — deliberately outside the
  Admin Console. There is no stored name field anywhere: the display
  name is derived from the slug by a deslugify helper
  (`helena-duarte` → `Helena Duarte`), a single non-localized string
  by construction — a name is not translated, and none is stored to
  translate. A dedicated profiles keyspace of the shared managed
  Redis store (ADR 00-002) holds the operator records:
  `profile:<slug>` is a JSON document `{enabled, avatar, posts}` per
  existing folder — there is no slug-list key; enumeration is a
  `readdir` of the profiles folder. `enabled` toggles the profile
  and its posts without
  deleting them; `avatar` is an operator-selected image path into the
  profile's own folder, falling back — when unset — to the first
  sorted image whose basename starts with `profile`
  (case-insensitive), and to the folder's first sorted image when no
  `profile*` image exists; unset survives only when the folder holds
  no images.
  The post set is filesystem-derived like the roster: every image in
  `public/images/profiles/<slug>/` whose basename —
  `PROFILE_SLUG_REGEX`-safe like the folder's own name, the filename
  being the post's identity — does not start with `profile` is a
  post: a `profile*` file is never a post, a stem the slug regex
  rejects (`My Photo.jpg`) never enumerates, and image files sharing
  one stem in different extensions collapse to a single post, the
  first sorted file winning — with
  `id` `pp-<slug>-<basename>` (the `pp-` id domain, unique across
  every profile's posts and binding the post's like keys to the file
  itself), media the image's own `public/` path so every post
  carries media by construction, and order alphabetical by
  filename. Captions live in a committed `<basename>.txt` sidecar
  beside the image, holding multi-line `[PT]` and `[EN]` sections;
  a missing sidecar yields empty captions. `posts` in the document
  is therefore not a list but a sparse overlay map
  `Record<postId, overlay>` — only operator overrides persist —
  each overlay `{visible?, likes?, caption?, alt?}` with `caption`
  and `alt` per-Locale `{pt, en}` records. The effective post
  merges file, sidecar, and defaults with its overlay: `visible`
  defaults to true — a post renders in the feed and on the Profile
  Route and accepts likes only while its profile is enabled and
  the post itself is visible; `likes` is the authored base like
  count the shared delta adds to, default 0 — the same
  base-plus-delta composition as authored posts; `caption`
  defaults to the sidecar's per-Locale text and `alt` — which has
  no sidecar source — to empty. The documents are normalized on read and on
  write through the same `normalizeProfiles` rules Site Config
  groups follow, and the read distinguishes absent intent from
  corrupt intent. A folder with no stored document has recorded no
  intent — existence alone is publish intent — so it resolves to
  the defaults: enabled, auto-avatar (the first sorted `profile*`
  image, else the folder's first sorted image), and an empty overlay
  map — every post file a visible
  post — and the profile publishes. A present-but-corrupt
  document — unparseable JSON, a non-object value, or an entry
  normalization drops — records an intent the system cannot read,
  so it drops its profile outright: the folder is absent from the
  feed enumeration, `readProfile` resolves `null`, and the Profile
  Route resolves the not-found surface. The asymmetry is the
  fail-closed posture of ADR 00-002 applied per record — the
  defaults substitute only for a document the operator never wrote,
  never for corrupted operator data: resolving a broken record to
  the defaults would silently publish a live profile over intent
  that cannot be read, exactly the substitution the posture
  forbids. The drop is individual — one corrupt record removes only
  its own profile, never the enumeration — and within a document
  that survives, malformed overlays still drop out rather than
  breaking the read: a malformed overlay entry drops individually,
  and an overlay key whose `pp-` id names no image in
  the folder is inert residue — the file it edited is gone, so the
  override applies to nothing — never the profile.
- **Profile Route.** Each enabled profile is served at
  `/{locale}/u/<slug>`, composed inside the Feed Shell — the Nav
  Rail, Suggestions Rail, and responsive collapse behave exactly as
  on the other shell routes, and Nav Rail entries that target landing
  feed units return the visitor to that unit on the landing within
  the same Locale (the same wayfinding posture ADR 03-002 recorded
  for the Product Page routes). The Feed Surface's occupant on a
  Profile Route is a **profile header** — the model's avatar (the
  stored override, else the folder's first sorted `profile*` image,
  else its first sorted image), her
  slug-derived display name, a decorative `@slug` handle string
  (never a
  third-party account reference), and her post count — followed by
  the Post Card scroll of her visible posts: the folder's post
  images in filename order, less the posts the overlay gates off. A
  slug with no folder,
  a folder whose stored document is corrupt, a folder whose
  profile is disabled, and every slug while
  the managed store is unconfigured or unreachable resolve to the
  not-found surface: no profiles
  exist and no fallback profile content is substituted —
  fail-closed, the same posture as a removed
  product slug.
- **Post Card author override.** The Post Card header gains an author
  source: a post authored under a profile presents that profile's
  resolved avatar and slug-derived display name as a link to her
  Profile Route within the same
  Locale — the one place the decorative own-brand attribution becomes
  a navigable one. Brand-authored posts keep the existing own-brand
  header unchanged. A profile post's caption and media alt resolve
  from the effective post's merged sidecar-and-overlay per-Locale
  fields in the request Locale; the rest
  of the card — Media Slot linking to the featured product's Product
  Page, Interaction Row with the shared like count and the
  client-resolved share — is the same unit ADR 03-002 defines.
- **Landing placement.** Enabled profiles' visible posts are the
  landing Feed Surface's body: the visible posts of every enabled
  profile are collected together and shuffled per request —
  Fisher–Yates, via the `shuffled` helper in `lib/profiles.ts` — so
  posts interleave across profiles rather than rendering profile by
  profile. The per-request randomness is safe because the surface is
  server-rendered: no client hydration exists to mismatch. The
  authored `FEED_POSTS` registry no longer renders as a leading
  block: it is reduced to two interstitial units — the
  limited-edition closing unit and the FAQ island — which the scroll
  inserts into the shuffled sequence, one interstitial per every
  three profile posts, cycling through the section-enabled set in
  authored order — the limited-edition closing unit, the FAQ island,
  and around again; a unit whose section toggle is off leaves the cycle.
  The Profile Route is unaffected: `/u/<slug>` keeps each model's
  posts in their filename order — the shuffle and the interstitial
  insertion are landing-feed treatments only.
- **Like counter extension.** The like counter Route Handler
  enumerated in ADR 00-002 accepts the `pp-` post-id domain in
  addition to the authored-post ids: it validates
  the id format, resolves the authored base count for a
  `pp-<slug>-<basename>` id from that profile's overlay map — `0`
  absent an override — the same store that holds the like state, so a
  like key binds to the image file itself — and applies the same
  dedup, input
  caps, rate limiting, and fail-closed degradation as authored posts.
  Only enabled profiles' visible posts are served and toggled — a
  disabled profile's or an invisible post's id holds no public count,
  matching the route's
  not-found posture. The Admin Console's Social view lists profile
  posts' aggregates — per-post totals and last-like times — beside
  the authored interstitials', read from the same managed store.
- **Admin Console Profiles tab.** The Admin Console gains a
  "Profiles" tab that browses the folder-backed profiles: a selector
  over the existing `public/images/profiles/` folders — with no
  add/remove controls, since casting is a folder commit and a
  redeploy — and per profile an enabled flag, the slug and its
  derived display name (read-only), an
  avatar picker over the profile's own folder, and below it a posts
  table that enumerates the folder's post images automatically — one
  row per post in filename order, with no add/remove post control
  and no media picker: posting is committing an image into
  `public/images/profiles/<slug>/` and retiring is deleting it. The
  editable surface per row is the overlay: the per-Locale caption
  (prefilled from the sidecar), the optional per-Locale alt, the
  authored base like count, and the `visible` checkbox — the
  operator's per-post gate, whose unchecked state excludes the post
  from the landing feed, the Profile Route, and the like counts
  while the file stays. Saving persists only the sparse diffs: a
  field left at its sidecar-or-default value writes no overlay key.
  The tab saves one profile at a time through a dedicated
  `saveProfile` Server
  Action — not the Site Config write path — which validates that the
  slug is an existing profiles folder and persists only that
  `profile:<slug>` document, re-normalized
  through the same `normalizeProfiles` rules and strictly validated
  server-side: fail-loud for the operator, and fail-closed on an
  unconfigured store, where the action reports the store as not
  configured rather than silently dropping the write. The tab
  surfaces the store's health with the same
  unconfigured/connected/error presentation the Social and Customers
  sections already use.
- **Orphaned store residue.** Deleting a post image removes the post
  and orphans both its recorded like sets and any overlay entry under
  its `pp-` id in the managed store — a rename is a delete plus a
  create under the same rule — and removing a model's folder
  orphans her whole `profile:<slug>` document and its like sets —
  accepted: the
  keys are cosmetic aggregate state joined to nothing, they no longer
  surface in the Admin Console's Social or Profiles views, and they expire with
  the keyspace's own lifecycle rather than growing a cleanup
  mechanism. The orphaned `profile:*`, `likes:pp-*`, and `likes:last:pp-*` keys
  therefore accumulate without bound over the store's life —
  accepted as bounded cosmetic residue under the single-operator
  console, whose removal volume stays small; no cleanup sweep is
  scheduled.
- **Localization.** Visitor-facing chrome strings of the profile
  surface — the post-count label, aria names — ship in both Locales
  through the versioned message catalogs (ADR 00-005); post captions
  and alt text are operator data carried per-Locale outside the
  catalogs — base captions in the committed sidecars' `[PT]`/`[EN]`
  sections, override copy in the overlay's `{pt, en}` fields — the
  Promotion Campaign posture of ADR 03-003 —
  while the display name is derived from the slug, so there is no
  name field to translate at all.
  Profile Routes and all in-shell navigation preserve the Locale
  prefix. A per-Locale field left empty for one Locale falls back to
  the sibling Locale's copy at render — operator copy always
  surfaces, never a blank field.
- **Boundaries.** ADR 00-002's enumerated dynamic surface gains no
  new Route Handler — profile enumeration is a request-time
  `readdir` of the profiles folder and post enumeration a `readdir`
  of each profile's own folder inside the already-enumerated
  render-per-request Locale tree, the managed store holds only the
  `profile:<slug>` operator documents read at request time by the
  landing feed
  and the Profile Routes and written per profile by the `saveProfile`
  action,
  and the like counter's `pp-` domain resolves base counts from the
  same store. No upload
  pipeline is added — the avatar is picked from in-repo `public/`
  assets and post media is not picked at all: the folder's post files
  are the posts, per ADR 00-006. No analytics mechanism is added —
  the Interaction Row's aggregate-only posture carries over unchanged
  (ADR 00-008).

## Consequences

**Positive:**
- The feed gains the social-network authenticity the stacked retail
  page and the single-brand feed both lack: products are presented by
  attributed creators the visitor can follow to a profile, which reads
  as a living creator presence rather than a storefront wearing a feed
  costume.
- The folder is the single source of truth for the roster and the
  post set alike: the same directory names the model (her slug, and
  thereby her derived display name and handle), holds her avatar and
  post media, determines her existence, and is her post list —
  every post file a post, ordered by filename — so neither a stored slug
  list nor a stored post list can drift from the media on disk,
  because there are none.
- Operator edits propagate at once: enabling or disabling a model,
  overriding her avatar, and editing her posts' overlays — caption,
  alt, like base, and the `visible` gate — are managed-store writes
  through the Profiles tab that apply within seconds, so day-to-day
  profile operation stays redeploy-free; only posting and retiring
  remain deploy operations.
- The feature adds zero Route Handlers and zero new endpoints —
  profile enumeration rides the already-enumerated render-per-request
  Locale tree, the `profile:<slug>` documents occupy a new keyspace
  of the enumerated managed
  store, and the like counter's post-id domain extension stays inside
  the enumerated endpoint.
- The overlay's per-post `visible` flag keeps fine-grained runtime
  control: a single post can be hidden without deleting its file —
  unchecked excludes it from the feed, the Profile Route, and the
  like counts — while its overlay, its ordering, and its like state
  survive for re-enable.
- No upload infrastructure and no post bookkeeping: the avatar
  `public/` picker keeps media inside ADR 00-006's in-repo-masters
  posture, post media needs no picker at all — dropping a post file into
  the folder is posting, deleting it is retiring — so nothing new
  must be secured, scanned, or paid for, and the Admin Console has
  no add/remove surface to drift from the files.
- Captions ship with the images: a `<basename>.txt` sidecar is
  committed beside its post image, so a new post's copy rides the
  same commit as its media — and deploy-time sidecar edits merge
  with runtime overlay edits rather than replacing them, because the
  overlay wins only where it was written.
- The per-Locale operator-copy pattern reuses the Promotion Campaign
  precedent (ADR 03-003) — one established deviation, consistently
  applied across the committed sidecars and the overlay fields,
  instead of a second i18n mechanism.
- Profiles are bounded to attribution and routes: messages,
  notifications, and visitor accounts stay outside, so the
  no-personal-data posture of ADR 00-008 is undisturbed.

**Negative / trade-offs:**
- Profiles are now a hard dependency on the managed store: when it is
  unconfigured or unreachable, no profiles exist at runtime — even
  though their folders exist — the feed loses all
  model content and every Profile Route resolves not-found, with no
  silent fallback content. The move trades Edge Config's resilience
  and safe-defaults read for the store's fail-closed posture.
- Casting and posting are deploys: adding or removing a model means
  committing or removing her `public/images/profiles/<slug>/` folder
  and redeploying, and adding or removing a post means committing or
  deleting an image inside it — the image-folder redeploy boundary of
  ADR 00-006 now applies to the post set itself, not only to media.
  The split is honest but asymmetric: whether a profile exists and
  what it posts are build/deploy-time facts, while the operator's
  runtime control is the overlay — hide, edit, or reweight — never
  creation.
- The Locale routes gain a request-time filesystem dependency:
  `readdir` of `public/images/profiles/` for the roster and of each
  profile's own folder for its posts must resolve inside the
  render-per-request functions — with the sidecar `.txt` files read
  alongside the images — so the build's output file tracing
  must carry the profiles folder into the Locale routes' traced
  output — the `outputFileTracingIncludes` mechanism already used to
  trace `public/` into the Admin surface is extended to those routes.
  A missed trace degrades quietly: the enumeration reads empty and
  the storefront behaves as though no profiles exist.
- The Site Config local-file fallback no longer covers profiles:
  local development and the development tier see no model content at
  all unless the development managed store is configured, where the
  file-backed path used to carry them.
- The Profile Route is one more Feed Surface occupant to keep
  consistent: header treatment, measure, rhythm, collapse, and
  not-found behavior must track the shell as it evolves — the same
  maintenance tax the Simplified Purchase Surface occupant already
  pays.
- Two post-id domains now exist: the authored interstitials' static
  `FEED_POSTS` ids live in code while `pp-` ids are derived from
  filenames — `pp-<slug>-<basename>` binds the like key to the
  image file, so a rename is a delete plus a create that orphans its
  like sets under the old id —
  the like counter accepts both, and a `pp-` id's base count resolves
  from the store's overlay map rather than from code-managed
  content; divergence
  is bounded but must be held.
- Deleting or renaming a post image removes the post and orphans its
  like sets and its overlay entry — renaming to or from the `profile*`
  convention counts as the same delete plus a create — and removed
  folders orphan their `profile:<slug>` documents — in the managed
  store: accepted as cosmetic, but the orphans are permanent residue
  unless the operator or a future keyspace cleanup removes them.
- The per-Locale operator workload doubles the post copy:
  base captions are authored twice in the sidecars' `[PT]`/`[EN]`
  sections and override copy twice in the Admin Console, with no
  catalog-parity checker behind either — correctness
  rests on the operator, with the sibling-Locale render fallback
  covering one-sided copy rather than catalog parity enforcement.
- Captions have two write paths: the committed sidecar at deploy
  time and the console overlay at request time, merged overlay-wins —
  a redeploy can never clobber an operator's edit by design, but the
  sidecar and the effective caption can diverge silently once an
  override exists; accepted: the overlay is the authority wherever
  it was written.
- Attribution invites expectation: a visitor who taps through to a
  profile may expect platform behaviors (following, messaging) that
  deliberately do not exist — the profile is a content route, and its
  presentation must not promise mechanics it does not carry.

## Alternatives Considered

- **Profiles in Site Config (a `profiles` config group)** — Rejected
  by owner decision: the profile records belong in the
  managed store and profile existence belongs to the image folder,
  not in operator configuration. Config residency
  would grow the single Edge Config value with per-Locale post copy
  under a size ceiling already shared with campaigns and toggles, and
  would split each post's state — the record in config, the like
  state in the store — across two systems the `pp-` domain then
  bridges at every read.
- **A Redis-held slug list for enumeration (the former `profiles`
  list key)** — Replaced by filesystem enumeration: the folder
  already names the model — her slug, her derived display name, her
  avatar source, her media — so a second stored roster duplicated
  that truth and could drift from it (a list entry without a folder,
  a folder without a list entry). The `readdir` enumeration
  supplies the roster, and the managed store keeps only the
  per-folder `profile:<slug>` operator documents.
- **A posts list inside the `profile:<slug>` document (the former
  post model)** — Superseded: posts began as a stored list of
  `{id, media, caption, alt?, likes, visible}` records whose media
  paths pointed into the same folder — a second truth that could
  drift from the files: a listed post whose image was deleted, an
  image committed but never listed. Deriving the post set from the
  folder makes every image a post with `id`, media, and like key
  bound to the file, shrinks the document to sparse overlays, and
  removes a whole editing surface — at the accepted cost that
  posting and retiring are deploy operations rather than console
  writes.
- **Visitor or registered creator accounts** — Rejected: accounts
  mean authentication, personal data, and attributed-visitor state —
  request-time surfaces and a data class beyond ADR 00-002's
  enumerated boundary and ADR 00-008's no-personal-data posture.
  Profiles are operator-authored personas; the social signal comes
  from attribution, not membership.
- **An image upload pipeline (blob store, operator uploads)** —
  Rejected: owner decision — the Admin Console offers an avatar
  picker over the in-repo `public/` assets only for now. Upload
  infrastructure
  adds storage cost, content validation, and a request-time surface
  for a catalog of editorial images that in-repo masters already
  serve (ADR 00-006); the picker model can be revisited if the volume
  outgrows it.
- **Profile names and captions in the message catalogs** — Rejected:
  post copy is operator data — the sidecar base travels with its
  image and the overlay fields stay runtime-editable; catalog
  residency would freeze both into code-managed content. The
  sidecars' `[PT]`/`[EN]` sections and the overlay's per-Locale
  `{pt, en}` fields are the Promotion
  Campaign posture of ADR 03-003 — catalog parity is traded for
  operator editability, with schema validation taking the checker's
  role for that copy.
- **Top-level profile routes (`/{locale}/<slug>`)** — Rejected: a
  bare final segment collides with every existing and future
  Locale-prefixed route word — a model slug equal to an auxiliary or
  product route would shadow or be shadowed, and the reserved-slug
  list would grow to track the whole route table. The `/u/` segment
  keeps the profile namespace clean and self-describing; reserved-
  slug rejection stays a short, static list.
- **Profiles outside the Feed Shell (a separate page frame)** —
  Rejected: a different chrome at the profile step would reproduce
  the presentation discontinuity ADR 03-002 removed at the purchase
  step; the profile is feed content and belongs inside the same
  composition.
- **Posts stored separately from profiles (a flat feed table)** —
  Rejected: the posts' filesystem derivation binds attribution to the
  directory structure itself — a post cannot exist outside its
  profile's folder — and the sparse overlays nested in the
  `profile:<slug>` document keep enabling, caption, and like-base
  edits on one record, at the accepted cost of the orphaned like
  sets recorded above.
