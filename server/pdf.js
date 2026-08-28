import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const outputDirectory = path.resolve("output", "pdf");
fs.mkdirSync(outputDirectory, { recursive: true });

function slug(value) {
  return (
    String(value || "document")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "document"
  );
}

export function generatePdf(type, data) {
  const filename = `${slug(data.lead?.name)}-${type}.pdf`;
  const outputPath = path.join(outputDirectory, filename);
  const script = path.resolve("scripts", "generate_pdf.py");
  const localPython = process.env.LOCALAPPDATA
    ? path.join(
        process.env.LOCALAPPDATA,
        "Programs",
        "Python",
        "Python311",
        "python.exe",
      )
    : null;
  const candidates = [
    process.env.PDF_PYTHON && { command: process.env.PDF_PYTHON, prefix: [] },
    localPython &&
      fs.existsSync(localPython) && { command: localPython, prefix: [] },
    process.platform === "win32" && { command: "py", prefix: ["-3.11"] },
    {
      command: process.platform === "win32" ? "python" : "python3",
      prefix: [],
    },
  ].filter(Boolean);

  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  const errors = [];
  for (const candidate of candidates) {
    const result = spawnSync(
      candidate.command,
      [...candidate.prefix, script, type, outputPath],
      {
        input: JSON.stringify(data),
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    if (result.status === 0 && fs.existsSync(outputPath)) {
      return {
        filename,
        outputPath,
        metadata: JSON.parse(result.stdout || "{}"),
      };
    }
    errors.push(
      `${candidate.command}: ${result.error?.message || result.stderr || result.stdout || "failed"}`,
    );
  }
  throw new Error(`PDF generation failed: ${errors.join(" | ").slice(0, 900)}`);
}
