#!/usr/bin/env python3
"""
seed-agent-instructions.py

Reads SOUL.md files from /agents/<agent-name>/SOUL.md and seeds the
Paperclip PostgreSQL database with their contents.

Strategy:
  1. Wait for Paperclip to finish initialising (retries with back-off).
  2. Discover the schema by querying information_schema.columns for tables
     named 'member' or 'agent' with instruction-like columns.
  3. Match agents by normalising display names to slugs.
  4. UPDATE the instructions column — safe to re-run (idempotent).
"""

import os
import re
import sys
import time
import pathlib

import psycopg2
import psycopg2.extras

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get(
    "PAPERCLIP_DATABASE_URL",
    "postgresql://lecture:lecture_dev@postgres:5432/paperclip",
)
AGENTS_DIR = pathlib.Path(os.environ.get("AGENTS_DIR", "/agents"))

# Retry settings — Paperclip runs migrations on first boot, which takes time.
MAX_RETRIES = 30
RETRY_DELAY_S = 5

# Candidate table / column names (ordered by preference)
CANDIDATE_TABLES = ["member", "agent", "members", "agents"]
INSTRUCTION_COLUMNS = ["instructions", "system_prompt", "soul", "prompt"]
NAME_COLUMNS = ["name", "slug", "username", "display_name", "title"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def normalise(name: str) -> str:
    """
    Normalise an agent name to a comparable slug.

    'Assessment Quality Agent' → 'assessment-quality'
    'assessment-quality'       → 'assessment-quality'
    """
    name = name.lower().strip()
    # Drop common suffixes that don't appear in directory names
    for suffix in (" agent", " worker", " service"):
        if name.endswith(suffix):
            name = name[: -len(suffix)].rstrip()
    # Replace non-alphanumeric runs with hyphens
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return name.strip("-")


def wait_for_db(url: str) -> psycopg2.extensions.connection:
    """Keep retrying until the DB is reachable."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            conn = psycopg2.connect(url)
            conn.autocommit = False
            print(f"[seed] Connected to database (attempt {attempt})")
            return conn
        except psycopg2.OperationalError as exc:
            print(
                f"[seed] DB not ready yet (attempt {attempt}/{MAX_RETRIES}): {exc}"
            )
            if attempt == MAX_RETRIES:
                raise
            time.sleep(RETRY_DELAY_S)
    # unreachable
    raise RuntimeError("Could not connect to database")


def discover_schema(conn) -> tuple[str, str, str] | None:
    """
    Return (table, name_col, instructions_col) or None if not found.

    Queries information_schema so it works regardless of Paperclip version.
    """
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Collect all columns for candidate tables in one query
    cur.execute(
        """
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY(%s)
        ORDER BY table_name, ordinal_position
        """,
        (CANDIDATE_TABLES,),
    )
    rows = cur.fetchall()

    # Group columns by table
    tables: dict[str, list[str]] = {}
    for row in rows:
        tables.setdefault(row["table_name"], []).append(row["column_name"])

    print(f"[seed] Candidate tables found: {list(tables.keys())}")
    for tbl, cols in tables.items():
        print(f"[seed]   {tbl}: {cols}")

    # Try to find a table that has BOTH a name column and an instructions column
    for table in CANDIDATE_TABLES:
        if table not in tables:
            continue
        cols = tables[table]
        instr_col = next((c for c in INSTRUCTION_COLUMNS if c in cols), None)
        name_col = next((c for c in NAME_COLUMNS if c in cols), None)
        if instr_col and name_col:
            print(
                f"[seed] Using table={table!r}, name_col={name_col!r}, "
                f"instructions_col={instr_col!r}"
            )
            return table, name_col, instr_col

    print("[seed] WARNING: Could not discover a suitable table/column combination.")
    return None


def load_souls(agents_dir: pathlib.Path) -> dict[str, str]:
    """
    Walk agents_dir and return {normalised_name: soul_content}.

    Directory layout expected: <agents_dir>/<agent-name>/SOUL.md
    """
    souls: dict[str, str] = {}
    if not agents_dir.is_dir():
        print(f"[seed] WARNING: AGENTS_DIR {agents_dir} does not exist — skipping.")
        return souls

    for soul_path in sorted(agents_dir.glob("*/SOUL.md")):
        agent_dir = soul_path.parent.name
        key = normalise(agent_dir)
        content = soul_path.read_text(encoding="utf-8").strip()
        souls[key] = content
        print(f"[seed] Loaded SOUL.md for {agent_dir!r} → key={key!r} ({len(content)} chars)")

    return souls


def seed(conn, table: str, name_col: str, instr_col: str, souls: dict[str, str]) -> None:
    """Match each SOUL.md to a row in the DB and update it."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    # Fetch all rows from the target table (only the columns we need)
    cur.execute(f'SELECT id, "{name_col}", "{instr_col}" FROM "{table}"')  # noqa: S608
    rows = cur.fetchall()
    print(f"[seed] Found {len(rows)} row(s) in table {table!r}")

    updated = 0
    skipped = 0

    for row in rows:
        row_name = row[name_col] or ""
        row_key = normalise(row_name)

        if row_key not in souls:
            print(f"[seed]   No SOUL.md match for {row_name!r} (normalised: {row_key!r}) — skipping")
            skipped += 1
            continue

        new_content = souls[row_key]
        existing = (row[instr_col] or "").strip()

        if existing == new_content:
            print(f"[seed]   {row_name!r}: already up-to-date — no change")
            skipped += 1
            continue

        cur.execute(
            f'UPDATE "{table}" SET "{instr_col}" = %s WHERE id = %s',  # noqa: S608
            (new_content, row["id"]),
        )
        print(f"[seed]   {row_name!r}: updated instructions ({len(new_content)} chars)")
        updated += 1

    conn.commit()
    print(f"[seed] Done — {updated} updated, {skipped} skipped.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("[seed] Starting SOUL.md seeding…")
    print(f"[seed] AGENTS_DIR = {AGENTS_DIR}")
    print(f"[seed] DATABASE_URL = {DATABASE_URL.split('@')[-1]}")  # hide credentials

    souls = load_souls(AGENTS_DIR)
    if not souls:
        print("[seed] No SOUL.md files found — nothing to do.")
        sys.exit(0)

    conn = wait_for_db(DATABASE_URL)
    try:
        # Retry schema discovery — Paperclip may still be running migrations
        result = None
        for attempt in range(1, 13):  # up to ~60s of waiting
            result = discover_schema(conn)
            if result is not None:
                break
            print(f"[seed] Schema not ready yet (attempt {attempt}/12), retrying in 5s…")
            time.sleep(5)

        if result is None:
            print(
                "[seed] Schema discovery failed after retries. "
                "Paperclip may not have finished initialising its schema."
            )
            sys.exit(1)

        table, name_col, instr_col = result
        seed(conn, table, name_col, instr_col, souls)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
