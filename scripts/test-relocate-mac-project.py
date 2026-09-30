#!/usr/bin/env python3
"""Exercise relocation exclusively in disposable temporary Git repositories.

Run: python3 scripts/test-relocate-mac-project.py
No test uses the helper's default source, contacts a remote, or reads a Mac
project folder. Only Python's standard library and local Git are required.
"""

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


HELPER = Path(__file__).resolve().with_name("relocate-mac-project.py")
SPEC = importlib.util.spec_from_file_location("relocation_helper", HELPER)
relocation = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(relocation)


def git(project, *arguments):
    return subprocess.check_output(
        ["git", "-C", str(project), *arguments], stderr=subprocess.DEVNULL,
    )


def file_contents(project):
    return {
        str(path.relative_to(project)): path.read_bytes()
        for path in project.rglob("*")
        if path.is_file() and not path.is_symlink() and path.name != relocation.RECEIPT
    }


class RelocationTests(unittest.TestCase):
    def setUp(self):
        environment = {**os.environ, "GIT_CONFIG_NOSYSTEM": "1",
                       "GIT_CONFIG_GLOBAL": os.devnull,
                       "GIT_CONFIG_SYSTEM": os.devnull, "GIT_TERMINAL_PROMPT": "0"}
        for name in ("GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_INDEX_FILE",
                     "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_TEMPLATE_DIR"):
            environment.pop(name, None)
        # Prevent personal Git hooks, signing, templates or URL rewrites from
        # influencing fixture creation or invoking external programs.
        environment_patch = patch.dict(os.environ, environment, clear=True)
        environment_patch.start()
        self.addCleanup(environment_patch.stop)
        self.temporary = tempfile.TemporaryDirectory(prefix="musica-relocation-test-")
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name).resolve()
        self.project = self.base / "markoconnorai"
        self.project.mkdir()
        git(self.project, "init")
        git(self.project, "config", "user.email", "test@example.invalid")
        git(self.project, "config", "user.name", "Relocation Test")
        # Registering a remote URL is a local config change; no network call occurs.
        git(self.project, "remote", "add", "origin", "git@github.com:drmarkoconnor/musica.git")
        (self.project / "package.json").write_text('{"name":"practice-loop"}')
        (self.project / ".gitignore").write_text(".env\nlessonrecordings/\nnode_modules/\n")
        (self.project / "notes.md").write_text("original")
        git(self.project, "add", ".")
        git(self.project, "-c", "commit.gpgsign=false", "commit", "-m", "fixture")
        (self.project / "notes.md").write_text("important uncommitted note")
        (self.project / "staged.md").write_text("staged changes")
        git(self.project, "add", "staged.md")
        (self.project / ".env").write_text("SECRET=fixture-value-must-not-be-printed")
        (self.project / "lessonrecordings").mkdir()
        (self.project / "lessonrecordings" / "lesson.m4a").write_bytes(bytes(range(256)) * 40)
        (self.project / "node_modules").mkdir()
        (self.project / "node_modules" / "package.js").write_text("fixture")
        (self.project / "node_modules" / "link.js").symlink_to("package.js")
        (self.project / "scripts").mkdir()
        shutil.copyfile(HELPER, self.project / "scripts" / HELPER.name)

    def run_helper(self, **options):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            # Explicit source on every invocation: the real Mac path is never used.
            relocation.run(self.project, **options)
        return output.getvalue()

    def receipt(self):
        return json.loads((self.project / relocation.RECEIPT).read_text())

    def assert_refused_before_move(self):
        with self.assertRaises(relocation.Refusal):
            self.run_helper(apply=True)
        self.assertFalse((self.project / relocation.RECEIPT).exists())

    def test_dry_run_does_not_write_or_print_configuration_values(self):
        before = file_contents(self.project)
        output = self.run_helper()
        self.assertEqual(file_contents(self.project), before)
        self.assertFalse((self.project / relocation.RECEIPT).exists())
        self.assertFalse((self.project / "musica").exists())
        self.assertNotIn("fixture-value-must-not-be-printed", output)
        self.assertIn("uncommitted/untracked changes are present", output)

    def test_executing_script_moves_itself_preserving_all_contents_and_git_state(self):
        before = file_contents(self.project)
        snapshot = relocation.git_snapshot(self.project)
        result = subprocess.run(
            [sys.executable, str(self.project / "scripts" / HELPER.name),
             "--source", str(self.project), "--apply"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        target = self.project / "musica"
        self.assertEqual(file_contents(target), before)
        self.assertEqual(relocation.git_snapshot(target), snapshot)
        self.assertEqual((target / "node_modules" / "link.js").resolve().read_text(), "fixture")
        self.assertEqual(self.receipt()["state"], "completed")
        self.assertNotIn("fixture-value-must-not-be-printed", result.stdout)

    def test_undo_dry_run_and_self_executing_undo_preserve_new_work(self):
        self.run_helper(apply=True)
        target = self.project / "musica"
        (target / "new-practice-note.md").write_text("new work after move")
        before = file_contents(target)
        self.run_helper(undo=True)
        self.assertEqual(file_contents(target), before)
        self.assertEqual(self.receipt()["state"], "completed")
        result = subprocess.run(
            [sys.executable, str(target / "scripts" / HELPER.name),
             "--source", str(self.project), "--undo", "--apply"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(target.exists())
        self.assertEqual(file_contents(self.project), before)
        self.assertEqual(self.receipt()["state"], "undone")

    def test_partial_failure_rolls_back_all_moved_entries(self):
        before = file_contents(self.project)
        original_rename = relocation.rename_exclusive
        calls = 0

        def fail_third(source, destination):
            nonlocal calls
            calls += 1
            if calls == 3:
                raise OSError("injected movement failure")
            return original_rename(source, destination)

        with patch.object(relocation, "rename_exclusive", side_effect=fail_third):
            with self.assertRaisesRegex(relocation.Refusal, "all moved entries were returned"):
                self.run_helper(apply=True)
        self.assertEqual(file_contents(self.project), before)
        self.assertFalse((self.project / "musica").exists())
        self.assertEqual(self.receipt()["state"], "rolled-back")

    def test_refuses_existing_destination(self):
        (self.project / "musica").mkdir()
        self.assert_refused_before_move()

    def test_refuses_symlink_outside_project(self):
        (self.project / "escape").symlink_to("../outside")
        self.assert_refused_before_move()

    def test_refuses_absolute_symlink(self):
        (self.project / "absolute").symlink_to(self.project / "notes.md")
        self.assert_refused_before_move()

    def test_refuses_git_lock(self):
        (self.project / ".git" / "index.lock").touch()
        self.assert_refused_before_move()

    def test_refuses_external_git_directory(self):
        (self.project / ".git").rename(self.base / "external-git")
        (self.project / ".git").write_text("gitdir: ../external-git\n")
        self.assert_refused_before_move()

    def test_refuses_linked_worktrees(self):
        (self.project / ".git" / "worktrees" / "other").mkdir(parents=True)
        self.assert_refused_before_move()

    def test_refuses_wrong_remote(self):
        git(self.project, "remote", "set-url", "origin", "https://github.com/somebody/else.git")
        self.assert_refused_before_move()

    def test_refuses_wrong_package(self):
        (self.project / "package.json").write_text('{"name":"another-app"}')
        self.assert_refused_before_move()

    def test_atomic_rename_never_overwrites_existing_destination(self):
        original = self.base / "original"
        collision = self.base / "collision"
        original.write_text("original")
        collision.write_text("collision")
        with self.assertRaises(FileExistsError):
            relocation.rename_exclusive(original, collision)
        self.assertEqual(original.read_text(), "original")
        self.assertEqual(collision.read_text(), "collision")


if __name__ == "__main__":
    unittest.main(verbosity=2)
