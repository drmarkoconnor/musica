#!/usr/bin/env python3
"""Move the existing Practice Loop checkout into its own local subfolder.

No changes are made without --apply. Requires Python 3.9+ and Git; uses only
the standard library. The script itself can be inside the directory moved.
"""

import argparse
import ctypes
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit


DEFAULT_SOURCE = Path("/Users/moc/repos/all_things_coding/2026/markoconnorai")
RECEIPT = ".musica-relocation.json"
BLOCKED_GIT_STATE = (
    "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-apply",
    "rebase-merge", "BISECT_START", "sequencer",
)


class Refusal(RuntimeError):
    pass


def exists(path):
    return os.path.lexists(path)


def git(project, *arguments):
    result = subprocess.run(
        ["git", "-c", "core.fsmonitor=false", "-C", str(project), *arguments],
        env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"},
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )
    if result.returncode:
        # Git stderr/configuration can contain credential-bearing remote URLs.
        raise Refusal("Git could not complete a local repository check; no remote details are printed.")
    return result.stdout


def is_expected_remote(value):
    value = value.strip()
    if value.startswith("git@github.com:"):
        owner_repo = value[len("git@github.com:"):]
    else:
        parsed = urlsplit(value)
        if parsed.hostname != "github.com" or parsed.scheme not in ("https", "ssh"):
            return False
        owner_repo = parsed.path.lstrip("/")
    return owner_repo.removesuffix(".git").rstrip("/").lower() == "drmarkoconnor/musica"


def git_snapshot(project):
    # The helper's receipt is outside the relocated checkout but inside an
    # undone checkout. Exclude this one file from the consistency comparison.
    status = git(
        project, "status", "--porcelain=v1", "-z", "--untracked-files=all",
        "--", ".", ":(top,exclude)" + RECEIPT,
    )
    return git(project, "rev-parse", "HEAD").strip(), status


def inspect_project(project):
    if not project.is_dir() or project.is_symlink():
        raise Refusal("The project must be an existing real directory.")
    try:
        package = json.loads((project / "package.json").read_text())
    except (OSError, ValueError) as error:
        raise Refusal("Cannot read the project's package.json.") from error
    if package.get("name") != "practice-loop":
        raise Refusal("package.json is not the expected practice-loop project.")
    git_dir = project / ".git"
    if not git_dir.is_dir() or git_dir.is_symlink():
        raise Refusal("This helper requires a normal .git directory; linked worktrees and submodules need separate handling.")
    if Path(os.fsdecode(git(project, "rev-parse", "--show-toplevel")).strip()).resolve() != project:
        raise Refusal("The selected folder is not the root of its Git checkout.")
    common = Path(os.fsdecode(git(project, "rev-parse", "--git-common-dir")).strip())
    if not common.is_absolute():
        common = project / common
    if common.resolve() != git_dir:
        raise Refusal("This checkout uses a shared or external Git directory.")
    config = git(project, "config", "--local", "--list", "--null")
    if any(item.lower().startswith(b"core.worktree\n") for item in config.split(b"\0")):
        raise Refusal("Git has a custom core.worktree setting; review that path before moving.")
    worktrees = git_dir / "worktrees"
    if worktrees.exists() and any(worktrees.iterdir()):
        raise Refusal("This repository has linked worktrees; moving it would leave their paths stale.")
    if any((git_dir / name).exists() for name in BLOCKED_GIT_STATE):
        raise Refusal("A Git operation is in progress. Finish or cancel it before moving the project.")
    if any(git_dir.rglob("*.lock")):
        raise Refusal("A Git lock exists. Close Git clients and resolve the lock before trying again.")
    remote = os.fsdecode(git(project, "remote", "get-url", "origin"))
    if not is_expected_remote(remote):
        raise Refusal("The origin remote does not identify drmarkoconnor/musica on GitHub.")
    inspect_symlinks(project)
    return git_snapshot(project)


def inspect_symlinks(project):
    """Relative links confined to the project survive moving the whole tree."""
    def walk_error(error):
        raise Refusal("A project directory could not be inspected; no move was started.") from error

    for directory, directories, filenames in os.walk(project, followlinks=False, onerror=walk_error):
        for name in directories + filenames:
            path = Path(directory) / name
            if not path.is_symlink():
                continue
            target = os.readlink(path)
            if os.path.isabs(target):
                raise Refusal("An absolute symlink needs review before moving: " + str(path.relative_to(project)))
            try:
                resolved = path.resolve()
            except (OSError, RuntimeError) as error:
                raise Refusal("A symlink cannot be resolved safely: " + str(path.relative_to(project))) from error
            if not resolved.is_relative_to(project):
                raise Refusal("A symlink leaves the project: " + str(path.relative_to(project)))


def rename_exclusive(source, destination):
    """Atomic same-filesystem rename that refuses to overwrite any destination."""
    library = ctypes.CDLL(None, use_errno=True)
    if sys.platform == "darwin":
        rename = library.renamex_np
        rename.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_uint]
        rename.restype = ctypes.c_int
        result = rename(os.fsencode(source), os.fsencode(destination), 0x4)  # RENAME_EXCL
    elif sys.platform.startswith("linux") and hasattr(library, "renameat2"):
        rename = library.renameat2
        rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
        rename.restype = ctypes.c_int
        result = rename(-100, os.fsencode(source), -100, os.fsencode(destination), 1)  # RENAME_NOREPLACE
    else:
        raise Refusal("This platform does not provide the required no-overwrite rename operation.")
    if result:
        number = ctypes.get_errno()
        raise OSError(number, os.strerror(number), str(destination))


def write_receipt(path, data, *, create=False):
    # Keep the original receipt if an update is interrupted. Never replace a
    # user file at the temporary name or follow a symlink.
    encoded = json.dumps(data, indent=2) + "\n"
    if create:
        with path.open("x", encoding="utf-8") as output:
            output.write(encoded)
            output.flush()
            os.fsync(output.fileno())
        return
    temporary = path.with_name(path.name + ".pending")
    with temporary.open("x", encoding="utf-8") as output:
        output.write(encoded)
        output.flush()
        os.fsync(output.fileno())
    if path.is_symlink() or not path.is_file():
        raise Refusal("The relocation receipt changed unexpectedly. Existing files were left in place.")
    os.replace(temporary, path)


def names_in(folder, *, omit_receipt=False):
    return sorted(entry.name for entry in folder.iterdir() if not (omit_receipt and entry.name == RECEIPT))


def describe(project, destination, names, snapshot, undo):
    print("UNDO relocation" if undo else "Move Practice Loop into its own folder")
    print("From: " + str(project))
    print("To:   " + str(destination))
    print("Repository: verified drmarkoconnor/musica; package: practice-loop")
    print("Git state: " + ("uncommitted/untracked changes are present and will be preserved" if snapshot[1] else "clean"))
    print("All top-level entries, including hidden files and ignored recordings:")
    for name in names:
        print("  " + name)
    print("Close editors, terminals using this folder, development servers and Git clients before --apply.")


def perform_moves(origin, destination, names, snapshot, receipt_path, record, *, undo):
    moved = []
    created_destination = False
    try:
        if not undo:
            destination.mkdir()
            created_destination = True
        for name in names:
            rename_exclusive(origin / name, destination / name)
            moved.append(name)
        if git_snapshot(destination) != snapshot:
            raise Refusal("The Git state changed during the move; rolling the folder move back.")
        if undo:
            origin.rmdir()  # Succeeds only when the now-empty app folder is empty.
        record["state"] = "undone" if undo else "completed"
        record["finished_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
        write_receipt(receipt_path, record)
    except BaseException as error:
        failures = []
        # An undo can remove its empty origin before receipt writing fails.
        if undo and not exists(origin):
            origin.mkdir()
        for name in reversed(moved):
            try:
                rename_exclusive(destination / name, origin / name)
            except BaseException:
                failures.append(name)
        if created_destination:
            try:
                destination.rmdir()
            except OSError:
                failures.append("the destination folder is not empty")
        record["state"] = "recovery-needed" if failures else ("completed" if undo else "rolled-back")
        record["rollback_obstacles"] = failures
        try:
            write_receipt(receipt_path, record)
        except BaseException:
            pass  # The initial inventory remains available even if updating fails.
        if failures:
            raise Refusal("Move stopped. Some entries could not be returned; nothing was overwritten. Keep both folders and consult " + str(receipt_path)) from error
        raise Refusal("Move stopped and all moved entries were returned. The receipt was retained: " + str(receipt_path)) from error


def run(source, *, apply=False, undo=False):
    requested = Path(os.path.abspath(source))
    if requested.resolve() != requested:
        raise Refusal("The source path passes through a symlink. Use the real project path after reviewing it.")
    if any(name in os.environ for name in ("GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE")):
        raise Refusal("Clear Git directory/index override environment variables before running this helper.")
    source = requested
    destination = source / "musica"
    receipt = source / RECEIPT
    if exists(receipt.with_name(RECEIPT + ".pending")):
        raise Refusal("A pending relocation receipt exists. Inspect it before attempting another move.")

    if undo:
        if receipt.is_symlink() or not receipt.is_file():
            raise Refusal("No safe relocation receipt was found at the original source path.")
        record = json.loads(receipt.read_text())
        if (record.get("version") != 1 or record.get("source") != str(source)
                or record.get("destination") != str(destination) or record.get("state") != "completed"):
            raise Refusal("The receipt does not describe a completed relocation at these exact paths.")
        extras = set(names_in(source)) - {"musica", RECEIPT}
        if extras:
            raise Refusal("Undo requires the parent folder to contain only musica and the receipt. Additional entries: " + ", ".join(sorted(extras)))
        snapshot = inspect_project(destination)
        names = names_in(destination)
        if RECEIPT in names or "musica" in names:
            raise Refusal("A new app entry conflicts with the undo destination.")
        describe(destination, source, names, snapshot, True)
        if not apply:
            print("DRY RUN: nothing changed. Add --undo --apply to perform the undo.")
            return
        record["state"] = "undoing"
        record["undo_entries"] = names
        write_receipt(receipt, record)
        perform_moves(destination, source, names, snapshot, receipt, record, undo=True)
        print("Undo completed. All app contents are back at the original path; the receipt remains.")
        return

    if exists(destination):
        raise Refusal("The destination already exists. Nothing will be merged or overwritten: " + str(destination))
    if exists(receipt):
        raise Refusal("A relocation receipt already exists. Inspect it; use --undo for a completed move.")
    snapshot = inspect_project(source)
    names = names_in(source)
    describe(source, destination, names, snapshot, False)
    if not apply:
        print("DRY RUN: nothing changed. Add --apply to perform the move.")
        return
    record = {
        "version": 1, "source": str(source), "destination": str(destination),
        "started_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "state": "moving", "git_head": os.fsdecode(snapshot[0]),
        "had_uncommitted_changes": bool(snapshot[1]),
        "entries": [{"name": name, "size": (source / name).lstat().st_size,
                     "mtime_ns": (source / name).lstat().st_mtime_ns} for name in names],
    }
    write_receipt(receipt, record, create=True)
    perform_moves(source, destination, names, snapshot, receipt, record, undo=False)
    print("Relocation completed: " + str(destination))
    print("Local files and Git history are preserved. No network, deployment or database operation was performed.")
    print("Receipt: " + str(receipt))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Existing app root (defaults to the path shown in Mark's Finder screenshot).")
    parser.add_argument("--apply", action="store_true", help="Perform the move; otherwise print a dry run.")
    parser.add_argument("--undo", action="store_true", help="Return a completed relocation to its original folder (dry run unless --apply).")
    arguments = parser.parse_args()
    try:
        run(arguments.source, apply=arguments.apply, undo=arguments.undo)
    except (Refusal, OSError, ValueError) as error:
        print("STOPPED: " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
