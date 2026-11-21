#!/usr/bin/env python3
"""Publish the rendered FMV masters to the R2 bucket and record their URLs.

DEA-202. `--dry-run` verifies the masters against motion-assets.json and prints the
plan without touching the network. Environment, never committed: R2_ENDPOINT,
R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CDN_BASE_URL.

The H.264 master goes to the public prefix because the game and social links fetch
it. The 3.2 GB ProRes alpha is a compositing asset: private prefix, no CDN URL,
since publishing it is cost and bandwidth with no reader.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "deadair-fmv-publish/1.0"


def http_head(url: str) -> tuple[int, int]:
    """Return (status, content-length) for a public URL, 0 when the header is absent."""
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, int(response.headers.get("content-length") or 0)
    except urllib.error.HTTPError as error:
        return error.code, 0

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "motion-assets.json"
PREFIX = "deadair/fmv/60s"
PRIVATE_PREFIX = f"{PREFIX}/private"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def manifest_problems(masters: dict) -> list[str]:
    problems: list[str] = []
    for name, meta in masters.items():
        path = ROOT / meta["path"]
        if not path.is_file():
            problems.append(f"{name}: missing {meta['path']}")
            continue
        size = path.stat().st_size
        if size != meta["bytes"]:
            problems.append(f"{name}: size {size} != recorded {meta['bytes']}")
            continue
        actual = sha256(path)
        if actual != meta["sha256"]:
            problems.append(f"{name}: sha256 {actual} != recorded {meta['sha256']}")
    return problems


def client():
    import boto3

    missing = [
        key
        for key in ("R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")
        if not os.environ.get(key)
    ]
    if missing:
        sys.exit("publish_masters: missing env " + ", ".join(missing))
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def bucket_name(manifest: dict) -> str:
    """The bucket the manifest records. A host-wide R2_BUCKET must not silently win:
    this machine exports R2_BUCKET=training, which would publish into the wrong bucket."""
    recorded = manifest.get("cdn", {}).get("bucket")
    env = os.environ.get("R2_BUCKET")
    if recorded and env and env != recorded:
        sys.exit(f"publish_masters: R2_BUCKET={env} but motion-assets.json records {recorded}")
    if recorded:
        return recorded
    if env:
        return env
    sys.exit("publish_masters: no bucket in motion-assets.json and R2_BUCKET is unset")


def upload_jobs(manifest: dict, with_compositing: bool) -> list[tuple[str, str, str]]:
    jobs = [("web", manifest["masters"]["web"]["path"], f"{PREFIX}/{Path(manifest['masters']['web']['path']).name}")]
    if with_compositing:
        local = manifest["masters"]["compositing"]["path"]
        jobs.append(("compositing", local, f"{PRIVATE_PREFIX}/{Path(local).name}"))
    return jobs


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="verify and print, upload nothing")
    parser.add_argument("--with-compositing", action="store_true", help="also upload the ProRes alpha master")
    parser.add_argument("--check", action="store_true", help="verify the URLs already recorded")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text())
    jobs = upload_jobs(manifest, args.with_compositing)

    if args.check and not args.dry_run:
        cdn = manifest.get("cdn", {})
        # Verify what the manifest records as published, not what this run asked to upload:
        # upload_jobs() only carries the compositing master under --with-compositing, and a
        # recorded compositingObject must still be checked when that flag is absent.
        targets = [("web", f"{PREFIX}/{Path(manifest['masters']['web']['path']).name}")]
        if cdn.get("compositingObject"):
            targets.append(("compositing", cdn["compositingObject"]))
        from botocore.exceptions import ClientError

        bucket = bucket_name(manifest)
        s3 = client()
        sizes = {}
        for key, object_key in targets:
            try:
                head = s3.head_object(Bucket=bucket, Key=object_key)
            except ClientError as error:
                code = error.response.get("Error", {}).get("Code", "unknown")
                print(f"FAIL {key}: {object_key} unreadable ({code})", file=sys.stderr)
                return 1
            sizes[key] = head["ContentLength"]
            print(f"{key}: {head['ContentLength']} bytes, etag {head['ETag'].strip(chr(34))[:12]}")

        base = cdn.get("cdnUrl")
        if not base:
            print("bucket objects verified; no public URL recorded (cdn.cdnUrl is null)")
            return 0
        status, length = http_head(base)
        if status != 200:
            print(f"FAIL {base} answered {status}", file=sys.stderr)
            return 1
        if "web" in sizes and length != sizes["web"]:
            print(f"FAIL {base} served {length} bytes, bucket holds {sizes['web']}", file=sys.stderr)
            return 1
        print(f"public OK: {base} ({status}, {length} bytes)")
        return 0

    problems = manifest_problems(manifest["masters"])
    for key, local, object_key in jobs:
        print(f"[{'plan' if args.dry_run else 'upload'}] {key}: {local} -> s3://{object_key}")
    if problems:
        for problem in problems:
            print("FAIL " + problem, file=sys.stderr)
        return 1
    print(f"verified {len(manifest['masters'])} masters against motion-assets.json")

    if args.dry_run:
        base = os.environ.get("CDN_BASE_URL", "<CDN_BASE_URL unset>")
        print(f"public URL would be {base.rstrip('/')}/{jobs[0][2]}")
        return 0

    s3 = client()
    bucket = bucket_name(manifest)
    base = os.environ.get("CDN_BASE_URL", "").rstrip("/")

    for key, local, object_key in jobs:
        extra = {"CacheControl": "public, max-age=31536000, immutable"}
        if key == "web":
            extra["ContentType"] = "video/mp4"
        s3.upload_file(str(ROOT / local), bucket, object_key, ExtraArgs=extra)
        print(f"uploaded {object_key}")

    public_url = f"{base}/{jobs[0][2]}" if base else None
    manifest["masters"]["web"]["cdnUrl"] = public_url
    manifest["cdn"] = {
        "status": "published" if public_url else "uploaded",
        "reason": None if public_url else "objects are in the bucket but no public host resolves yet",
        "bucket": bucket,
        "prefix": PREFIX,
        "cdnUrl": public_url,
        "compositingObject": jobs[1][2] if args.with_compositing else None,
        "publishedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"recorded {bucket}/{PREFIX} in {MANIFEST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
