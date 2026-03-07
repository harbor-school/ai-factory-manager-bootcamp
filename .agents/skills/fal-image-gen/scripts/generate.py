#!/usr/bin/env python3
"""
fal.ai Z-Image Turbo Generator
Usage: python3 generate.py --prompt "your prompt" --output output.png [options]

Requires FAL_KEY environment variable.
"""

import argparse
import json
import os
import sys
import urllib.request
import random

FAL_ENDPOINT = "https://fal.run/fal-ai/z-image/turbo"


def generate(prompt, seed=None, width=1024, height=1024, steps=4,
             num_images=1, output_format="png", safety_checker=True):
    api_key = os.environ.get("FAL_KEY")
    if not api_key:
        print("Error: FAL_KEY environment variable not set", file=sys.stderr)
        print("Get your key at https://fal.ai/dashboard/keys", file=sys.stderr)
        sys.exit(1)

    body = {
        "prompt": prompt,
        "image_size": {"width": width, "height": height},
        "num_inference_steps": steps,
        "num_images": num_images,
        "output_format": output_format,
        "enable_safety_checker": safety_checker,
    }
    if seed is not None:
        body["seed"] = seed

    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        FAL_ENDPOINT,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Key {api_key}",
        },
    )

    try:
        resp = urllib.request.urlopen(req, timeout=120)
        result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"API error {e.code}: {err_body}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Request failed: {e}", file=sys.stderr)
        sys.exit(1)

    return result


def download_image(url, output_path):
    req = urllib.request.Request(url)
    data = urllib.request.urlopen(req, timeout=60).read()
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(data)
    return len(data)


def main():
    parser = argparse.ArgumentParser(description="Generate images via fal.ai Z-Image Turbo")
    parser.add_argument("--prompt", "-p", required=True, help="Text prompt")
    parser.add_argument("--output", "-o", required=True, help="Output file path")
    parser.add_argument("--seed", type=int, default=None, help="Seed for reproducibility")
    parser.add_argument("--width", "-W", type=int, default=1024, help="Width (default: 1024)")
    parser.add_argument("--height", "-H", type=int, default=1024, help="Height (default: 1024)")
    parser.add_argument("--steps", type=int, default=4, help="Inference steps 1-8 (default: 4)")
    parser.add_argument("--num", "-n", type=int, default=1, help="Number of images 1-4 (default: 1)")
    parser.add_argument("--format", "-f", default="png", choices=["png", "jpeg", "webp"], help="Output format")
    parser.add_argument("--no-safety", action="store_true", help="Disable safety checker")
    args = parser.parse_args()

    print(f"Generating: {args.prompt[:80]}...")

    result = generate(
        prompt=args.prompt,
        seed=args.seed,
        width=args.width,
        height=args.height,
        steps=args.steps,
        num_images=args.num,
        output_format=args.format,
        safety_checker=not args.no_safety,
    )

    images = result.get("images", [])
    if not images:
        print("No images returned", file=sys.stderr)
        sys.exit(1)

    seed_used = result.get("seed", "unknown")
    print(f"Seed: {seed_used}")

    for i, img in enumerate(images):
        if args.num == 1:
            path = args.output
        else:
            base, ext = os.path.splitext(args.output)
            path = f"{base}_{i+1}{ext}"

        size = download_image(img["url"], path)
        print(f"Saved: {path} ({size:,} bytes, {img.get('width','?')}x{img.get('height','?')})")


if __name__ == "__main__":
    main()
