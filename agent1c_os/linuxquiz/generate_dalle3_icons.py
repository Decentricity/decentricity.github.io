import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime

API_BASE = "https://api.openai.com/v1"

try:
    from PIL import Image
except Exception:
    Image = None


def http_post(url, payload, api_key):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {api_key}")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code}: {body}") from e


def fetch_json(url):
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read().decode("utf-8"))


def summarize_to_object(question_text, api_key, model):
    if not api_key:
        return question_text

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "Return a short, concrete physical object concept (2-5 words). No punctuation."
            },
            {
                "role": "user",
                "content": f"Summarize this question into a single object concept: {question_text}"
            }
        ],
        "temperature": 0.2,
        "max_tokens": 20
    }
    data = http_post(f"{API_BASE}/chat/completions", payload, api_key)
    return data["choices"][0]["message"]["content"].strip()


def generate_image(prompt, api_key, model, size):
    payload = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "quality": "standard",
        "style": "natural",
        "response_format": "b64_json",
        "n": 1
    }
    data = http_post(f"{API_BASE}/images/generations", payload, api_key)
    b64 = data["data"][0]["b64_json"]
    return base64.b64decode(b64)


def save_image(data, out_path, target_size):
    with open(out_path, "wb") as f:
        f.write(data)

    if Image is None:
        print("Pillow not installed; saved original size.")
        return

    try:
        with Image.open(out_path) as img:
            img = img.convert("RGBA")
            img = img.resize((target_size, target_size), Image.LANCZOS)
            img.save(out_path)
    except Exception as e:
        print(f"Failed to resize {out_path}: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json-url", default=None, help="Questions JSON URL")
    parser.add_argument("--json-file", default=None, help="Path to local questions JSON")
    parser.add_argument("--image-model", default="dall-e-3", help="Image model")
    parser.add_argument("--text-model", default="gpt-4o-mini", help="Text model for summaries")
    parser.add_argument("--size", default="1024x1024", help="DALL-E 3 size (use 1024x1024 then downscale)")
    parser.add_argument("--out-dir", default="images", help="Output directory")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print("Missing OPENAI_API_KEY in environment.")
        sys.exit(1)

    if args.json_file:
        with open(args.json_file, "r", encoding="utf-8") as f:
            data = json.load(f)
    elif args.json_url:
        data = fetch_json(args.json_url)
    else:
        print("Provide --json-url or --json-file")
        sys.exit(1)

    questions = data.get("questions", [])
    if not questions:
        print("No questions found")
        sys.exit(1)

    os.makedirs(args.out_dir, exist_ok=True)
    manifest = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "count": len(questions),
        "items": []
    }

    for q in questions:
        qid = q.get("id")
        text = q.get("text", "")
        if not qid or not text:
            continue
        out_path = os.path.join(args.out_dir, f"{qid}.png")
        if os.path.exists(out_path) and not args.overwrite:
            print(f"Skip {qid} (exists)")
            continue

        concept = summarize_to_object(text, api_key, args.text_model)
        prompt = (
            f"Low-poly PS1-era style 3D icon of a single {concept}. "
            "Clean, minimal, no cartoon, no corporate, no text. "
            "Centered object, neutral background, soft studio lighting."
        )

        print(f"Generating {qid}: {concept}")
        image_data = generate_image(prompt, api_key, args.image_model, args.size)
        save_image(image_data, out_path, 256)

        manifest["items"].append({
            "id": qid,
            "question": text,
            "concept": concept,
            "prompt": prompt,
            "file": f"{qid}.png"
        })

    manifest_path = os.path.join(args.out_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("Done. Images saved to", args.out_dir)


if __name__ == "__main__":
    main()
