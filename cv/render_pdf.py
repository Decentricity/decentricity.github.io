from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parent
SOURCE_MD = ROOT / "full.md"
OUTPUT_PDF = ROOT / "full.pdf"
PHOTO = Path(
    "/storage/emulated/0/Pictures/Screenshots/"
    "Screenshot_2026-04-05-14-29-25-63_965bbf4d18d205f782c6b8409c5773a4.jpg"
)


def clean_markdown_inline(text: str) -> str:
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1", text)
    text = text.replace("**", "")
    text = text.replace("*", "")
    text = text.replace("`", "")
    return text.strip()


def parse_markdown(md_path: Path) -> tuple[str, list[str], list[tuple[str, list[tuple[str, str]]]]]:
    lines = md_path.read_text(encoding="utf-8").splitlines()
    in_frontmatter = False
    title = ""
    contacts: list[str] = []
    sections: list[tuple[str, list[tuple[str, str]]]] = []
    current_section = None
    current_items: list[tuple[str, str]] = []

    for raw in lines:
        line = raw.rstrip()
        if line == "---":
            in_frontmatter = not in_frontmatter
            continue
        if in_frontmatter:
            continue
        if not title and line.startswith("# "):
            title = clean_markdown_inline(line[2:])
            continue
        if title and not sections and (line.strip() or raw.endswith("  ")):
            if line.startswith("## "):
                current_section = clean_markdown_inline(line[3:])
                current_items = []
                sections.append((current_section, current_items))
                continue
            contacts.append(clean_markdown_inline(line))
            continue
        if line.startswith("## "):
            current_section = clean_markdown_inline(line[3:])
            current_items = []
            sections.append((current_section, current_items))
            continue
        if current_section is None:
            continue
        if line.startswith("### "):
            current_items.append(("h3", clean_markdown_inline(line[4:])))
        elif line.startswith("#### "):
            current_items.append(("h4", clean_markdown_inline(line[5:])))
        elif line.startswith("- "):
            current_items.append(("bullet", clean_markdown_inline(line[2:])))
        elif line.strip():
            current_items.append(("p", clean_markdown_inline(line)))
        else:
            current_items.append(("space", ""))
    return title, contacts, sections


def build_pdf() -> None:
    title, contacts, sections = parse_markdown(SOURCE_MD)

    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        leftMargin=0.65 * inch,
        rightMargin=0.65 * inch,
        topMargin=0.55 * inch,
        bottomMargin=0.55 * inch,
        title=title,
        author="Pandu Wisaksono Sastrowardoyo",
    )

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Name",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=colors.HexColor("#101418"),
            alignment=TA_LEFT,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Contact",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=12,
            textColor=colors.HexColor("#333333"),
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=15,
            textColor=colors.HexColor("#0d3b66"),
            spaceBefore=10,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Role",
            parent=styles["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=10.8,
            leading=13,
            textColor=colors.black,
            spaceBefore=5,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Subhead",
            parent=styles["BodyText"],
            fontName="Helvetica-Bold",
            fontSize=9.6,
            leading=12,
            textColor=colors.HexColor("#444444"),
            spaceBefore=3,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=12,
            textColor=colors.black,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletCV",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.4,
            leading=12,
            leftIndent=12,
            firstLineIndent=0,
            bulletIndent=0,
            spaceAfter=2,
        )
    )

    story = []

    photo = Image(str(PHOTO), width=1.55 * inch, height=1.65 * inch)
    photo.hAlign = "RIGHT"
    header_left = [Paragraph(title, styles["Name"])]
    for line in contacts:
        stripped = line.strip()
        if stripped:
            header_left.append(Paragraph(stripped.replace("  ", ""), styles["Contact"]))
    header_table = Table(
        [[header_left, photo]],
        colWidths=[doc.width - 1.8 * inch, 1.8 * inch],
        hAlign="LEFT",
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#8ca0b3")))
    story.append(Spacer(1, 6))

    for section_title, items in sections:
        story.append(Paragraph(section_title, styles["Section"]))
        grouped = []
        for kind, text in items:
            if kind == "h3":
                if grouped:
                    story.append(KeepTogether(grouped))
                    grouped = []
                grouped.append(Paragraph(text, styles["Role"]))
            elif kind == "h4":
                grouped.append(Paragraph(text, styles["Subhead"]))
            elif kind == "bullet":
                grouped.append(Paragraph(f"- {text}", styles["Body"]))
            elif kind == "p":
                grouped.append(Paragraph(text, styles["Body"]))
            elif kind == "space":
                if grouped:
                    story.append(KeepTogether(grouped))
                    grouped = []
                story.append(Spacer(1, 2))
        if grouped:
            story.append(KeepTogether(grouped))

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
