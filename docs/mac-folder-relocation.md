# Give the music app its own local folder

**Completed on Mark's Mac, 13 September 2026:** Mark moved the files in Finder,
then moved the hidden project files. `git rev-parse --show-toplevel` confirmed
`/Users/moc/repos/all_things_coding/2026/markoconnorai/musica`. The remaining Git
changes were exported and reconciled separately. Do not run the relocation
helper again in this already-moved checkout. The instructions below are retained
for other checkouts that have not yet moved.

The folder in Mark's Finder screenshot is:

`/Users/moc/repos/all_things_coding/2026/markoconnorai`

This helper moves the **whole existing app checkout** into:

`/Users/moc/repos/all_things_coding/2026/markoconnorai/musica`

The parent `markoconnorai` folder can then hold other independent projects.
Git history, uncommitted changes, hidden configuration files, local recordings,
notes, dependencies and other ignored files move with the app. This is a local
folder move, not a conversion to a monorepo.

**The Mac folder has not been moved by the remote implementation work.** Run the
helper on the Mac only after this branch's changes, including the helper, are
available in the existing checkout. Do not force-reset or overwrite local work
to obtain the changes.

## Check the proposed move

Requires Python 3.9 or later and Git. First stop the app's development server,
close editors and Git clients using the project, and stop any lesson imports or
recordings. Use a Terminal whose working directory is outside the app. The
helper checks Git locks and unfinished Git operations; it cannot detect every
running process that might write to the project.

```bash
cd /Users/moc
python3 /Users/moc/repos/all_things_coding/2026/markoconnorai/scripts/relocate-mac-project.py
```

This is a **dry run**. It prints the source, destination, Git status summary and
the complete list of top-level entries to move, including hidden files. It
does not print configuration values or credentials and does not modify files.
Check that every listed entry belongs to this music project. If another
project is already mixed into the folder, do not apply this whole-folder move.

The helper requires the `practice-loop` package and an `origin` remote for
`drmarkoconnor/musica` on GitHub. It refuses existing destinations, external or
absolute symlinks, shared Git directories, linked worktrees and active Git
operations. These cases need individual review rather than an automatic move.
Ordinary uncommitted changes are preserved, not rejected or stashed.

## Apply

When the dry-run list is correct:

```bash
python3 /Users/moc/repos/all_things_coding/2026/markoconnorai/scripts/relocate-mac-project.py --apply
```

The helper writes a relocation inventory/receipt at
`markoconnorai/.musica-relocation.json` before moving anything. The receipt lists
names and metadata; it is **not a second copy of the files or a substitute for
your normal backup**. Moves use the operating system's no-overwrite rename
operation. If a move fails or is interrupted with Ctrl+C, the helper attempts
to return every moved entry. It never deletes or overwrites conflicting files.
A forced shutdown can interrupt recovery; keep both folders and the receipt
if the operation does not report completion.

After completion, open `markoconnorai/musica` in your editor. For local work:

```bash
cd /Users/moc/repos/all_things_coding/2026/markoconnorai/musica
git status --short
npm run dev
```

Update any Finder aliases, editor workspaces or personal scripts that contain
the old absolute folder path. If Next.js reports a stale generated path, stop
the server and ask for that specific cache to be repaired; do not delete the
project or reinstall everything as part of this move.

## What happens to the live app?

Nothing needs changing on Netlify for this local-only relocation. The Git
repository still has the app at its repository root; its remote, build
configuration and public URL stay the same. The helper does not install
dependencies, run Git commits/pushes, contact a service, deploy the app or
change the database. Local Netlify configuration moves with all other app
files. Continue running local development/deployment commands from `musica`.

## Undo

Before adding sibling projects or other files to `markoconnorai`, preview an
undo from outside the app:

```bash
cd /Users/moc
python3 /Users/moc/repos/all_things_coding/2026/markoconnorai/musica/scripts/relocate-mac-project.py --undo
```

Then, if the listed move is correct:

```bash
python3 /Users/moc/repos/all_things_coding/2026/markoconnorai/musica/scripts/relocate-mac-project.py --undo --apply
```

Undo returns the app's **current** contents, including changes made after the
move, to the original folder. It refuses a parent containing extra entries or
any conflicting destination. The receipt remains after undo. Keep it as a
record; if you later want to relocate again, first move that receipt elsewhere
after verifying its `undone` state. A `rolled-back` or `recovery-needed` receipt
also requires inspection before retrying.

For a deliberately different location, pass `--source /absolute/path/to/app`
to both the original move and any undo. The target is always `musica` directly
inside that exact source; the identity and safety checks still apply.

## Rerun the helper's checks

From this repository, run `python3 scripts/test-relocate-mac-project.py`.
All 13 checks use disposable temporary repositories and never operate on the
real Mac project path. They cover preservation of files and Git state,
no-overwrite guards, undo and rollback after a simulated partial failure.
