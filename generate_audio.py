"""
Generate TermFlow promo voiceover as MP3 segments using Google Text-to-Speech.
Each segment corresponds to one scene in the promo video.
"""
from gtts import gTTS
import os

OUT_DIR = r"f:\Web Dev\Antigravity\PGP2 Schedule\promo_audio"
os.makedirs(OUT_DIR, exist_ok=True)

# Full narration script — one line per scene
LINES = [
    # Scene 1: Brand Intro (5s)
    "Welcome to TermFlow — the Academic Operating System built exclusively for IIM Sambalpur's PGP2 batch.",

    # Scene 2: Problem (7s)
    "MBA life is demanding. But your tools are still WhatsApp threads and scattered spreadsheets. Sound familiar?",

    # Scene 3: Solution Device Reveal (9s)
    "TermFlow changes everything. Your live timetable, real-time attendance guardian, and instant push alerts — all in your pocket. Even in the basement.",

    # Scene 4: Feature Grid (9s)
    "Four powerful features, one seamless app. Dynamic schedule diffing, attendance protection, peer schedule overlays, and a fully offline-first Progressive Web App.",

    # Scene 5: Social Timetable (8s)
    "Share your unique 6-character code. Instantly see when you and your classmates are both free — no messages, no back-and-forth. Just one tap.",

    # Scene 6: Stats / Traction (9s)
    "Sixty-eight percent of the entire PGP2 cohort adopted TermFlow — organically, with zero marketing spend. Five point two active days every week. And it runs on near-zero infrastructure cost.",

    # Scene 7: CTA Outro (7s)
    "TermFlow. Your schedule, your attendance, your cohort — always with you, wherever you are. Visit P G P 2 dot TermFlow dot tech.",
]

# Generate per-scene audio
for i, line in enumerate(LINES, start=1):
    tts = gTTS(text=line, lang='en', tld='co.in', slow=False)
    path = os.path.join(OUT_DIR, f"scene_{i:02d}.mp3")
    tts.save(path)
    print(f"[OK] Scene {i} → {path}")

# Also generate a single combined full narration
full_script = " ... ".join(LINES)
tts_full = gTTS(text=full_script, lang='en', tld='co.in', slow=False)
full_path = os.path.join(OUT_DIR, "termflow_promo_voiceover_FULL.mp3")
tts_full.save(full_path)
print(f"\n[OK] Full combined voiceover → {full_path}")
print("\nAll audio files generated successfully.")
print(f"Output folder: {OUT_DIR}")
