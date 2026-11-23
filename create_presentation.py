import os
import sys
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

def build_presentation(output_path):
    prs = Presentation()
    # 16:9 widescreen
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    blank_slide_layout = prs.slide_layouts[6] # Blank
    
    # ----------------- DESIGN SYSTEM & COLOR PALETTE -----------------
    C_BG = RGBColor(248, 250, 252)          # Slate 50 (#F8FAFC)
    C_WHITE = RGBColor(255, 255, 255)       # Pure White
    C_NAVY_DEEP = RGBColor(15, 23, 42)      # Slate 900 (#0F172A)
    C_NAVY_CARD = RGBColor(30, 41, 59)      # Slate 800 (#1E293B)
    C_TEXT_DARK = RGBColor(30, 41, 59)      # Slate 800
    C_TEXT_MUTED = RGBColor(100, 116, 139)  # Slate 500 (#64748B)
    C_TEXT_LIGHT = RGBColor(241, 245, 249)  # Slate 100
    
    C_BLUE_PRIMARY = RGBColor(37, 99, 235)  # Blue 600 (#2563EB)
    C_BLUE_DARK = RGBColor(29, 78, 216)     # Blue 700 (#1D4ED8)
    C_BLUE_TINT = RGBColor(239, 246, 255)   # Blue 50 (#EFF6FF)
    C_BLUE_BORDER = RGBColor(191, 219, 254) # Blue 200 (#BFDBFE)
    
    C_CARD_BORDER = RGBColor(226, 232, 240) # Slate 200 (#E2E8F0)
    C_AMBER = RGBColor(217, 119, 6)         # Amber 600 (#D97706)
    C_AMBER_TINT = RGBColor(254, 243, 199)  # Amber 100 (#FEF3C7)
    C_RED = RGBColor(225, 29, 72)           # Rose 600 (#E11D48)
    C_RED_TINT = RGBColor(255, 241, 242)    # Rose 50 (#FFF1F2)
    C_GREEN = RGBColor(16, 185, 129)        # Emerald 500 (#10B981)
    C_GREEN_TINT = RGBColor(236, 253, 245)  # Emerald 50 (#ECFDF5)
    
    FONT_FAMILY = "Segoe UI"
    
    def set_slide_background(slide):
        bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, Inches(13.333), Inches(7.5))
        bg.fill.solid()
        bg.fill.fore_color.rgb = C_BG
        bg.line.fill.background() # No border
        return bg

    def add_header(slide, tracker_text, headline_text, context_text):
        # Tracker / Category Tag
        tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(0.3))
        tf_tag = tag_box.text_frame
        tf_tag.word_wrap = True
        tf_tag.margin_left = tf_tag.margin_top = tf_tag.margin_right = tf_tag.margin_bottom = 0
        p_tag = tf_tag.paragraphs[0]
        p_tag.text = tracker_text.upper()
        p_tag.font.name = FONT_FAMILY
        p_tag.font.size = Pt(10)
        p_tag.font.bold = True
        p_tag.font.color.rgb = C_BLUE_PRIMARY

        # Action Headline
        hl_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.68), Inches(11.733), Inches(0.55))
        tf_hl = hl_box.text_frame
        tf_hl.word_wrap = True
        tf_hl.margin_left = tf_hl.margin_top = tf_hl.margin_right = tf_hl.margin_bottom = 0
        p_hl = tf_hl.paragraphs[0]
        p_hl.text = headline_text
        p_hl.font.name = FONT_FAMILY
        p_hl.font.size = Pt(19)
        p_hl.font.bold = True
        p_hl.font.color.rgb = C_NAVY_DEEP

        # Sub-lead / Context
        ctx_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.22), Inches(11.733), Inches(0.32))
        tf_ctx = ctx_box.text_frame
        tf_ctx.word_wrap = True
        tf_ctx.margin_left = tf_ctx.margin_top = tf_ctx.margin_right = tf_ctx.margin_bottom = 0
        p_ctx = tf_ctx.paragraphs[0]
        p_ctx.text = context_text
        p_ctx.font.name = FONT_FAMILY
        p_ctx.font.size = Pt(10.5)
        p_ctx.font.color.rgb = C_TEXT_MUTED

    # =========================================================================
    # SLIDE 1: STRATEGIC DIAGNOSIS & SOLUTION ARCHITECTURE
    # =========================================================================
    slide1 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(slide1)
    
    add_header(
        slide1,
        tracker_text="CASE COMPETITION PITCH | STRATEGIC PROBLEM & SOLUTION ARCHITECTURE",
        headline_text="Bridging the Campus Coordination Deficit: Transforming Fragmented MBA Schedules into an Offline-First OS",
        context_text="Target: 304-Student Cohort at IIM Sambalpur | Environment: 30+ electives, dynamic rescheduling, and zero-tolerance 75-80% attendance thresholds."
    )

    # ---------------- LEFT COLUMN: PROBLEM STATEMENT (THE AS-IS TRILEMMA) ----------------
    col_width = Inches(5.72)
    col_top = Inches(1.62)
    col_height = Inches(5.42)
    left_x = Inches(0.8)

    # Outer Container Left
    left_bg = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_x, col_top, col_width, col_height)
    left_bg.fill.solid()
    left_bg.fill.fore_color.rgb = C_WHITE
    left_bg.line.color.rgb = C_CARD_BORDER
    left_bg.line.width = Pt(1)

    # Left Container Title Banner
    left_title_box = slide1.shapes.add_textbox(left_x + Inches(0.28), col_top + Inches(0.22), col_width - Inches(0.56), Inches(0.35))
    tf_lt = left_title_box.text_frame
    tf_lt.word_wrap = True
    tf_lt.margin_left = tf_lt.margin_top = tf_lt.margin_right = tf_lt.margin_bottom = 0
    p_lt = tf_lt.paragraphs[0]
    p_lt.text = "THE 'AS-IS' CAMPUS TRILEMMA: HIGH FRICTION & COMPLIANCE ANXIETY"
    p_lt.font.name = FONT_FAMILY
    p_lt.font.size = Pt(11)
    p_lt.font.bold = True
    p_lt.font.color.rgb = C_RED

    # 3 Problem Cards
    problem_cards = [
        {
            "tag": "1. INFORMATION FRAGMENTATION",
            "tag_color": C_RED,
            "title": "Raw Spreadsheets & Cluttered WhatsApp Channels",
            "impact": "Timetables live in multi-tab Google Sheets with sudden venue changes pushed via message blasts. Students spend 30-90s per lookup, frequently missing urgent changes when walking between halls."
        },
        {
            "tag": "2. SEVERE ACADEMIC RISK",
            "tag_color": C_AMBER,
            "title": "Strict 75-80% Mandatory Attendance Policies",
            "impact": "Missing just 2-3 classes can cause grade penalties or course de-registration. Relying on paper or mental math causes critical miscalculations with irreversible academic consequences."
        },
        {
            "tag": "3. COORDINATION PARALYSIS",
            "tag_color": C_BLUE_PRIMARY,
            "title": "Cross-Elective Peer Scheduling Deadlocks",
            "impact": "With highly varied elective combinations across sections, organizing syndicate meetings, case competition teams, and club events requires 15+ messages to find a single free slot."
        }
    ]

    card_y = col_top + Inches(0.68)
    card_h = Inches(1.42)
    card_gap = Inches(0.14)

    for i, pc in enumerate(problem_cards):
        cy = card_y + i * (card_h + card_gap)
        c_shape = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left_x + Inches(0.25), cy, col_width - Inches(0.5), card_h)
        c_shape.fill.solid()
        c_shape.fill.fore_color.rgb = C_BG
        c_shape.line.color.rgb = C_CARD_BORDER
        c_shape.line.width = Pt(0.75)

        tb = slide1.shapes.add_textbox(left_x + Inches(0.4), cy + Inches(0.12), col_width - Inches(0.8), card_h - Inches(0.24))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        # Tag
        p0 = tf.paragraphs[0]
        p0.text = pc["tag"]
        p0.font.name = FONT_FAMILY
        p0.font.size = Pt(9)
        p0.font.bold = True
        p0.font.color.rgb = pc["tag_color"]

        # Title
        p1 = tf.add_paragraph()
        p1.text = pc["title"]
        p1.font.name = FONT_FAMILY
        p1.font.size = Pt(11)
        p1.font.bold = True
        p1.font.color.rgb = C_NAVY_DEEP
        p1.space_before = Pt(2)
        p1.space_after = Pt(2)

        # Impact
        p2 = tf.add_paragraph()
        p2.text = pc["impact"]
        p2.font.name = FONT_FAMILY
        p2.font.size = Pt(9.5)
        p2.font.color.rgb = C_TEXT_DARK

    # ---------------- RIGHT COLUMN: PROPOSED SOLUTION (TERMFLOW OPERATING SYSTEM) ----------------
    right_x = Inches(6.81)

    # Outer Container Right
    right_bg = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_x, col_top, col_width, col_height)
    right_bg.fill.solid()
    right_bg.fill.fore_color.rgb = C_WHITE
    right_bg.line.color.rgb = C_CARD_BORDER
    right_bg.line.width = Pt(1)

    # Right Container Title Banner
    right_title_box = slide1.shapes.add_textbox(right_x + Inches(0.28), col_top + Inches(0.22), col_width - Inches(0.56), Inches(0.35))
    tf_rt = right_title_box.text_frame
    tf_rt.word_wrap = True
    tf_rt.margin_left = tf_rt.margin_top = tf_rt.margin_right = tf_rt.margin_bottom = 0
    p_rt = tf_rt.paragraphs[0]
    p_rt.text = "THE 'TO-BE' TRANSFORMATION: TERMFLOW ACADEMIC OPERATING SYSTEM"
    p_rt.font.name = FONT_FAMILY
    p_rt.font.size = Pt(11)
    p_rt.font.bold = True
    p_rt.font.color.rgb = C_BLUE_PRIMARY

    # Overview Highlight Banner inside Right Column
    banner_y = col_top + Inches(0.68)
    banner_h = Inches(0.72)
    b_shape = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_x + Inches(0.25), banner_y, col_width - Inches(0.5), banner_h)
    b_shape.fill.solid()
    b_shape.fill.fore_color.rgb = C_BLUE_TINT
    b_shape.line.color.rgb = C_BLUE_BORDER
    b_shape.line.width = Pt(1)

    b_tb = slide1.shapes.add_textbox(right_x + Inches(0.4), banner_y + Inches(0.1), col_width - Inches(0.8), banner_h - Inches(0.2))
    b_tf = b_tb.text_frame
    b_tf.word_wrap = True
    b_tf.margin_left = b_tf.margin_top = b_tf.margin_right = b_tf.margin_bottom = 0
    bp0 = b_tf.paragraphs[0]
    bp0.text = "CORE PRODUCT CONCEPT: Turnkey PWA for B-School Students"
    bp0.font.name = FONT_FAMILY
    bp0.font.size = Pt(9.5)
    bp0.font.bold = True
    bp0.font.color.rgb = C_BLUE_PRIMARY
    bp1 = b_tf.add_paragraph()
    bp1.text = "An installable, offline-first progressive web application integrating automated timetable sync, predictive attendance risk calculation, and real-time social peer overlays."
    bp1.font.name = FONT_FAMILY
    bp1.font.size = Pt(9)
    bp1.font.color.rgb = C_NAVY_DEEP

    # 3 Architecture & Operational Moats
    sol_cards = [
        {
            "tag": "MOAT 1: ZERO ADMIN DISRUPTION",
            "tag_color": C_BLUE_PRIMARY,
            "title": "Transparent Google Sheets Integration",
            "desc": "The program office continues publishing via standard Sheets. Apps Script & Supabase Edge Workers poll, hash (SHA-256), and ingest updates automatically. Zero administrative learning curve."
        },
        {
            "tag": "MOAT 2: 100% OFFLINE RESILIENCE",
            "tag_color": C_GREEN,
            "title": "Sub-500ms Instant Boot Snapshot Engine",
            "desc": "Bundled schedule snapshots and Workbox service-worker caching provide instant launch times even in cellular dead zones. Live diffs update transparently in the background when connected."
        },
        {
            "tag": "MOAT 3: INSTITUTIONAL TRUST & ZERO FRICTION",
            "tag_color": C_AMBER,
            "title": "Frictionless PWA + Domain-Gated Auth",
            "desc": "Institutional Google SSO (@iimsambalpur.ac.in) via Clerk; 1-click home screen install bypasses App Store gatekeepers; Row-Level Security (RLS) protects peer sharing data."
        }
    ]

    sol_card_y = banner_y + banner_h + Inches(0.12)
    sol_card_h = Inches(1.15)
    sol_card_gap = Inches(0.11)

    for i, sc in enumerate(sol_cards):
        cy = sol_card_y + i * (sol_card_h + sol_card_gap)
        sc_shape = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, right_x + Inches(0.25), cy, col_width - Inches(0.5), sol_card_h)
        sc_shape.fill.solid()
        sc_shape.fill.fore_color.rgb = C_BG
        sc_shape.line.color.rgb = C_CARD_BORDER
        sc_shape.line.width = Pt(0.75)

        tb = slide1.shapes.add_textbox(right_x + Inches(0.4), cy + Inches(0.1), col_width - Inches(0.8), sol_card_h - Inches(0.2))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        p0 = tf.paragraphs[0]
        p0.text = sc["tag"]
        p0.font.name = FONT_FAMILY
        p0.font.size = Pt(8.5)
        p0.font.bold = True
        p0.font.color.rgb = sc["tag_color"]

        p1 = tf.add_paragraph()
        p1.text = sc["title"]
        p1.font.name = FONT_FAMILY
        p1.font.size = Pt(10.5)
        p1.font.bold = True
        p1.font.color.rgb = C_NAVY_DEEP
        p1.space_before = Pt(1)
        p1.space_after = Pt(2)

        p2 = tf.add_paragraph()
        p2.text = sc["desc"]
        p2.font.name = FONT_FAMILY
        p2.font.size = Pt(9)
        p2.font.color.rgb = C_TEXT_DARK

    # =========================================================================
    # SLIDE 2: PRODUCT CAPABILITIES, VALUE PROPOSITION & TRACTION
    # =========================================================================
    slide2 = prs.slides.add_slide(blank_slide_layout)
    set_slide_background(slide2)

    add_header(
        slide2,
        tracker_text="CASE COMPETITION PITCH | PRODUCT CAPABILITIES, ROI & MARKET TRACTION",
        headline_text="Delivering Fail-Safe Academic Governance: Validated by 68% Organic Batch Adoption",
        context_text="Proven Product-Market Fit: Replacing fragmented ad-hoc tools with high-frequency engagement and near-zero marginal operational cost."
    )

    # ---------------- TOP HALF: 4 FEATURE PILLARS ----------------
    feat_y = Inches(1.62)
    feat_h = Inches(2.32)
    feat_w = Inches(2.78)
    feat_gap = Inches(0.2)
    feat_start_x = Inches(0.8)

    features = [
        {
            "badge": "CORE TIMETABLE",
            "badge_color": C_BLUE_PRIMARY,
            "badge_bg": C_BLUE_TINT,
            "title": "Dynamic Schedule & Live Diff Engine",
            "bullets": [
                "Timeline & Week views with course filtering and day mapping.",
                "Automated SHA-256 hash diffing alerts students to venue/time changes.",
                "Client-side ICS export generated in <2ms for native Apple/Google Cal."
            ]
        },
        {
            "badge": "RISK MITIGATION",
            "badge_color": C_GREEN,
            "badge_bg": C_GREEN_TINT,
            "title": "Predictive Attendance Guardian",
            "bullets": [
                "1-tap post-class attendance mark with end-of-class prompts.",
                "Dynamic Safe-Skip Buffer prevents falling below 75-80% thresholds.",
                "Forward-looking recovery calculator models required attendance streaks."
            ]
        },
        {
            "badge": "PEER WORKFLOWS",
            "badge_color": C_AMBER,
            "badge_bg": C_AMBER_TINT,
            "title": "Social Timetable Sync & Overlays",
            "bullets": [
                "Privacy-preserving 6-character share codes for mutual schedule views.",
                "Side-by-side overlay reveals mutual free slots for case comps & syndicates.",
                "Realtime study group formation and live classmate pinging."
            ]
        },
        {
            "badge": "INSTITUTIONAL OPS",
            "badge_color": C_NAVY_DEEP,
            "badge_bg": C_BLUE_TINT,
            "title": "Admin & Telemetry Command Center",
            "bullets": [
                "Real-time cohort presence analytics (daily & weekly active profiles).",
                "Targeted Web Push broadcasts for urgent administration notices.",
                "In-app issue triage, moderation logs, and course coverage telemetry."
            ]
        }
    ]

    for i, ft in enumerate(features):
        fx = feat_start_x + i * (feat_w + feat_gap)
        f_shape = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, fx, feat_y, feat_w, feat_h)
        f_shape.fill.solid()
        f_shape.fill.fore_color.rgb = C_WHITE
        f_shape.line.color.rgb = C_CARD_BORDER
        f_shape.line.width = Pt(1)

        tb = slide2.shapes.add_textbox(fx + Inches(0.16), feat_y + Inches(0.14), feat_w - Inches(0.32), feat_h - Inches(0.28))
        tf = tb.text_frame
        tf.word_wrap = True
        tf.margin_left = tf.margin_top = tf.margin_right = tf.margin_bottom = 0

        # Badge
        p0 = tf.paragraphs[0]
        p0.text = ft["badge"]
        p0.font.name = FONT_FAMILY
        p0.font.size = Pt(8.5)
        p0.font.bold = True
        p0.font.color.rgb = ft["badge_color"]

        # Title
        p1 = tf.add_paragraph()
        p1.text = ft["title"]
        p1.font.name = FONT_FAMILY
        p1.font.size = Pt(10.5)
        p1.font.bold = True
        p1.font.color.rgb = C_NAVY_DEEP
        p1.space_before = Pt(2)
        p1.space_after = Pt(4)

        # Bullets
        for b in ft["bullets"]:
            pb = tf.add_paragraph()
            pb.text = "• " + b
            pb.font.name = FONT_FAMILY
            pb.font.size = Pt(8.8)
            pb.font.color.rgb = C_TEXT_DARK
            pb.space_after = Pt(2)

    # ---------------- BOTTOM HALF: VALUE PROP & TRACTION ----------------
    bot_y = Inches(4.1)
    bot_h = Inches(2.95)

    # Bottom Left: Stakeholder Value Proposition (Width: 5.75 in)
    vp_w = Inches(5.72)
    vp_x = Inches(0.8)

    vp_shape = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, vp_x, bot_y, vp_w, bot_h)
    vp_shape.fill.solid()
    vp_shape.fill.fore_color.rgb = C_WHITE
    vp_shape.line.color.rgb = C_CARD_BORDER
    vp_shape.line.width = Pt(1)

    vp_tb = slide2.shapes.add_textbox(vp_x + Inches(0.25), bot_y + Inches(0.18), vp_w - Inches(0.5), bot_h - Inches(0.36))
    vp_tf = vp_tb.text_frame
    vp_tf.word_wrap = True
    vp_tf.margin_left = vp_tf.margin_top = vp_tf.margin_right = vp_tf.margin_bottom = 0

    vp_title = vp_tf.paragraphs[0]
    vp_title.text = "STAKEHOLDER VALUE PROPOSITION & ROI"
    vp_title.font.name = FONT_FAMILY
    vp_title.font.size = Pt(11)
    vp_title.font.bold = True
    vp_title.font.color.rgb = C_BLUE_PRIMARY

    # Student Value Block
    vp_s_h = vp_tf.add_paragraph()
    vp_s_h.text = "FOR STUDENTS (The End Users)"
    vp_s_h.font.name = FONT_FAMILY
    vp_s_h.font.size = Pt(9.5)
    vp_s_h.font.bold = True
    vp_s_h.font.color.rgb = C_NAVY_DEEP
    vp_s_h.space_before = Pt(4)

    s_points = [
        "Elimination of Academic Penalty Risk: Mathematical precision on attendance buffers removes de-registration anxiety.",
        "Measurable Time Savings: Centralized lookup & peer sync saves 2.7 to 8.1 hours weekly across active student groups.",
        "Zero-Friction Access: PWA installs without app stores; 100% offline access when rushing between class venues."
    ]
    for pt in s_points:
        p = vp_tf.add_paragraph()
        p.text = "✓ " + pt
        p.font.name = FONT_FAMILY
        p.font.size = Pt(8.8)
        p.font.color.rgb = C_TEXT_DARK
        p.space_after = Pt(2)

    # Admin Value Block
    vp_a_h = vp_tf.add_paragraph()
    vp_a_h.text = "FOR PROGRAM OFFICES & BATCH REPRESENTATIVES"
    vp_a_h.font.name = FONT_FAMILY
    vp_a_h.font.size = Pt(9.5)
    vp_a_h.font.bold = True
    vp_a_h.font.color.rgb = C_NAVY_DEEP
    vp_a_h.space_before = Pt(4)

    a_points = [
        "Zero Workflow Disruption: Faculty & office maintain existing Google Sheets; zero data re-entry or new systems to learn.",
        "Direct Notification Pipeline: High-priority broadcast push alerts bypass noisy WhatsApp group chats."
    ]
    for pt in a_points:
        p = vp_tf.add_paragraph()
        p.text = "✓ " + pt
        p.font.name = FONT_FAMILY
        p.font.size = Pt(8.8)
        p.font.color.rgb = C_TEXT_DARK
        p.space_after = Pt(2)

    # Bottom Right: Validated Traction & Scalability (Width: 5.75 in)
    tr_w = Inches(5.72)
    tr_x = Inches(6.81)

    tr_shape = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, tr_x, bot_y, tr_w, bot_h)
    tr_shape.fill.solid()
    tr_shape.fill.fore_color.rgb = C_WHITE
    tr_shape.line.color.rgb = C_CARD_BORDER
    tr_shape.line.width = Pt(1)

    tr_tb = slide2.shapes.add_textbox(tr_x + Inches(0.25), bot_y + Inches(0.18), tr_w - Inches(0.5), bot_h - Inches(0.36))
    tr_tf = tr_tb.text_frame
    tr_tf.word_wrap = True
    tr_tf.margin_left = tr_tf.margin_top = tr_tf.margin_right = tr_tf.margin_bottom = 0

    tr_title = tr_tf.paragraphs[0]
    tr_title.text = "EMPIRICAL TRACTION & OPERATIONAL RIGOR"
    tr_title.font.name = FONT_FAMILY
    tr_title.font.size = Pt(11)
    tr_title.font.bold = True
    tr_title.font.color.rgb = C_GREEN

    # 3 Stat Cards Row
    stat_y = bot_y + Inches(0.5)
    stat_h = Inches(1.1)
    stat_w = Inches(1.65)
    stat_gap = Inches(0.12)
    stat_start_x = tr_x + Inches(0.25)

    stats = [
        {
            "val": "67.8%",
            "label": "COHORT PENETRATION",
            "desc": "206 of 304 students enrolled organically; 100% setup completion."
        },
        {
            "val": "5.2 Days",
            "label": "REPEAT ENGAGEMENT",
            "desc": "Average active days per weekly active profile; 449 user-days/wk."
        },
        {
            "val": "437 Tests",
            "label": "ENTERPRISE RIGOR",
            "desc": "100% automated pass rate across 42 suites; 10 serverless Edge Functions."
        }
    ]

    for i, st in enumerate(stats):
        sx = stat_start_x + i * (stat_w + stat_gap)
        s_box = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, sx, stat_y, stat_w, stat_h)
        s_box.fill.solid()
        s_box.fill.fore_color.rgb = C_BG
        s_box.line.color.rgb = C_CARD_BORDER
        s_box.line.width = Pt(0.75)

        stb = slide2.shapes.add_textbox(sx + Inches(0.08), stat_y + Inches(0.08), stat_w - Inches(0.16), stat_h - Inches(0.16))
        stf = stb.text_frame
        stf.word_wrap = True
        stf.margin_left = stf.margin_top = stf.margin_right = stf.margin_bottom = 0

        # Number
        sp0 = stf.paragraphs[0]
        sp0.text = st["val"]
        sp0.font.name = FONT_FAMILY
        sp0.font.size = Pt(17)
        sp0.font.bold = True
        sp0.font.color.rgb = C_BLUE_PRIMARY
        sp0.alignment = PP_ALIGN.CENTER

        # Label
        sp1 = stf.add_paragraph()
        sp1.text = st["label"]
        sp1.font.name = FONT_FAMILY
        sp1.font.size = Pt(7.5)
        sp1.font.bold = True
        sp1.font.color.rgb = C_TEXT_MUTED
        sp1.alignment = PP_ALIGN.CENTER
        sp1.space_before = Pt(1)
        sp1.space_after = Pt(2)

        # Desc
        sp2 = stf.add_paragraph()
        sp2.text = st["desc"]
        sp2.font.name = FONT_FAMILY
        sp2.font.size = Pt(7.5)
        sp2.font.color.rgb = C_TEXT_DARK
        sp2.alignment = PP_ALIGN.CENTER

    # Bottom Callout: Scalability & Economics
    callout_y = stat_y + stat_h + Inches(0.14)
    callout_h = Inches(1.05)
    c_box = slide2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, tr_x + Inches(0.25), callout_y, tr_w - Inches(0.5), callout_h)
    c_box.fill.solid()
    c_box.fill.fore_color.rgb = C_GREEN_TINT
    c_box.line.color.rgb = RGBColor(167, 243, 208)
    c_box.line.width = Pt(1)

    ctb = slide2.shapes.add_textbox(tr_x + Inches(0.4), callout_y + Inches(0.1), tr_w - Inches(0.8), callout_h - Inches(0.2))
    ctf = ctb.text_frame
    ctf.word_wrap = True
    ctf.margin_left = ctf.margin_top = ctf.margin_right = ctf.margin_bottom = 0

    cp0 = ctf.paragraphs[0]
    cp0.text = "UNIT ECONOMICS & HORIZONTAL SCALABILITY"
    cp0.font.name = FONT_FAMILY
    cp0.font.size = Pt(9.5)
    cp0.font.bold = True
    cp0.font.color.rgb = C_GREEN

    cp1 = ctf.add_paragraph()
    cp1.text = "• Marginal Infrastructure Cost: Near-₹0 / month using serverless Edge workers and managed tier backend."
    cp1.font.name = FONT_FAMILY
    cp1.font.size = Pt(8.5)
    cp1.font.color.rgb = C_NAVY_DEEP
    cp1.space_before = Pt(2)

    cp2 = ctf.add_paragraph()
    cp2.text = "• Expansion Vector: Instantly portable across junior MBA cohorts (PGP1), executive batches, and sister institutions (IIMs/IITs) with zero codebase redesign."
    cp2.font.name = FONT_FAMILY
    cp2.font.size = Pt(8.5)
    cp2.font.color.rgb = C_NAVY_DEEP
    cp2.space_before = Pt(1)

    # Save presentation
    prs.save(output_path)
    print(f"Presentation saved successfully to: {output_path}")

if __name__ == "__main__":
    out_dir = r"f:\Web Dev\Antigravity\PGP2 Schedule"
    target_path = os.path.join(out_dir, "TermFlow_Case_Competition_Presentation.pptx")
    build_presentation(target_path)
