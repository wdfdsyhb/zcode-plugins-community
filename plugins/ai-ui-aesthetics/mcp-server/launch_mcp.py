"""Self-bootstrapping launcher for the ai-ui-aesthetics Design Research MCP server.

Why this exists:
    The MCP server (`mcp_server.py`) needs a Python environment with several
    dependencies (fastmcp, httpx, beautifulsoup4, Pillow). Those come from a
    `.venv` that is intentionally NOT committed to the repository, and the
    interpreter path in `plugin.json` must therefore be an absolute path on the
    installing machine — which makes "install by cloning/importing" fragile.

    This launcher removes that requirement. ZCode launches *this* script with a
    plain `python` from PATH; the script guarantees a working venv (creating it
    and installing requirements on first run), then hands off to the real
    server. The plugin manifest points here via the `${ZCODE_PLUGIN_ROOT}`
    template, so the plugin can be imported anywhere with just Python installed.

Usage:
    python launch_mcp.py          # from any directory; script self-locates
"""

from __future__ import annotations

import os
import subprocess
import sys

# All paths are derived from this file's location, so the script works
# regardless of the working directory ZCode sets.
MCP_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_DIR = os.path.join(MCP_DIR, ".venv")
REQUIREMENTS = os.path.join(MCP_DIR, "requirements.txt")
SERVER = os.path.join(MCP_DIR, "mcp_server.py")


def _venv_python() -> str:
    """Return the venv's Python executable path for this platform."""
    if os.name == "nt":
        return os.path.join(VENV_DIR, "Scripts", "python.exe")
    return os.path.join(VENV_DIR, "bin", "python")


def ensure_environment() -> str:
    """Create the venv if missing, then ensure requirements are installed. Returns the venv python."""
    if not os.path.exists(os.path.join(VENV_DIR, "pyvenv.cfg")):
        print(f"[ai-ui-aesthetics] creating virtualenv at {VENV_DIR}...", file=sys.stderr)
        subprocess.check_call([sys.executable, "-m", "venv", VENV_DIR])
        print("[ai-ui-aesthetics] installing dependencies...", file=sys.stderr)
        return _install()

    # Fast path: venv exists. But an existing venv is NOT proof the deps landed --
    # an interrupted or failed first install leaves a valid pyvenv.cfg with an
    # empty site-packages, and trusting it means the server can never recover
    # (it would keep failing to import fastmcp on every launch). Verify, and
    # repair by installing if the check fails.
    if _deps_ok(_venv_python()):
        return _venv_python()
    print("[ai-ui-aesthetics] dependencies missing from venv; installing...", file=sys.stderr)
    return _install()


def _deps_ok(py: str) -> bool:
    """True only if the venv can actually import what the server needs."""
    r = subprocess.run(
        [py, "-c", "import fastmcp, httpx, bs4, PIL"],
        capture_output=True,
    )
    return r.returncode == 0


def _install() -> str:
    """Install requirements into the venv. Returns the venv python."""
    py = _venv_python()
    subprocess.check_call(
        [py, "-m", "pip", "install", "--quiet", "-r", REQUIREMENTS],
        stdout=sys.stderr,
    )
    return py


def main() -> int:
    py = ensure_environment()
    if "--smoke" in sys.argv[1:]:
        return smoke(py)
    # Hand off to the real server, inheriting stdin/stdout so the MCP stdio
    # transport reaches it unchanged.
    return subprocess.call([py, SERVER], stdin=sys.stdin, stdout=sys.stdout, stderr=sys.stderr)


def smoke(py: str) -> int:
    """List the MCP tools to prove the server can boot; exit 0 on success."""
    code = (
        "import sys; sys.path.insert(0, %r); "
        "import mcp_server as m; from asyncio import run; "
        "print([t.name for t in run(m.mcp.list_tools())])" % MCP_DIR
    )
    r = subprocess.run([py, "-c", code], capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    sys.stderr.write(r.stderr)
    return r.returncode


if __name__ == "__main__":
    raise SystemExit(main())
