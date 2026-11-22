from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_MODEL = "cf/@cf/black-forest-labs/flux-2-klein-9b"
MANIFEST = Path(__file__).with_name("manifest.json")


def load_assets(only: set[str] | None) -> list[dict]:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assets = [a for a in data["assets"] if a.get("prompt")]
    if only:
        assets = [a for a in assets if a["id"] in only]
    return assets


def generate(base_url: str, key: str, model: str, asset: dict, out_dir: Path) -> Path:
    payload = json.dumps(
        {
            "model": model,
            "prompt": asset["prompt"],
            "n": 1,
            "size": asset["size"],
        }
    ).encode()
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/v1/images/generations?response_format=binary",
        data=payload,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        body = response.read()
    if len(body) < 5000:
        raise RuntimeError(f"{asset['id']}: response too small ({len(body)} bytes)")
    path = out_dir / (asset["id"] + ".jpg")
    path.write_bytes(body)
    return path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Regenerate the Dead Air graphics asset pack through a 9router gateway.",
        epilog=(
            "Example: NINEROUTER_URL=http://localhost:20128 NINEROUTER_KEY=sk-... "
            "python3 regenerate.py --out /tmp/deadair-assets "
            "--model cf/@cf/black-forest-labs/flux-2-klein-9b --only keyart_title"
        ),
    )
    parser.add_argument("--out", required=True, help="directory for raw images")
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument(
        "--only",
        nargs="*",
        help="asset ids to regenerate (default: every asset with a prompt)",
    )
    args = parser.parse_args()

    base_url = os.environ.get("NINEROUTER_URL", "http://localhost:20128")
    key = os.environ.get("NINEROUTER_KEY", "")
    if not key:
        print("NINEROUTER_KEY is required", file=sys.stderr)
        return 2

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    assets = load_assets(set(args.only) if args.only else None)
    if not assets:
        print("no matching assets", file=sys.stderr)
        return 2

    failures = 0
    for asset in assets:
        try:
            generate(base_url, key, args.model, asset, out_dir)
            print(f"ok   {asset['id']}  {asset['size']}")
        except (urllib.error.URLError, RuntimeError, OSError) as exc:
            failures += 1
            print(f"fail {asset['id']}  {exc}", file=sys.stderr)

    print(f"{len(assets) - failures}/{len(assets)} generated into {out_dir}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
