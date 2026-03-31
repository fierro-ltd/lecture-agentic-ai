-- HAST Review Service Schema (runs in lecture_agent database)
CREATE TABLE IF NOT EXISTS hast_submissions (
    id              TEXT PRIMARY KEY,
    submission_type TEXT NOT NULL,
    entity_id       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    content         TEXT NOT NULL,
    criteria        TEXT DEFAULT '',
    ai_evaluation   JSONB,
    review_decision TEXT,
    reviewer_notes  TEXT,
    adjusted_score  REAL,
    paperclip_run_id TEXT,
    context         JSONB DEFAULT '{}',
    workflow_id     TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON hast_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON hast_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_submissions_entity ON hast_submissions(entity_id);
