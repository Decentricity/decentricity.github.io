import type { ImageGenerationRequest, ImageGenerationResult } from "../types.js";
import type { ImageGeneratorProvider } from "./imageGenerator.js";

export class LocalPrototypeProvider implements ImageGeneratorProvider {
  readonly id = "local-context-imaginer";

  async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas unavailable");
    }

    const random = mulberry32(hashString(JSON.stringify(request.context)));
    const weather = request.context.weather.description.toLowerCase();
    const isIndoor = request.context.mode === "indoor";
    const isNight = request.context.time.dayPeriod === "night";
    const rain = weather.includes("rain") || weather.includes("storm");

    context.fillStyle = isNight ? "#1b1c1b" : isIndoor ? "#716d64" : "#9ca49a";
    context.fillRect(0, 0, 1024, 1024);

    if (isIndoor) {
      this.drawIndoor(context, random, isNight);
    } else {
      this.drawOutdoor(context, random, isNight, rain);
    }

    this.addWeatherAndFilm(context, random, rain, request.context.audio.descriptor);

    return {
      imageDataUrl: canvas.toDataURL("image/jpeg", 0.9),
      provider: this.id
    };
  }

  private drawOutdoor(context: CanvasRenderingContext2D, random: () => number, isNight: boolean, rain: boolean): void {
    context.fillStyle = isNight ? "#20242a" : rain ? "#7e8886" : "#a9b3ad";
    context.fillRect(0, 0, 1024, 500);

    context.fillStyle = isNight ? "#22251f" : "#6d7663";
    context.fillRect(0, 500, 1024, 524);

    const blocks = 7 + Math.floor(random() * 8);
    for (let index = 0; index < blocks; index += 1) {
      const width = 70 + random() * 150;
      const height = 150 + random() * 390;
      const x = random() * 1024 - 60;
      const y = 500 - height + random() * 80;
      context.fillStyle = isNight ? shade("#272b30", random()) : shade("#747d77", random());
      context.fillRect(x, y, width, height);

      if (isNight) {
        context.fillStyle = "#d8bc76";
        for (let row = 0; row < height / 38; row += 1) {
          for (let col = 0; col < width / 34; col += 1) {
            if (random() > 0.62) {
              context.fillRect(x + 12 + col * 32, y + 18 + row * 34, 9, 7);
            }
          }
        }
      }
    }

    context.fillStyle = isNight ? "#30312b" : "#575e4f";
    for (let index = 0; index < 18; index += 1) {
      const x = random() * 1024;
      const y = 480 + random() * 200;
      context.beginPath();
      context.arc(x, y, 28 + random() * 72, 0, Math.PI * 2);
      context.fill();
    }

    if (rain) {
      context.strokeStyle = "rgba(225, 231, 226, 0.38)";
      context.lineWidth = 2;
      for (let index = 0; index < 180; index += 1) {
        const x = random() * 1100 - 60;
        const y = random() * 1024;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x - 18, y + 48);
        context.stroke();
      }
    }
  }

  private drawIndoor(context: CanvasRenderingContext2D, random: () => number, isNight: boolean): void {
    context.fillStyle = isNight ? "#34302a" : "#8a8475";
    context.fillRect(0, 0, 1024, 1024);

    context.fillStyle = isNight ? "#201d19" : "#625d53";
    context.fillRect(0, 612, 1024, 412);

    const tableY = 640 + random() * 100;
    context.fillStyle = isNight ? "#493c2f" : "#76634f";
    context.fillRect(80, tableY, 864, 94);

    for (let index = 0; index < 8; index += 1) {
      const x = 140 + random() * 740;
      const y = tableY - 80 + random() * 70;
      context.fillStyle = shade(isNight ? "#c6a66c" : "#d7c69f", random());
      context.beginPath();
      context.arc(x, y, 28 + random() * 38, 0, Math.PI * 2);
      context.fill();
    }

    for (let index = 0; index < 5; index += 1) {
      const x = 100 + random() * 800;
      const y = 120 + random() * 320;
      const width = 95 + random() * 160;
      const height = 65 + random() * 120;
      context.fillStyle = isNight ? "#191817" : "#36352f";
      context.fillRect(x, y, width, height);
      context.fillStyle = isNight ? "#7b6548" : "#b5a074";
      context.fillRect(x + 8, y + 8, width - 16, height - 16);
    }
  }

  private addWeatherAndFilm(
    context: CanvasRenderingContext2D,
    random: () => number,
    rain: boolean,
    audioDescriptor: string
  ): void {
    const image = context.getImageData(0, 0, 1024, 1024);
    const data = image.data;
    const grain = audioDescriptor === "Loud" || audioDescriptor === "Busy street" ? 26 : 18;

    for (let index = 0; index < data.length; index += 4) {
      const noise = (random() - 0.5) * grain;
      data[index] = clampByte((data[index] ?? 0) + noise + 4);
      data[index + 1] = clampByte((data[index + 1] ?? 0) + noise + 2);
      data[index + 2] = clampByte((data[index + 2] ?? 0) + noise - 3);
    }

    context.putImageData(image, 0, 0);
    context.fillStyle = rain ? "rgba(205, 214, 209, 0.12)" : "rgba(246, 229, 192, 0.08)";
    context.fillRect(0, 0, 1024, 1024);

    context.strokeStyle = "rgba(18, 16, 14, 0.42)";
    context.lineWidth = 38;
    context.strokeRect(19, 19, 986, 986);
  }
}

function hashString(input: string): number {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(base: string, amount: number): string {
  const value = Number.parseInt(base.slice(1), 16);
  const shift = Math.round((amount - 0.5) * 46);
  const r = clampByte((value >> 16) + shift);
  const g = clampByte(((value >> 8) & 255) + shift);
  const b = clampByte((value & 255) + shift);
  return `rgb(${r}, ${g}, ${b})`;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

