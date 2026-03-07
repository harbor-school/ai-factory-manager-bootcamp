---
name: fal-image-gen
description: Generate images using fal.ai Z-Image Turbo API. Use when the user asks to generate, create, or make images. Fast (~2s), cheap (~7 won/image), no GPU server needed. Supports text-to-image with custom prompts, seeds, dimensions, and batch generation up to 4 images.
---

# fal.ai Z-Image Turbo Generator

Generate images via fal.ai serverless API. No GPU server required.

## Setup

1. Get API key: https://fal.ai/dashboard/keys
2. Set environment variable: `export FAL_KEY="your-key-here"`

## Pricing

- $0.005/megapixel (~7원/장 at 1024x1024)
- 1,000장 = ~7,000원

## Quick Usage

```bash
python3 scripts/generate.py \
  --prompt "a samurai warrior in cherry blossom garden" \
  --output /path/to/output.png
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--prompt`, `-p` | (required) | Text prompt |
| `--output`, `-o` | (required) | Output file path |
| `--seed` | random | Reproducibility seed |
| `--width`, `-W` | 1024 | Image width |
| `--height`, `-H` | 1024 | Image height |
| `--steps` | 4 | Inference steps (1-8, more = better quality) |
| `--num`, `-n` | 1 | Number of images (1-4) |
| `--format`, `-f` | png | Output format: png, jpeg, webp |
| `--no-safety` | false | Disable safety checker |

### Batch generation

```bash
# Multiple images in one call
python3 scripts/generate.py -p "a cute cat" -o cats.png --num 4

# Loop with different prompts
for item in "a cat" "a dog" "a bird"; do
  python3 scripts/generate.py -p "$item" -o "${item// /_}.png"
done
```

### Direct API (Python, no SDK needed)

```python
import json, urllib.request, os

url = "https://fal.run/fal-ai/z-image/turbo"
body = json.dumps({
    "prompt": "your prompt here",
    "image_size": {"width": 1024, "height": 1024},
    "num_inference_steps": 4,
    "num_images": 1,
    "output_format": "png"
}).encode()

req = urllib.request.Request(url, data=body, headers={
    "Content-Type": "application/json",
    "Authorization": f"Key {os.environ['FAL_KEY']}"
})
result = json.loads(urllib.request.urlopen(req, timeout=120).read())
image_url = result["images"][0]["url"]
```

### Preset Sizes

| Name | Size | Use case |
|------|------|----------|
| square | 1024x1024 | Default, product images |
| portrait | 768x1024 | Profile photos, mobile |
| landscape | 1024x768 | Banners, thumbnails |
| wide | 1280x720 | 16:9 content |

## Troubleshooting

- **FAL_KEY not set**: Get key at https://fal.ai/dashboard/keys
- **429 Too Many Requests**: Rate limited, wait and retry
- **Empty images**: Check if safety checker blocked content
