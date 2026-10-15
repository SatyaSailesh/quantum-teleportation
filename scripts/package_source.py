#!/usr/bin/env python
"""Create a complete, clean source archive without installed/generated trees."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {"node_modules", "dist", ".venv", "__pycache__", ".pytest_cache", ".git", ".cache", ".arena",
            "e2e-artifacts", "production-e2e-artifacts", "playwright-report", "test-results", "build", "coverage"}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT.parent / "quantum-teleportation-source.zip")
    args = parser.parse_args()
    files = []
    for path in sorted(ROOT.rglob("*")):
        relative = path.relative_to(ROOT)
        if not path.is_file() or any(part in EXCLUDED for part in relative.parts): continue
        if path.suffix in {".pyc", ".tsbuildinfo", ".zip"} or path.name in {".env", "SOURCE_MANIFEST.json", "npm-audit-initial.json"}: continue
        if path.name.endswith("-initial.png"): continue
        files.append(path)
    manifest = [{"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size,
                 "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in files]
    manifest_path = ROOT / "docs" / "SOURCE_MANIFEST.json"
    manifest_path.write_text(json.dumps({"files": manifest, "file_count_excluding_manifest": len(files)}, indent=2), encoding="utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(args.output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in [*files, manifest_path]:
            archive.write(path, ROOT.name + "/" + str(path.relative_to(ROOT)))
    with zipfile.ZipFile(args.output) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        for required in ["README.md", "backend/app/engine.py", "backend/tests/reference_numpy.py",
                         "frontend/src/pages/Mitigation.tsx", "frontend/package-lock.json", "docs/TEST_REPORT.md"]:
            assert ROOT.name + "/" + required in names, required
        assert not any('/node_modules/' in n or '/dist/' in n or '/.venv/' in n for n in names)
    print(f"Source archive: {args.output}")
    print(f"Files: {len(files)+1}; compressed size: {args.output.stat().st_size:,} bytes; ZIP integrity verified.")


if __name__ == "__main__":
    main()
