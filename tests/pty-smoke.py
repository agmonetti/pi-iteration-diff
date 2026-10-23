"""Isolated Pi CLI smoke. Injected PTY input is NOT a human/Herdr mouse test."""
import fcntl
import os
import pty
import select
import shutil
import signal
import struct
import subprocess
import tempfile
import termios
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    with tempfile.TemporaryDirectory(prefix="pi-diff-m2-") as temp:
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 30, 120, 0, 0))
        env = {k: v for k, v in os.environ.items() if not k.startswith("HERDR_")}
        env.update(PI_CODING_AGENT_DIR=temp, PI_OFFLINE="1", PI_TELEMETRY="0", TERM="xterm-256color")
        env.pop("TERM_PROGRAM", None)
        command = [shutil.which("pi"), "--offline", "--no-session", "--no-extensions",
                   "--no-mcp", "--no-skills", "--no-prompt-templates", "--no-context-files",
                   "--tui-mode", "fullscreen", "-e", str(ROOT / "src/index.ts")]
        child = subprocess.Popen(command, cwd=temp, env=env, stdin=slave, stdout=slave,
                                 stderr=slave, start_new_session=True)
        os.close(slave)
        output = bytearray()

        def pump(seconds=1):
            until = time.monotonic() + seconds
            while time.monotonic() < until:
                if select.select([master], [], [], 0.05)[0]:
                    try:
                        data = os.read(master, 65536)
                    except OSError:
                        break
                    if not data:
                        break
                    output.extend(data)

        def send(data):
            os.write(master, data)
            pump()

        try:
            pump(4)
            assert child.poll() is None, "Pi exited during startup"
            assert b"DIFF:" not in output, "panel auto-opened"
            send(b"/diff\r")
            assert b"DIFF:" in output, "sidebar did not render"
            send(b"DRAFT-M2")
            send(b"\x1b[17~")  # F6
            send(b"\x1b")
            assert b"DRAFT-M2" in output, "native draft did not render"
            send(b"\x03")  # native clear, not send
            send(b"/diff\r")
            send(b"/iteration-diff\r")
            send(b"/reload\r")
            send(b"/diff\r")
            assert b"Failed to load extension" not in output
            assert b"Layout desconocido" not in output
            send(b"\x03")
            send(b"\x04")
            pump(2)
            assert child.poll() == 0, "Pi did not exit cleanly"
            assert b"\x1b[?1006l" in output, "mouse reset missing"
            print("PASS: installed Pi PTY startup, manual /diff and fallback, native draft, F6/Esc, reload, clean exit/mouse reset")
            print("LIMIT: ANSI stream assertions outside Git; no visual/manual Herdr validation or lifecycle model run")
        except Exception:
            # Only synthetic isolated content is printed, never a real session transcript.
            print(output[-6000:].decode(errors="replace"))
            raise
        finally:
            if child.poll() is None:
                child.send_signal(signal.SIGTERM)
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()
            os.close(master)


if __name__ == "__main__":
    main()
