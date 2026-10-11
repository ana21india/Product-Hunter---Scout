-- 1. Saved settings: Kavya's product description, the topic mapping
CREATE TABLE IF NOT EXISTS settings (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- 2. Raw launch signals (no scores, no ranks)
CREATE TABLE IF NOT EXISTS launches (
  post_id        text PRIMARY KEY,
  slug           text NOT NULL,
  name           text NOT NULL,
  tagline        text,
  description    text,
  url            text,
  website        text,
  votes_count    integer NOT NULL,
  comments_count integer NOT NULL,
  created_at     timestamptz NOT NULL,
  makers         jsonb NOT NULL,
  topics         text[] NOT NULL,
  category       text NOT NULL,
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_refreshed timestamptz NOT NULL DEFAULT now(),
  is_snapshot    boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS launches_created_idx ON launches (created_at DESC);

-- 3. Maker-comment counts (cached, refetched only if comments_count changed)
CREATE TABLE IF NOT EXISTS maker_comments (
  post_id              text PRIMARY KEY REFERENCES launches(post_id) ON DELETE CASCADE,
  maker_comment_count  integer NOT NULL DEFAULT 0,
  unattributed_count   integer NOT NULL DEFAULT 0,
  comments_total_seen  integer NOT NULL DEFAULT 0,
  fetched_at           timestamptz NOT NULL DEFAULT now()
);

-- 4. Gemini relevance verdicts
CREATE TABLE IF NOT EXISTS relevance (
  post_id    text PRIMARY KEY REFERENCES launches(post_id) ON DELETE CASCADE,
  relevant   boolean NOT NULL,
  reason     text,
  model      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Gemini one-liner and angle cache
CREATE TABLE IF NOT EXISTS angles (
  post_id    text PRIMARY KEY REFERENCES launches(post_id) ON DELETE CASCADE,
  one_liner  text,
  angle      text,
  status     text NOT NULL,
  model      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Run log (one row per Run scout click, also the run lock)
CREATE TABLE IF NOT EXISTS run_log (
  id           bigserial PRIMARY KEY,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  status       text NOT NULL,
  error        text,
  new_launches integer,
  refreshed    integer,
  note         text
);


-- 7. LinkedIn profiles found by Gemini search (only kept if they pass strict checks)
CREATE TABLE IF NOT EXISTS founder_links (
  post_id    text NOT NULL REFERENCES launches(post_id) ON DELETE CASCADE,
  maker_id   text NOT NULL,
  maker_name text NOT NULL,
  url        text,
  evidence   text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, maker_id)
);
