# Demo video — desktop shot list (record as separate asset clips, edit together)

**Target:** under 3:00 (aim 2:40) · **Track:** MemoryAgent · **Voice:** Thai VO, **burned-in English subtitles** · **Live URL shown:** https://cm.viibe.to
**Recording mode:** desktop, **maximized browser window with the address bar visible** (so `cm.viibe.to` shows — that IS the deployment proof). NOT mobile, NOT kiosk full-screen. Record each clip separately; assemble in the edit.

## Pre-flight (once, before recording)
- [ ] Flush DNS so cm.viibe.to resolves on this Mac: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`. Confirm https://cm.viibe.to loads with a valid lock.
- [ ] Chrome, maximized window (address bar visible), zoom ~110–125% so text reads on camera. Close other tabs/notifications.
- [ ] Theme: **light (beige)** reads cleanest for judges + subtitles. (Optionally grab one dark-mode beauty shot for B-roll.)
- [ ] Do NOT wipe the brain — the live server already has ambient weather memories (gives 🟢 Live + 🔵 Plan badges). We create the 🟣 Memory live in Clip 1.
- [ ] Second setup for the eval clip: a terminal with `cd engine && npm run eval` ready to run (big font), and the README `## Evaluation` section open in a tab.
- [ ] Architecture diagram open (README mermaid renders on the GitHub page) for the closing beat.

## Shot list — 8 asset clips

**Clip 1 — Seed a memory (create the preference). ~15s**
- Do: type `จำไว้นะ เราชอบกาแฟออกนม ร้อนๆ ไม่หวานมาก` → send → เชียงใหม่ acknowledges.
- **Wait for the tick**: watch the 🧠 *consolidating memory…* chip finish (or open 🧠 pane and see the episodic count tick up) so the memory is actually stored + embedded before Clip 2.
- VO: "ผมบอกเชียงใหม่ว่าเราชอบกาแฟแบบไหน" · Sub: *"I tell เชียงใหม่ a preference — how I like my coffee."*

**Clip 2 — New-session recall (THE HOOK). ~15s**
- Do: **reload the page** (new session) → type `จำได้ไหมว่าเราชอบกาแฟแบบไหน` → it recalls oat-milk, no history resent.
- VO: "เปิดใหม่ ข้าม session มันจำได้เลย ไม่ต้องส่งประวัติทั้งหมดกลับเข้าไป" · Sub: *"New session — it already remembers. No full history resent."*

**Clip 3 — "Why this answer" (THE KILLER). ~22s**
- Do: open 🧠 pane (top-right). Slow-scroll the **✨ Why this answer** view: the line *"The engine selected N of M context items … before the model generated this reply"*, then **USED context** (🟣 Memory: coffee preference · 🟢 Live: weather) vs **Available, not used**.
- VO: "เอนจินไม่ได้แค่จำ มันประกอบบริบทจากหลายแหล่ง — ความจำ, สัญญาณสด, แผน — แล้วเลือกเฉพาะที่เกี่ยวข้องส่งให้โมเดล" · Sub: *"Not just memory — it composes context from memory, live signals and plans, and feeds the model only what's relevant."*

**Clip 4 — Lifecycle in motion. ~12s**
- Do: send one more message; capture the chip **🔍 recalling… → 🧠 consolidating memory…** and the reply streaming in.
- VO: "ทุกเทิร์นเห็นเลยว่ามันกำลังนึก แล้วตกตะกอนความจำ" · Sub: *"Every turn: it recalls, then consolidates memory."*

**Clip 5 — The small working set. ~12s** *(optional, strengthens the token story)*
- Do: 🧠 pane → open **Advanced** → **Injection Tap**, type a query → show the small `formatInjection` block that actually reaches the model (not the whole log).
- VO: "โมเดลเห็นแค่ชุดเล็กๆ ที่คัดมา ไม่ใช่ประวัติทั้งหมด" · Sub: *"The model sees only a small selected set — not the whole log."*

**Clip 6 — เชียงใหม่ senses the real world. ~12s**
- Do: reload once to trigger the ambient greet (or scroll to a greeting) where she mentions the real live weather/air (San Sai / Doi Saket).
- VO: "และเชียงใหม่รับรู้โลกจริง — อากาศ ฝุ่น ตอนนี้ — เป็นตัวตนที่มีความจำ ไม่ใช่แค่เดโม" · Sub: *"And เชียงใหม่ senses the real world — live weather and air. A living proof, not a demo."*

**Clip 7 — Evaluation (measured, not asserted). ~15s**
- Do: in the terminal run `npm run eval` (or scroll the README table). Rest on the row **H3: 1 critical fact out of 31 · ~23 vs ~428 tokens**; note **H2** honestly retrieves both prefs (a real finding).
- VO: "วัดจริงเทียบ baseline ที่ส่งประวัติทั้งหมด — ดึงข้อมูลสำคัญ 1 จาก 31 ด้วยโทเคนเศษเสี้ยว และรายงานตามจริงแม้จุดที่ยังไม่สมบูรณ์" · Sub: *"Measured vs a full-history baseline — one critical fact of 31 at a fraction of the tokens. Reported honestly."*

**Clip 8 — Deployed on Alibaba Cloud (proof + close). ~14s**
- Do: linger on the address bar **https://cm.viibe.to** (lock visible); optional cut to the Qwen Cloud console usage dashboard and the architecture diagram; end on the repo.
- VO: "ทั้งหมดรันจริงบน Alibaba Cloud — เปิดใช้ได้เลยที่ cm.viibe.to โค้ดโอเพนซอร์ส Apache-2.0" · Sub: *"Running live on Alibaba Cloud at cm.viibe.to. Open source, Apache-2.0. — Living Memory Engine."*

**Optional tail (only if under 2:50):** cut network / world-feed → she honestly says her senses are degraded (interoception). Different thesis; include only if time.

## Edit assembly
- Order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8** (memory-first; the hook is cross-session recall, not weather).
- Trim Qwen latency/wait between action and reply — cut to the reply appearing.
- **Burn subtitles into the picture** (bottom third, high-contrast box) — do not rely on YouTube CC; judges must read the mechanism in real time. `subtitles.srt` in this folder is the starting text; re-time to your cuts.
- Keep total **< 3:00 (aim 2:40)**; 1080p; soft ambient music low under the VO.
- Upload to YouTube (unlisted is fine); paste the link into Devpost.
