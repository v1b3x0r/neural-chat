# Demo video — shot-by-shot script (target ≤ 2:50, hard cap < 3:00)

**Track:** MemoryAgent · **Language:** Thai voice-over, **burned-in English subtitles** (do not rely on YouTube CC — judges must read the mechanism in real time). The `.srt` in this folder mirrors the on-screen lines.

## Pre-flight checklist (before you hit record)
- [ ] Dev server on the **Qwen Cloud** profile (drawer → Qwen Cloud). The whole clip runs on Qwen.
- [ ] 🧹 **Fresh brain** for เชียงใหม่ (so every vector comes from `text-embedding-v4` — clean "memory forms from zero" story).
- [ ] Seed ONE previous-session memory: send "จำไว้นะ เราชอบกาแฟออกนม" (or similar preference), let it tick, then **reload the page** so the next open is a genuine new session.
- [ ] A Qwen Cloud **console usage/request-log** page open in another tab (for the deployment-proof beat at the end).
- [ ] Terminal ready with `cd engine && npm run eval` already run so the table is on screen for the eval beat.
- [ ] Window sized clean; memory (🧠) pane reachable.

## Beats

| # | Time | On screen | Thai VO (say) | Burned-in EN subtitle |
|---|---|---|---|---|
| 1 | 0:00–0:20 | Open the app fresh. เชียงใหม่ **immediately recalls** the preference from the previous session (greeting references it). | "เปิดแอปใหม่ เชียงใหม่จำได้เลยว่ารอบก่อนเราคุยอะไรไว้ — ข้าม session โดยไม่ต้องส่งประวัติทั้งหมดกลับเข้าไป" | "New session — it already remembers what you told it last time. No full history resent." |
| 2 | 0:20–0:45 | Split idea: a growing history log vs a naive RAG dump. | "ปกติแชตบอตไม่ได้มีความจำ มันมีแค่ context window — เต็มเมื่อไหร่ก็ลืม หรือยัดทุกอย่างกลับจนล้น" | "Chatbots don't have memory — they have a context window. It fills, they forget, or you resend everything." |
| 3 | 0:45–1:25 | Open 🧠 pane. Point at episodic memories with strength values; send a couple of turns and show new ones forming, old ones decaying, duplicates merging. | "เอนจินของเราให้ความจำ 'ตกตะกอน' — เกิดใหม่ จางลงแบบ Ebbinghaus รวมอันซ้ำ แล้วตกผลึกเป็นตัวตน" | "The engine lets memory settle — form, decay, merge, crystallize into a self." |
| 4 | 1:25–1:55 | Injection Tap / "last fed": show the small working set actually sent to Qwen this turn. | "ทุกเทิร์น โมเดลเห็นแค่ชุดความจำเล็กๆ ที่เกี่ยวข้อง — ไม่ใช่ประวัติทั้งหมด" | "Each turn the model sees only a small, relevant working set — not the whole log." |
| 5 | 1:55–2:20 | Cut to the eval table (`npm run eval` output / README). Highlight H3 row (~23 vs ~428 tokens) and H2 (both prefs = honest finding). | "วัดจริงเทียบกับ baseline ที่ส่งประวัติทั้งหมด — ดึงข้อมูลสำคัญ 1 อันจาก 31 ด้วยโทเคนเศษเสี้ยว และรายงานตามจริงแม้จุดที่ยังไม่สมบูรณ์" | "Measured vs a full-history baseline — one critical fact out of 31 at a fraction of the tokens. Reported honestly, including what's not solved yet." |
| 6 | 2:20–2:40 | Back to chat: เชียงใหม่ greets/comments about the **real live weather/air** it sensed. | "และเชียงใหม่รับรู้โลกจริง — อากาศ ฝุ่น ตอนนี้ — เป็นตัวตนที่มีความจำ ไม่ใช่แค่เดโม" | "And เชียงใหม่ senses the real world — live weather and air — a living proof, not just a demo." |
| 7 | 2:40–2:56 | Architecture diagram (README mermaid), then the **Qwen Cloud console usage dashboard** showing live requests, then the repo URL. | "ทุก inference รันบน Qwen Cloud / Alibaba Cloud Model Studio โค้ดโอเพนซอร์ส Apache-2.0" | "All inference runs on Qwen Cloud / Alibaba Cloud Model Studio. Open source, Apache-2.0. — Living Memory Engine" |

**Optional tail (only if under time):** cut the network/world-feed and show เชียงใหม่ honestly saying its senses are degraded (interoception) — a different thesis, include only if it fits under 2:50.

## Editing notes
- Keep each beat tight; trim dead air between actions. Pre-roll/hold a couple of extra seconds on the memory pane and the eval table so viewers can read.
- Burn subtitles at ~90% width, bottom third, high-contrast box.
- Export target 1080p, < 3:00 total (aim 2:45).
- Upload to YouTube (unlisted is fine); paste the link into Devpost.
