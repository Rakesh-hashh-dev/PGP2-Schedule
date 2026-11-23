import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def build_refined_presentation(output_path):
    prs = Presentation()
    # 16:9 widescreen layout: 13.333 x 7.5 inches
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    blank_layout = prs.slide_layouts[6] # Blank slide
    
    # ==================== EXECUTIVE COLOR PALETTE ====================
    C_SLIDE_BG      = RGBColor(248, 250, 252) # Slate 50  (#F8FAFC)
    C_CARD_BG       = RGBColor(255, 255, 255) # Pure White
    C_CARD_INNER_BG = RGBColor(248, 250, 252) # Slate 50
    C_BORDER        = RGBColor(226, 232, 240) # Slate 200 (#E2E8F0)
    C_BORDER_SUBTLE = RGBColor(241, 245, 249) # Slate 100
    
    # Text hierarchy
    C_TEXT_NAVY     = RGBColor(15, 23, 42)    # Slate 900 (#0F172A)
    C_TEXT_BODY     = RGBColor(51, 65, 85)    # Slate 700 (#334155)
    C_TEXT_MUTED    = RGBColor(100, 116, 139) # Slate 500 (#64748B)
    C_TEXT_LIGHT    = RGBColor(148, 163, 184) # Slate 400 (#94A3B8)
    
    # Brand Primary Blue
    C_BLUE          = RGBColor(37, 99, 235)   # Blue 600  (#2563EB)
    C_BLUE_DARK     = RGBColor(29, 78, 216)   # Blue 700  (#1D4ED8)
    C_BLUE_TINT     = RGBColor(239, 246, 255) # Blue 50   (#EFF6FF)
    C_BLUE_BORDER   = RGBColor(191, 219, 254) # Blue 200  (#BFDBFE)
    
    # Emerald / Success
    C_EMERALD       = RGBColor(16, 185, 129)  # Emerald 500 (#10B981)
    C_EMERALD_DARK  = RGBColor(5, 150, 105)   # Emerald 600 (#059669)
    C_EMERALD_TINT  = RGBColor(236, 253, 245) # Emerald 50 (#ECFDF5)
    C_EMERALD_BORDER= RGBColor(167, 243, 208) # Emerald 200 (#A7F3D0)
    
    # Amber / Caution
    C_AMBER         = RGBColor(217, 119, 6)   # Amber 600 (#D97706)
    C_AMBER_TINT    = RGBColor(254, 243, 199) # Amber 100 (#FEF3C7)
    C_AMBER_BORDER  = RGBColor(253, 230, 138) # Amber 200 (#FDE68A)
    
    # Rose / Risk
    C_ROSE          = RGBColor(225, 29, 72)   # Rose 600  (#E11D48)
    C_ROSE_TINT     = RGBColor(255, 241, 242) # Rose 50   (#FFF1F2)
    C_ROSE_BORDER   = RGBColor(254, 205, 211) # Rose 200  (#FECDD3)
    
    FONT_HEAD = "Segoe UI"
    FONT_BODY = "Segoe UI"
    
    # Helper: Set Slide Canvas Background
    def set_canvas_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = C_SLIDE_BG
        bg.line.fill.background()
        return bg

    # Helper: Universal Slide Header with Exact Coordinates & Divider Line
    def add_slide_header(slide, slide_num, category_tag, action_headline, context_subtitle):
        # 1. Category Tracker Pill Tag
        pill = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.80), Inches(0.40), Inches(4.5), Inches(0.24))
        pill.fill.solid()
        pill.fill.fore_color.rgb = C_BLUE_TINT
        pill.line.color.rgb = C_BLUE_BORDER
        pill.line.width = Pt(0.75)
        
        ptf = pill.text_frame
        ptf.word_wrap = False
        ptf.margin_left = Inches(0.10)
        ptf.margin_right = Inches(0.10)
        ptf.margin_top = Inches(0.02)
        ptf.margin_bottom = Inches(0.02)
        pp = ptf.paragraphs[0]
        pp.text = category_tag.upper()
        pp.font.name = FONT_HEAD
        pp.font.size = Pt(8.5)
        pp.font.bold = True
        pp.font.color.rgb = C_BLUE

        # 2. Slide Number Badge on Right of Header
        snum_box = slide.shapes.add_textbox(Inches(11.333), Inches(0.38), Inches(1.2), Inches(0.25))
        stf = snum_box.text_frame
        stf.word_wrap = False
        stf.margin_left = stf.margin_right = stf.margin_top = stf.margin_bottom = 0
        sp = stf.paragraphs[0]
        sp.text = f"SLIDE {slide_num} OF 2"
        sp.font.name = FONT_HEAD
        sp.font.size = Pt(9)
        sp.font.bold = True
        sp.font.color.rgb = C_TEXT_MUTED
        sp.alignment = PP_ALIGN.RIGHT

        # 3. Action Headline (Bold Takeaway)
        hl_box = slide.shapes.add_textbox(Inches(0.80), Inches(0.68), Inches(11.733), Inches(0.46))
        htf = hl_box.text_frame
        htf.word_wrap = True
        htf.margin_left = htf.margin_right = htf.margin_top = htf.margin_bottom = 0
        hp = htf.paragraphs[0]
        hp.text = action_headline
        hp.font.name = FONT_HEAD
        hp.font.size = Pt(18)
        hp.font.bold = True
        hp.font.color.rgb = C_TEXT_NAVY

        # 4. Context Subtitle
        ctx_box = slide.shapes.add_textbox(Inches(0.80), Inches(1.18), Inches(11.733), Inches(0.25))
        ctf = ctx_box.text_frame
        ctf.word_wrap = True
        ctf.margin_left = ctf.margin_right = ctf.margin_top = ctf.margin_bottom = 0
        cp = ctf.paragraphs[0]
        cp.text = context_subtitle
        cp.font.name = FONT_BODY
        cp.font.size = Pt(9.5)
        cp.font.color.rgb = C_TEXT_MUTED

        # 5. Thin Header Rule / Separator
        rule = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.80), Inches(1.48), Inches(11.733), Inches(0.015))
        rule.fill.solid()
        rule.fill.fore_color.rgb = C_BORDER
        rule.line.fill.background()

    # Helper: Universal Slide Footer
    def add_slide_footer(slide):
        # Left: Product & Purpose
        f_left = slide.shapes.add_textbox(Inches(0.80), Inches(7.12), Inches(6.0), Inches(0.25))
        ltf = f_left.text_frame
        ltf.word_wrap = False
        ltf.margin_left = ltf.margin_right = ltf.margin_top = ltf.margin_bottom = 0
        lp = ltf.paragraphs[0]
        lp.text = "TermFlow — Academic Operating System | Case Competition Pitch Deck"
        lp.font.name = FONT_BODY
        lp.font.size = Pt(8.5)
        lp.font.color.rgb = C_TEXT_MUTED

        # Right: Verification & Target
        f_right = slide.shapes.add_textbox(Inches(7.333), Inches(7.12), Inches(5.20), Inches(0.25))
        rtf = f_right.text_frame
        rtf.word_wrap = False
        rtf.margin_left = rtf.margin_right = rtf.margin_top = rtf.margin_bottom = 0
        rp = rtf.paragraphs[0]
        rp.text = "Target Cohort: IIM Sambalpur PGP2 (304 Students) | Confidential"
        rp.font.name = FONT_BODY
        rp.font.size = Pt(8.5)
        rp.font.color.rgb = C_TEXT_MUTED
        rp.alignment = PP_ALIGN.RIGHT

    # Helper: Create an aligned pill badge
    def add_badge(slide, left, top, width, height, text, bg_color, border_color, text_color):
        b = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
        b.fill.solid()
        b.fill.fore_color.rgb = bg_color
        b.line.color.rgb = border_color
        b.line.width = Pt(0.75)
        btf = b.text_frame
        btf.word_wrap = False
        btf.margin_left = btf.margin_right = Inches(0.08)
        btf.margin_top = btf.margin_bottom = Inches(0.01)
        bp = btf.paragraphs[0]
        bp.text = text
        bp.font.name = FONT_HEAD
        bp.font.size = Pt(7.5)
        bp.font.bold = True
        bp.font.color.rgb = text_color
        bp.alignment = PP_ALIGN.CENTER
        return b

    # =========================================================================
    # SLIDE 1: STRATEGIC DIAGNOSIS & PROPOSED SOLUTION
    # =========================================================================
    s1 = prs.slides.add_slide(blank_layout)
    set_canvas_background(s1)
    
    add_slide_header(
        s1,
        slide_num=1,
        category_tag="Case Competition | Strategic Diagnosis & Solution Architecture",
        action_headline="Bridging the Campus Coordination Deficit: Transforming MBA Schedules into an Offline-First OS",
        context_subtitle="Macro Context: Elite 2-year MBA cohort with 30+ electives, dynamic rescheduling, and strict 75-80% attendance compliance."
    )
    add_slide_footer(s1)

    # ---------------- Grid Math for Slide 1 ----------------
    # Margins: Left 0.80", Width 11.733". Two columns of 5.72" with 0.293" gutter.
    col_w = Inches(5.72)
    col_top = Inches(1.62)
    col_h = Inches(5.38) # Ends at 7.00"
    left_col_x = Inches(0.80)
    right_col_x = Inches(6.813)

    # ---------- LEFT COLUMN: PROBLEM STATEMENT (THE AS-IS TRILEMMA) ----------
    # Outer Container Left
    left_box = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_col_x, col_top, col_w, col_h)
    left_box.fill.solid()
    left_box.fill.fore_color.rgb = C_CARD_BG
    left_box.line.color.rgb = C_BORDER
    left_box.line.width = Pt(1)

    # Top Header within Left Container
    lh_box = s1.shapes.add_textbox(left_col_x + Inches(0.25), col_top + Inches(0.18), col_w - Inches(0.50), Inches(0.38))
    ltf = lh_box.text_frame
    ltf.word_wrap = True
    ltf.margin_left = ltf.margin_right = ltf.margin_top = ltf.margin_bottom = 0
    lp1 = ltf.paragraphs[0]
    lp1.text = "THE 'AS-IS' CAMPUS TRILEMMA: HIGH FRICTION & RISK"
    lp1.font.name = FONT_HEAD
    lp1.font.size = Pt(10.5)
    lp1.font.bold = True
    lp1.font.color.rgb = C_ROSE

    lp2 = ltf.add_paragraph()
    lp2.text = "Fragmented channels create cognitive overload and irreversible academic compliance risks."
    lp2.font.name = FONT_BODY
    lp2.font.size = Pt(8.5)
    lp2.font.color.rgb = C_TEXT_MUTED
    lp2.space_before = Pt(1)

    # 3 Problem Cards inside Left Container
    # Available height = 5.38 - 0.70 = 4.68". 3 cards: height = 1.40", gap = 0.14" -> 3*1.40 + 2*0.14 = 4.48".
    p_cards_data = [
        {
            "tag": "1. INFORMATION FRAGMENTATION",
            "tag_bg": C_ROSE_TINT, "tag_border": C_ROSE_BORDER, "tag_color": C_ROSE,
            "title": "Raw Google Sheets & Cluttered WhatsApp Blasts",
            "lead": "Discovery Latency:",
            "body": "Schedules live in multi-tab spreadsheets. Sudden room or slot updates announced across 10+ WhatsApp groups cause students to spend 30–90s per lookup, frequently missing urgent changes."
        },
        {
            "tag": "2. ACADEMIC PENALTY RISK",
            "tag_bg": C_AMBER_TINT, "tag_border": C_AMBER_BORDER, "tag_color": C_AMBER,
            "title": "Strict 75–80% Mandatory Attendance Thresholds",
            "lead": "De-Registration Threat:",
            "body": "Missing just 2–3 classes risks course de-registration or grade drops. Students rely on error-prone mental math, leading to miscalculated absence buffers and severe academic penalties."
        },
        {
            "tag": "3. COORDINATION PARALYSIS",
            "tag_bg": C_BLUE_TINT, "tag_border": C_BLUE_BORDER, "tag_color": C_BLUE,
            "title": "Cross-Elective Peer Scheduling Deadlocks",
            "lead": "Collaboration Drag:",
            "body": "Dispersed elective enrollment makes finding shared free windows for syndicate projects, case competitions, and committee work an iterative 15+ message WhatsApp ordeal."
        }
    ]

    card_start_y = col_top + Inches(0.66)
    card_h = Inches(1.42)
    card_gap = Inches(0.12)

    for i, pc in enumerate(p_cards_data):
        cy = card_start_y + i * (card_h + card_gap)
        c_rect = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_col_x + Inches(0.22), cy, col_w - Inches(0.44), card_h)
        c_rect.fill.solid()
        c_rect.fill.fore_color.rgb = C_CARD_INNER_BG
        c_rect.line.color.rgb = C_BORDER
        c_rect.line.width = Pt(0.75)

        # Left colored accent strip (0.05" wide)
        accent_bar = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_col_x + Inches(0.22), cy, Inches(0.06), card_h)
        accent_bar.fill.solid()
        accent_bar.fill.fore_color.rgb = pc["tag_color"]
        accent_bar.line.fill.background()

        # Badge pill
        add_badge(s1, left_col_x + Inches(0.38), cy + Inches(0.12), Inches(2.2), Inches(0.22), pc["tag"], pc["tag_bg"], pc["tag_border"], pc["tag_color"])

        # Title & Body in aligned text box
        ctb = s1.shapes.add_textbox(left_col_x + Inches(0.38), cy + Inches(0.38), col_w - Inches(0.76), card_h - Inches(0.42))
        ctf = ctb.text_frame
        ctf.word_wrap = True
        ctf.margin_left = ctf.margin_right = ctf.margin_top = ctf.margin_bottom = 0

        tp = ctf.paragraphs[0]
        tp.text = pc["title"]
        tp.font.name = FONT_HEAD
        tp.font.size = Pt(10)
        tp.font.bold = True
        tp.font.color.rgb = C_TEXT_NAVY

        bp = ctf.add_paragraph()
        bp.font.name = FONT_BODY
        bp.font.size = Pt(8.5)
        bp.space_before = Pt(3)
        
        run_lead = bp.add_run()
        run_lead.text = pc["lead"] + " "
        run_lead.font.bold = True
        run_lead.font.color.rgb = C_TEXT_NAVY
        
        run_body = bp.add_run()
        run_body.text = pc["body"]
        run_body.font.color.rgb = C_TEXT_BODY

    # ---------- RIGHT COLUMN: PROPOSED SOLUTION (TERMFLOW OS) ----------
    right_box = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_col_x, col_top, col_w, col_h)
    right_box.fill.solid()
    right_box.fill.fore_color.rgb = C_CARD_BG
    right_box.line.color.rgb = C_BORDER
    right_box.line.width = Pt(1)

    # Top Header within Right Container
    rh_box = s1.shapes.add_textbox(right_col_x + Inches(0.25), col_top + Inches(0.18), col_w - Inches(0.50), Inches(0.38))
    rtf = rh_box.text_frame
    rtf.word_wrap = True
    rtf.margin_left = rtf.margin_right = rtf.margin_top = rtf.margin_bottom = 0
    rp1 = rtf.paragraphs[0]
    rp1.text = "THE 'TO-BE' TRANSFORMATION: TERMFLOW ACADEMIC OS"
    rp1.font.name = FONT_HEAD
    rp1.font.size = Pt(10.5)
    rp1.font.bold = True
    rp1.font.color.rgb = C_BLUE

    rp2 = rtf.add_paragraph()
    rp2.text = "A purpose-built Progressive Web App unifying scheduling, attendance, and peer networks."
    rp2.font.name = FONT_BODY
    rp2.font.size = Pt(8.5)
    rp2.font.color.rgb = C_TEXT_MUTED
    rp2.space_before = Pt(1)

    # Core Value Banner in Right Column
    banner_y = col_top + Inches(0.66)
    banner_h = Inches(0.72)
    b_shape = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_col_x + Inches(0.22), banner_y, col_w - Inches(0.44), banner_h)
    b_shape.fill.solid()
    b_shape.fill.fore_color.rgb = C_BLUE_TINT
    b_shape.line.color.rgb = C_BLUE_BORDER
    b_shape.line.width = Pt(0.75)

    # Blue accent bar on banner
    b_accent = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_col_x + Inches(0.22), banner_y, Inches(0.06), banner_h)
    b_accent.fill.solid()
    b_accent.fill.fore_color.rgb = C_BLUE
    b_accent.line.fill.background()

    btb = s1.shapes.add_textbox(right_col_x + Inches(0.38), banner_y + Inches(0.08), col_w - Inches(0.76), banner_h - Inches(0.16))
    btf = btb.text_frame
    btf.word_wrap = True
    btf.margin_left = btf.margin_right = btf.margin_top = btf.margin_bottom = 0
    
    bp0 = btf.paragraphs[0]
    bp0.text = "CORE PRODUCT CONCEPT: Turnkey Academic Operating System"
    bp0.font.name = FONT_HEAD
    bp0.font.size = Pt(9)
    bp0.font.bold = True
    bp0.font.color.rgb = C_BLUE_DARK

    bp1 = btf.add_paragraph()
    bp1.text = "Integrates automated Google Sheets timetable diffing, predictive attendance margin calculation, and privacy-preserving peer schedule overlays into an installable mobile PWA."
    bp1.font.name = FONT_BODY
    bp1.font.size = Pt(8.2)
    bp1.font.color.rgb = C_TEXT_BODY
    bp1.space_before = Pt(2)

    # 3 Strategic Moats
    sol_moats_data = [
        {
            "tag": "MOAT 1: ZERO ADMIN DISRUPTION",
            "tag_bg": C_BLUE_TINT, "tag_border": C_BLUE_BORDER, "tag_color": C_BLUE,
            "title": "Transparent Google Sheets Synchronization",
            "lead": "Zero Change Resistance:",
            "desc": "Academic offices continue publishing via existing Google Sheets. Apps Script & Supabase Edge functions poll, compute SHA-256 diffs, and push updates without requiring administrative re-training."
        },
        {
            "tag": "MOAT 2: OFFLINE-FIRST RESILIENCE",
            "tag_bg": C_EMERALD_TINT, "tag_border": C_EMERALD_BORDER, "tag_color": C_EMERALD,
            "title": "Sub-500ms Instant Boot Snapshot Engine",
            "lead": "Basement-Ready Access:",
            "desc": "Pre-bundled build snapshots and Workbox service workers ensure 100% schedule availability in low-connectivity lecture hall basements. Live sync updates silently when reconnected."
        },
        {
            "tag": "MOAT 3: ENTERPRISE TRUST & ZERO FRICTION",
            "tag_bg": C_AMBER_TINT, "tag_border": C_AMBER_BORDER, "tag_color": C_AMBER,
            "title": "Frictionless PWA + Domain-Gated Google Auth",
            "lead": "Closed Campus Security:",
            "desc": "Authentication strictly gated to @iimsambalpur.ac.in via Clerk SSO. One-tap home screen install avoids app store friction; Row-Level Security (RLS) guarantees complete peer data privacy."
        }
    ]

    sol_start_y = banner_y + banner_h + Inches(0.12)
    sol_card_h = Inches(1.18)
    sol_card_gap = Inches(0.11)

    for i, sm in enumerate(sol_moats_data):
        sy = sol_start_y + i * (sol_card_h + sol_card_gap)
        s_rect = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_col_x + Inches(0.22), sy, col_w - Inches(0.44), sol_card_h)
        s_rect.fill.solid()
        s_rect.fill.fore_color.rgb = C_CARD_INNER_BG
        s_rect.line.color.rgb = C_BORDER
        s_rect.line.width = Pt(0.75)

        # Left accent strip
        accent_s = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_col_x + Inches(0.22), sy, Inches(0.06), sol_card_h)
        accent_s.fill.solid()
        accent_s.fill.fore_color.rgb = sm["tag_color"]
        accent_s.line.fill.background()

        # Badge pill
        add_badge(s1, right_col_x + Inches(0.38), sy + Inches(0.10), Inches(2.2), Inches(0.21), sm["tag"], sm["tag_bg"], sm["tag_border"], sm["tag_color"])

        # Content box
        stb = s1.shapes.add_textbox(right_col_x + Inches(0.38), sy + Inches(0.34), col_w - Inches(0.76), sol_card_h - Inches(0.38))
        stf = stb.text_frame
        stf.word_wrap = True
        stf.margin_left = stf.margin_right = stf.margin_top = stf.margin_bottom = 0

        sp0 = stf.paragraphs[0]
        sp0.text = sm["title"]
        sp0.font.name = FONT_HEAD
        sp0.font.size = Pt(9.8)
        sp0.font.bold = True
        sp0.font.color.rgb = C_TEXT_NAVY

        sp1 = stf.add_paragraph()
        sp1.font.name = FONT_BODY
        sp1.font.size = Pt(8.2)
        sp1.space_before = Pt(2)
        
        run_slead = sp1.add_run()
        run_slead.text = sm["lead"] + " "
        run_slead.font.bold = True
        run_slead.font.color.rgb = C_TEXT_NAVY
        
        run_sbody = sp1.add_run()
        run_sbody.text = sm["desc"]
        run_sbody.font.color.rgb = C_TEXT_BODY

    # =========================================================================
    # SLIDE 2: PRODUCT CAPABILITIES, ROI & MARKET TRACTION
    # =========================================================================
    s2 = prs.slides.add_slide(blank_layout)
    set_canvas_background(s2)

    add_slide_header(
        s2,
        slide_num=2,
        category_tag="Case Competition | Key Features, Value Proposition & Market Traction",
        action_headline="Delivering Fail-Safe Academic Governance: Validated by 68% Organic Cohort Adoption",
        context_subtitle="Demonstrated Impact: Replacing ad-hoc tools with high-frequency engagement (5.2 days/week) and near-zero marginal operational cost."
    )
    add_slide_footer(s2)

    # ---------------- TOP HALF: 4 KEY FEATURE PILLARS ----------------
    # 4 columns: total width = 11.733". Width each = 2.78", 3 gaps = 0.204".
    feat_top = Inches(1.62)
    feat_h = Inches(2.36)
    feat_w = Inches(2.78)
    feat_gap = Inches(0.204)
    feat_start_x = Inches(0.80)

    feature_pillars = [
        {
            "tag": "CORE TIMETABLE",
            "tag_bg": C_BLUE_TINT, "tag_border": C_BLUE_BORDER, "tag_color": C_BLUE,
            "title": "Dynamic Schedule & Live Diff Engine",
            "items": [
                ("Live Timeline & Agenda:", "Daily course views with elective filtering & day-mapping."),
                ("SHA-256 Hash Diffing:", "Instant alerts on unexpected venue or timing swaps."),
                ("Sub-2ms ICS Export:", "Native calendar sync with Apple, Google & Outlook.")
            ]
        },
        {
            "tag": "RISK MITIGATION",
            "tag_bg": C_EMERALD_TINT, "tag_border": C_EMERALD_BORDER, "tag_color": C_EMERALD,
            "title": "Predictive Attendance Guardian",
            "items": [
                ("1-Tap Quick Mark:", "End-of-class prompt logging to eliminate memory bias."),
                ("Safe-Skip Buffer:", "Dynamic calculator prevents falling below 75-80% rules."),
                ("Recovery Modeling:", "Simulates mandatory attendance streaks to restore compliance.")
            ]
        },
        {
            "tag": "PEER WORKFLOWS",
            "tag_bg": C_AMBER_TINT, "tag_border": C_AMBER_BORDER, "tag_color": C_AMBER,
            "title": "Social Timetable Sync & Overlays",
            "items": [
                ("6-Char Share Codes:", "Privacy-preserving token to overlay peer schedules."),
                ("Mutual Slot Finder:", "Instantly identifies shared free time for group projects."),
                ("Realtime Classmate Pings:", "Live study group coordination powered by Supabase.")
            ]
        },
        {
            "tag": "INSTITUTIONAL OPS",
            "tag_bg": C_BLUE_TINT, "tag_border": C_BLUE_BORDER, "tag_color": C_BLUE_DARK,
            "title": "Admin & Telemetry Hub",
            "items": [
                ("Cohort Presence:", "Tracks daily & weekly active profiles across 90-day windows."),
                ("Emergency Broadcasts:", "Targeted Web Push alerts reaching students in seconds."),
                ("Operations Diagnostics:", "Audit history, feedback triage, and 7 health self-checks.")
            ]
        }
    ]

    for i, fp in enumerate(feature_pillars):
        fx = feat_start_x + i * (feat_w + feat_gap)
        
        # Outer Card
        fc = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, feat_top, feat_w, feat_h)
        fc.fill.solid()
        fc.fill.fore_color.rgb = C_CARD_BG
        fc.line.color.rgb = C_BORDER
        fc.line.width = Pt(1)

        # Top accent bar on card
        top_bar = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, feat_top, feat_w, Inches(0.05))
        top_bar.fill.solid()
        top_bar.fill.fore_color.rgb = fp["tag_color"]
        top_bar.line.fill.background()

        # Badge pill
        add_badge(s2, fx + Inches(0.16), feat_top + Inches(0.12), Inches(1.5), Inches(0.20), fp["tag"], fp["tag_bg"], fp["tag_border"], fp["tag_color"])

        # Title
        ftb = s2.shapes.add_textbox(fx + Inches(0.16), feat_top + Inches(0.36), feat_w - Inches(0.32), Inches(0.42))
        ftf = ftb.text_frame
        ftf.word_wrap = True
        ftf.margin_left = ftf.margin_right = ftf.margin_top = ftf.margin_bottom = 0
        ftp = ftf.paragraphs[0]
        ftp.text = fp["title"]
        ftp.font.name = FONT_HEAD
        ftp.font.size = Pt(9.8)
        ftp.font.bold = True
        ftp.font.color.rgb = C_TEXT_NAVY

        # Items
        itb = s2.shapes.add_textbox(fx + Inches(0.16), feat_top + Inches(0.80), feat_w - Inches(0.32), feat_h - Inches(0.86))
        itf = itb.text_frame
        itf.word_wrap = True
        itf.margin_left = itf.margin_right = itf.margin_top = itf.margin_bottom = 0

        for j, (lead, body) in enumerate(fp["items"]):
            p = itf.paragraphs[0] if j == 0 else itf.add_paragraph()
            p.font.name = FONT_BODY
            p.font.size = Pt(8.0)
            if j > 0:
                p.space_before = Pt(4)
            
            r_bullet = p.add_run()
            r_bullet.text = "• "
            r_bullet.font.bold = True
            r_bullet.font.color.rgb = fp["tag_color"]

            r_lead = p.add_run()
            r_lead.text = lead + " "
            r_lead.font.bold = True
            r_lead.font.color.rgb = C_TEXT_NAVY

            r_body = p.add_run()
            r_body.text = body
            r_body.font.color.rgb = C_TEXT_BODY

    # ---------------- BOTTOM HALF: VALUE PROP & EMPIRICAL TRACTION ----------------
    bot_top = Inches(4.14)
    bot_h = Inches(2.86) # Ends at 7.00"
    bot_w = Inches(5.72) # Exact same width as Slide 1 columns!
    bot_left_x = Inches(0.80)
    bot_right_x = Inches(6.813)

    # ---------- BOTTOM LEFT: STAKEHOLDER VALUE PROPOSITION & ROI ----------
    vp_card = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bot_left_x, bot_top, bot_w, bot_h)
    vp_card.fill.solid()
    vp_card.fill.fore_color.rgb = C_CARD_BG
    vp_card.line.color.rgb = C_BORDER
    vp_card.line.width = Pt(1)

    vph_box = s2.shapes.add_textbox(bot_left_x + Inches(0.25), bot_top + Inches(0.16), bot_w - Inches(0.50), Inches(0.32))
    vptf = vph_box.text_frame
    vptf.word_wrap = True
    vptf.margin_left = vptf.margin_right = vptf.margin_top = vptf.margin_bottom = 0
    vp_p = vptf.paragraphs[0]
    vp_p.text = "STAKEHOLDER VALUE PROPOSITION & ROI"
    vp_p.font.name = FONT_HEAD
    vp_p.font.size = Pt(10.5)
    vp_p.font.bold = True
    vp_p.font.color.rgb = C_BLUE

    # 2 Nested Sub-Cards inside Bottom Left (Students & Administration)
    # Student Sub-Card
    s_sub_y = bot_top + Inches(0.52)
    s_sub_h = Inches(1.18)
    s_sub = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bot_left_x + Inches(0.22), s_sub_y, bot_w - Inches(0.44), s_sub_h)
    s_sub.fill.solid()
    s_sub.fill.fore_color.rgb = C_CARD_INNER_BG
    s_sub.line.color.rgb = C_BORDER
    s_sub.line.width = Pt(0.75)

    s_tb = s2.shapes.add_textbox(bot_left_x + Inches(0.36), s_sub_y + Inches(0.08), bot_w - Inches(0.72), s_sub_h - Inches(0.16))
    stf = s_tb.text_frame
    stf.word_wrap = True
    stf.margin_left = stf.margin_right = stf.margin_top = stf.margin_bottom = 0

    sp_title = stf.paragraphs[0]
    sp_title.text = "FOR STUDENTS (END USERS)"
    sp_title.font.name = FONT_HEAD
    sp_title.font.size = Pt(8.8)
    sp_title.font.bold = True
    sp_title.font.color.rgb = C_TEXT_NAVY

    student_points = [
        ("Risk Elimination:", "Automated attendance buffers remove the risk of inadvertent course de-registration."),
        ("Time Reclaimed:", "Centralized lookup and peer sync saves 2.7 to 8.1 hours weekly across active student groups."),
        ("Zero Friction:", "Instant PWA install without app store gating; reliable offline access during transit.")
    ]
    for k, (lead, body) in enumerate(student_points):
        p = stf.add_paragraph()
        p.font.name = FONT_BODY
        p.font.size = Pt(8.0)
        p.space_before = Pt(2)
        
        r_chk = p.add_run()
        r_chk.text = "✓ "
        r_chk.font.bold = True
        r_chk.font.color.rgb = C_EMERALD_DARK

        r_lead = p.add_run()
        r_lead.text = lead + " "
        r_lead.font.bold = True
        r_lead.font.color.rgb = C_TEXT_NAVY

        r_body = p.add_run()
        r_body.text = body
        r_body.font.color.rgb = C_TEXT_BODY

    # Administration Sub-Card
    a_sub_y = s_sub_y + s_sub_h + Inches(0.10)
    a_sub_h = Inches(0.92)
    a_sub = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bot_left_x + Inches(0.22), a_sub_y, bot_w - Inches(0.44), a_sub_h)
    a_sub.fill.solid()
    a_sub.fill.fore_color.rgb = C_CARD_INNER_BG
    a_sub.line.color.rgb = C_BORDER
    a_sub.line.width = Pt(0.75)

    a_tb = s2.shapes.add_textbox(bot_left_x + Inches(0.36), a_sub_y + Inches(0.08), bot_w - Inches(0.72), a_sub_h - Inches(0.16))
    atf = a_tb.text_frame
    atf.word_wrap = True
    atf.margin_left = atf.margin_right = atf.margin_top = atf.margin_bottom = 0

    ap_title = atf.paragraphs[0]
    ap_title.text = "FOR PROGRAM OFFICES & BATCH REPRESENTATIVES"
    ap_title.font.name = FONT_HEAD
    ap_title.font.size = Pt(8.8)
    ap_title.font.bold = True
    ap_title.font.color.rgb = C_TEXT_NAVY

    admin_points = [
        ("Zero Workflow Disruption:", "Maintains existing Google Sheets; zero manual data re-entry required."),
        ("Direct Broadcast Pipeline:", "Emergency push notifications bypass noisy WhatsApp group chats.")
    ]
    for k, (lead, body) in enumerate(admin_points):
        p = atf.add_paragraph()
        p.font.name = FONT_BODY
        p.font.size = Pt(8.0)
        p.space_before = Pt(2)
        
        r_chk = p.add_run()
        r_chk.text = "✓ "
        r_chk.font.bold = True
        r_chk.font.color.rgb = C_BLUE

        r_lead = p.add_run()
        r_lead.text = lead + " "
        r_lead.font.bold = True
        r_lead.font.color.rgb = C_TEXT_NAVY

        r_body = p.add_run()
        r_body.text = body
        r_body.font.color.rgb = C_TEXT_BODY

    # ---------- BOTTOM RIGHT: EMPIRICAL TRACTION & OPERATIONAL RIGOR ----------
    tr_card = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bot_right_x, bot_top, bot_w, bot_h)
    tr_card.fill.solid()
    tr_card.fill.fore_color.rgb = C_CARD_BG
    tr_card.line.color.rgb = C_BORDER
    tr_card.line.width = Pt(1)

    trh_box = s2.shapes.add_textbox(bot_right_x + Inches(0.25), bot_top + Inches(0.16), bot_w - Inches(0.50), Inches(0.32))
    trtf = trh_box.text_frame
    trtf.word_wrap = True
    trtf.margin_left = trtf.margin_right = trtf.margin_top = trtf.margin_bottom = 0
    tr_p = trtf.paragraphs[0]
    tr_p.text = "EMPIRICAL TRACTION & OPERATIONAL RIGOR"
    tr_p.font.name = FONT_HEAD
    tr_p.font.size = Pt(10.5)
    tr_p.font.bold = True
    tr_p.font.color.rgb = C_EMERALD_DARK

    # 3 Centered & Symmetrical KPI Cards
    # Available width inside container = 5.72 - 0.44 = 5.28". 3 cards: width = 1.68", 2 gaps = 0.12" -> 3*1.68 + 2*0.12 = 5.28" EXACT!
    kpi_y = bot_top + Inches(0.52)
    kpi_h = Inches(1.18)
    kpi_w = Inches(1.68)
    kpi_gap = Inches(0.12)
    kpi_start_x = bot_right_x + Inches(0.22)

    kpi_data = [
        {
            "num": "67.8%",
            "label": "COHORT ADOPTION",
            "body": "206 of 304 students registered organically; 100% course setup completion."
        },
        {
            "num": "5.2 Days",
            "label": "WEEKLY STICKINESS",
            "body": "Average active days per weekly active profile (449 user-days/week peak)."
        },
        {
            "num": "437 Tests",
            "label": "ENGINEERING RIGOR",
            "body": "100% pass rate across 42 suites; 10 Supabase serverless Edge Functions."
        }
    ]

    for i, kd in enumerate(kpi_data):
        kx = kpi_start_x + i * (kpi_w + kpi_gap)
        kb = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, kx, kpi_y, kpi_w, kpi_h)
        kb.fill.solid()
        kb.fill.fore_color.rgb = C_CARD_INNER_BG
        kb.line.color.rgb = C_BORDER
        kb.line.width = Pt(0.75)

        ktb = s2.shapes.add_textbox(kx + Inches(0.08), kpi_y + Inches(0.08), kpi_w - Inches(0.16), kpi_h - Inches(0.16))
        ktf = ktb.text_frame
        ktf.word_wrap = True
        ktf.margin_left = ktf.margin_right = ktf.margin_top = ktf.margin_bottom = 0

        # Number
        kp0 = ktf.paragraphs[0]
        kp0.text = kd["num"]
        kp0.font.name = FONT_HEAD
        kp0.font.size = Pt(17)
        kp0.font.bold = True
        kp0.font.color.rgb = C_BLUE
        kp0.alignment = PP_ALIGN.CENTER

        # Label
        kp1 = ktf.add_paragraph()
        kp1.text = kd["label"]
        kp1.font.name = FONT_HEAD
        kp1.font.size = Pt(7.0)
        kp1.font.bold = True
        kp1.font.color.rgb = C_TEXT_MUTED
        kp1.alignment = PP_ALIGN.CENTER
        kp1.space_before = Pt(1)
        kp1.space_after = Pt(2)

        # Body
        kp2 = ktf.add_paragraph()
        kp2.text = kd["body"]
        kp2.font.name = FONT_BODY
        kp2.font.size = Pt(7.2)
        kp2.font.color.rgb = C_TEXT_BODY
        kp2.alignment = PP_ALIGN.CENTER

    # Bottom Scalability & Economics Card
    scale_y = kpi_y + kpi_h + Inches(0.10)
    scale_h = Inches(0.92)
    sc_box = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bot_right_x + Inches(0.22), scale_y, bot_w - Inches(0.44), scale_h)
    sc_box.fill.solid()
    sc_box.fill.fore_color.rgb = C_EMERALD_TINT
    sc_box.line.color.rgb = C_EMERALD_BORDER
    sc_box.line.width = Pt(0.75)

    # Accent bar on left of scalability card
    sc_accent = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, bot_right_x + Inches(0.22), scale_y, Inches(0.06), scale_h)
    sc_accent.fill.solid()
    sc_accent.fill.fore_color.rgb = C_EMERALD
    sc_accent.line.fill.background()

    sctb = s2.shapes.add_textbox(bot_right_x + Inches(0.36), scale_y + Inches(0.08), bot_w - Inches(0.72), scale_h - Inches(0.16))
    sctf = sctb.text_frame
    sctf.word_wrap = True
    sctf.margin_left = sctf.margin_right = sctf.margin_top = sctf.margin_bottom = 0

    scp0 = sctf.paragraphs[0]
    scp0.text = "UNIT ECONOMICS & HORIZONTAL SCALABILITY"
    scp0.font.name = FONT_HEAD
    scp0.font.size = Pt(8.8)
    scp0.font.bold = True
    scp0.font.color.rgb = C_EMERALD_DARK

    scale_points = [
        ("Near-₹0 Marginal Cost:", "Built on serverless Edge workers (Vercel & Supabase); near-zero cloud expenses."),
        ("Turnkey Portability:", "Plug-and-play architecture readily deployable to PGP1, executive cohorts, and sister IIMs/IITs.")
    ]
    for k, (lead, body) in enumerate(scale_points):
        p = sctf.add_paragraph()
        p.font.name = FONT_BODY
        p.font.size = Pt(8.0)
        p.space_before = Pt(2)
        
        r_bullet = p.add_run()
        r_bullet.text = "• "
        r_bullet.font.bold = True
        r_bullet.font.color.rgb = C_EMERALD_DARK

        r_lead = p.add_run()
        r_lead.text = lead + " "
        r_lead.font.bold = True
        r_lead.font.color.rgb = C_TEXT_NAVY

        r_body = p.add_run()
        r_body.text = body
        r_body.font.color.rgb = C_TEXT_BODY

    # Save presentation
    prs.save(output_path)
    print(f"Refined presentation successfully generated: {output_path}")

if __name__ == "__main__":
    out_dir = r"f:\Web Dev\Antigravity\PGP2 Schedule"
    target_path = os.path.join(out_dir, "TermFlow_Case_Competition_Presentation.pptx")
    build_refined_presentation(target_path)
