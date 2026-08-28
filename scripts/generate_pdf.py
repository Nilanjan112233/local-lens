import json
import os
import sys
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfgen import canvas as pdf_canvas

GREEN = colors.HexColor("#176f5e")
DARK = colors.HexColor("#14221f")
MUTED = colors.HexColor("#66736f")
LIGHT = colors.HexColor("#eef6f2")
LINE = colors.HexColor("#dce5e0")
AMBER = colors.HexColor("#b86f1b")

def register_fonts():
    regular = r"C:\Windows\Fonts\arial.ttf"
    bold = r"C:\Windows\Fonts\arialbd.ttf"
    if os.path.exists(regular) and os.path.exists(bold):
        pdfmetrics.registerFont(TTFont("LocalLens", regular))
        pdfmetrics.registerFont(TTFont("LocalLens-Bold", bold))
        return "LocalLens", "LocalLens-Bold"
    return "Helvetica", "Helvetica-Bold"

FONT, FONT_BOLD = register_fonts()

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Brand", fontName=FONT_BOLD, fontSize=10, textColor=GREEN, leading=13, spaceAfter=4))
styles.add(ParagraphStyle(name="TitleLL", fontName=FONT_BOLD, fontSize=25, textColor=DARK, leading=30, spaceAfter=9))
styles.add(ParagraphStyle(name="SubtitleLL", fontName=FONT, fontSize=10, textColor=MUTED, leading=15, spaceAfter=16))
styles.add(ParagraphStyle(name="HeadingLL", fontName=FONT_BOLD, fontSize=14, textColor=DARK, leading=18, spaceBefore=13, spaceAfter=7))
styles.add(ParagraphStyle(name="SubheadingLL", fontName=FONT_BOLD, fontSize=10.5, textColor=DARK, leading=14, spaceBefore=8, spaceAfter=4))
styles.add(ParagraphStyle(name="BodyLL", fontName=FONT, fontSize=9.3, textColor=DARK, leading=14, spaceAfter=6))
styles.add(ParagraphStyle(name="SmallLL", fontName=FONT, fontSize=7.5, textColor=MUTED, leading=11))
styles.add(ParagraphStyle(name="CalloutLL", fontName=FONT, fontSize=9.2, textColor=DARK, leading=14, leftIndent=9, rightIndent=9, spaceBefore=7, spaceAfter=7, borderColor=LINE, borderWidth=0.7, borderPadding=9, backColor=LIGHT))
styles.add(ParagraphStyle(name="RightLL", fontName=FONT, fontSize=8, textColor=MUTED, alignment=TA_RIGHT))

def safe(value):
    if value is None:
        return ""
    text = str(value)
    if any(marker in text for marker in ("Ã", "â€", "Â")):
        for legacy_encoding in ("cp1252", "latin-1"):
            try:
                text = text.encode(legacy_encoding).decode("utf-8")
                break
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def bullet_list(items):
    result = []
    for item in (items or []):
        text = item if isinstance(item, str) else item.get("title") or item.get("action") or str(item)
        result.append(Paragraph(f"<font color='#176f5e'>-</font> {safe(text)}", styles["BodyLL"]))
    return result

def brand_header():
    return Paragraph(
        "LOCALLENS",
        ParagraphStyle(
            name="PageBrand",
            parent=styles["BodyLL"],
            fontName=FONT_BOLD,
            fontSize=9,
            leading=12,
            textColor=colors.white,
            backColor=DARK,
            borderPadding=(8, 10, 8, 10),
            spaceAfter=0,
        ),
    )

def fact_table(lead, verification, score):
    rows = [
        ["Category", safe(lead.get("category")), "Commercial score", f"{score.get('score', '-')} / 100"],
        ["Rating", f"{lead.get('rating', '-')} ({lead.get('reviewCount', 0)} reviews)", "Website verdict", safe((verification or {}).get("verdict", "Not verified")).replace("_", " ")],
        ["Phone", safe(lead.get("phone") or "Not listed"), "Confidence", safe((verification or {}).get("confidence", "Not verified"))],
    ]
    table = Table(rows, colWidths=[27 * mm, 57 * mm, 32 * mm, 53 * mm])
    table.setStyle(TableStyle([
        ("FONTNAME", (0,0), (-1,-1), FONT), ("FONTSIZE", (0,0), (-1,-1), 8.3), ("TEXTCOLOR", (0,0), (-1,-1), DARK),
        ("FONTNAME", (0,0), (0,-1), FONT_BOLD), ("FONTNAME", (2,0), (2,-1), FONT_BOLD),
        ("BACKGROUND", (0,0), (-1,-1), colors.white), ("GRID", (0,0), (-1,-1), 0.5, LINE),
        ("VALIGN", (0,0), (-1,-1), "TOP"), ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    return table

def dossier_story(data):
    lead = data.get("lead", {})
    analysis = data.get("analysis") or {}
    verification = data.get("verification") or {}
    score = data.get("commercialScore") or {}
    story = [brand_header(), Spacer(1, 6 * mm), Paragraph("PRIVATE OPPORTUNITY DOSSIER", styles["Brand"]), Paragraph(safe(lead.get("name", "Business opportunity")), styles["TitleLL"]), Paragraph(f"{safe(lead.get('address'))}<br/>Prepared {datetime.now().strftime('%d %B %Y')}", styles["SubtitleLL"]), fact_table(lead, verification, score)]
    story += [Paragraph("Executive assessment", styles["HeadingLL"]), Paragraph(safe(analysis.get("executiveSummary") or verification.get("summary") or "This business requires further verification before a digital opportunity can be confirmed."), styles["CalloutLL"])]
    story += [Paragraph("Why this opportunity surfaced", styles["HeadingLL"])] + bullet_list(lead.get("reasons", []))
    story += [Paragraph("Independent website verification", styles["HeadingLL"]), Paragraph(safe(verification.get("summary") or "Independent website verification has not yet been completed."), styles["BodyLL"])]
    if verification.get("candidatePresences"):
        for presence in verification["candidatePresences"][:8]:
            story.append(Paragraph(f"<b>{safe(presence.get('classification','')).replace('_',' ').title()}</b>: {safe(presence.get('url'))}<br/><font color='#66736f'>{safe(presence.get('rationale'))}</font>", styles["BodyLL"]))
    story += [PageBreak(), brand_header(), Spacer(1, 6 * mm), Paragraph("Business and market analysis", styles["Brand"]), Paragraph("Strengths worth preserving", styles["HeadingLL"])] + bullet_list(analysis.get("businessStrengths", []))
    story += [Paragraph("Digital gaps to discuss", styles["HeadingLL"])] + bullet_list(analysis.get("digitalGaps", []))
    story += [Paragraph("Highest-value opportunities", styles["HeadingLL"])]
    for opportunity in analysis.get("opportunities", []):
        story.append(KeepTogether([Paragraph(f"{safe(opportunity.get('title'))} - {safe(opportunity.get('impact','')).upper()} IMPACT", styles["SubheadingLL"]), Paragraph(safe(opportunity.get("rationale")), styles["BodyLL"])]))
    story += [Paragraph("Relevant competitor lessons", styles["HeadingLL"])]
    if analysis.get("competitors"):
        for competitor in analysis["competitors"]:
            story.append(Paragraph(f"<b>{safe(competitor.get('name'))}</b>: {safe(competitor.get('digitalAdvantage'))}<br/><font color='#66736f'>Lesson: {safe(competitor.get('lesson'))}</font>", styles["BodyLL"]))
    else:
        story.append(Paragraph("Competitor evidence was not available in this analysis.", styles["BodyLL"]))
    build = analysis.get("recommendedBuild") or {}
    story += [PageBreak(), brand_header(), Spacer(1, 6 * mm), Paragraph("Recommended client discussion", styles["Brand"]), Paragraph(safe(build.get("type") or "Website scope to be agreed"), styles["TitleLL"]), Paragraph(safe(build.get("goal") or "Confirm the owner's priorities before defining scope."), styles["CalloutLL"])]
    two_columns = Table([[Table([[Paragraph("Potential pages", styles["SubheadingLL"])]] + [[x] for x in bullet_list(build.get("pages", []))], colWidths=[78 * mm]), Table([[Paragraph("Potential features", styles["SubheadingLL"])]] + [[x] for x in bullet_list(build.get("features", []))], colWidths=[78 * mm])]], colWidths=[84 * mm, 84 * mm])
    two_columns.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("BOX", (0,0), (-1,-1), 0.5, LINE), ("INNERGRID", (0,0), (-1,-1), 0.5, LINE), ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7), ("TOPPADDING", (0,0), (-1,-1), 7)]))
    story.append(two_columns)
    story += [Paragraph("Priority actions", styles["HeadingLL"])]
    for action in sorted(analysis.get("priorityActions", []), key=lambda x: x.get("priority", 99)):
        story.append(Paragraph(f"<b>{action.get('priority')}. {safe(action.get('action'))}</b><br/>{safe(action.get('reason'))}", styles["BodyLL"]))
    story += [Paragraph("Suggested outreach angle", styles["HeadingLL"]), Paragraph(safe(analysis.get("outreachAngle") or "Lead with the business's reputation and ask whether an owned website would support its current priorities."), styles["CalloutLL"])]
    story += [Paragraph("Evidence limitations", styles["HeadingLL"])] + bullet_list((analysis.get("caveats") or []) + (verification.get("riskFlags") or []))
    sources = (verification.get("sources") or []) + (analysis.get("sources") or [])
    story += [Paragraph("Sources", styles["HeadingLL"])]
    if sources:
        for source in sources[:15]: story.append(Paragraph(f"{safe(source.get('title'))}: {safe(source.get('url'))}", styles["SmallLL"]))
    else: story.append(Paragraph("Google Maps source listing supplied by the application; no additional grounded sources recorded.", styles["SmallLL"]))
    return story

def proposal_story(data):
    lead = data.get("lead", {})
    proposal = data.get("proposal", {})
    story = [brand_header(), Spacer(1, 6 * mm), Paragraph("WEBSITE SERVICES PROPOSAL", styles["Brand"]), Paragraph(safe(proposal.get("title", "Website project")), styles["TitleLL"]), Paragraph(f"Prepared for {safe(lead.get('name'))}<br/>{safe(lead.get('address'))}<br/>Prepared {datetime.now().strftime('%d %B %Y')}", styles["SubtitleLL"])]
    amount = f"{safe(proposal.get('currency','INR'))} {float(proposal.get('amount',0)):,.0f}"
    summary = Table([[Paragraph("PROPOSED INVESTMENT", styles["Brand"]), Paragraph(amount, styles["TitleLL"])], [Paragraph("Package", styles["SmallLL"]), Paragraph(safe(proposal.get("packageKey", "custom")).title(), styles["BodyLL"])]], colWidths=[85 * mm, 84 * mm])
    summary.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), LIGHT), ("BOX", (0,0), (-1,-1), 0.7, LINE), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LEFTPADDING", (0,0), (-1,-1), 12), ("TOPPADDING", (0,0), (-1,-1), 10), ("BOTTOMPADDING", (0,0), (-1,-1), 10)]))
    story += [summary, Paragraph("Project objective", styles["HeadingLL"]), Paragraph(safe(proposal.get("summary")), styles["CalloutLL"])]
    scope = proposal.get("scope") or {}
    story += [Paragraph("Proposed scope", styles["HeadingLL"]), Paragraph("Pages", styles["SubheadingLL"])] + bullet_list(scope.get("pages", []))
    story += [Paragraph("Features", styles["SubheadingLL"])] + bullet_list(scope.get("features", []))
    story += [Paragraph("Revisions", styles["SubheadingLL"]), Paragraph(f"{scope.get('revisions', 1)} revision round(s) are included within the agreed scope.", styles["BodyLL"])]
    story += [Paragraph("Responsibilities and terms", styles["HeadingLL"])] + bullet_list(proposal.get("terms", []))
    story += [PageBreak(), brand_header(), Spacer(1, 6 * mm), Paragraph("Next steps", styles["HeadingLL"])] + bullet_list(["Confirm the objectives and final written scope", "Confirm schedule, payment milestones, domain, hosting, and third-party costs", "Sign or otherwise accept the proposal in writing", "Pay the agreed deposit before implementation begins", "Supply approved business facts, content, and media rights"])
    story += [Spacer(1, 8 * mm), Paragraph("This proposal describes services only. LocalLens does not generate or deliver the website. Final implementation is performed separately after agreement.", styles["CalloutLL"])]
    story += [Paragraph("Acceptance record", styles["HeadingLL"]), Paragraph("Complete this section only after the final scope, schedule, commercial terms, and responsibilities have been reviewed.", styles["BodyLL"])]
    acceptance = Table([["Client name", ""], ["Accepted scope", ""], ["Signature / written acceptance reference", ""], ["Date", ""]], colWidths=[57 * mm, 112 * mm], rowHeights=[13 * mm] * 4)
    acceptance.setStyle(TableStyle([("FONTNAME", (0,0), (-1,-1), FONT), ("FONTSIZE", (0,0), (-1,-1), 8), ("FONTNAME", (0,0), (0,-1), FONT_BOLD), ("GRID", (0,0), (-1,-1), 0.5, LINE), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LEFTPADDING", (0,0), (-1,-1), 7)]))
    story.append(acceptance)
    return story

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: generate_pdf.py <dossier|proposal> <output_path>")
    document_type, output_path = sys.argv[1], sys.argv[2]
    data = json.load(sys.stdin)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = SimpleDocTemplate(output_path, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=15*mm, bottomMargin=15*mm, title=f"LocalLens {document_type.title()}", author="LocalLens")
    story = dossier_story(data) if document_type == "dossier" else proposal_story(data)
    doc.build(story)
    print(json.dumps({"ok": True, "path": output_path, "pages": doc.page}))

if __name__ == "__main__":
    main()
