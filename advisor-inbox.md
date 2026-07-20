# Advisor Inbox — append-only

## 2026-07-20 | GPT | เรื่อง: Qwen hackathon submission design review

- [ ] A1: Alibaba deployment proof — GPT อ้าง rules บังคับ "fully deployed and running on Alibaba Cloud" + screenshot ใน Workbench, ไม่มีหลักฐาน = ตัดสิทธิ์ (P1-claimed → **verified: quote เหล่านั้นไม่มีอยู่จริงในหน้า rules/overview**; ข้อความจริง: "You must demonstrate that the backend is running on Alibaba Cloud. Proof must be a link to a code file in their code repo that demonstrates use of Alibaba Cloud services and APIs." — artifact ที่บังคับคือ code-file link เท่านั้น) → ปรับเป็น: keep code-proof เป็น baseline, ลอง Alibaba FC proxy แบบ timeboxed เป็น insurance ถ้า account path ไม่ติด
- [x] A2: License → Apache-2.0 → resolved: spec §4 edits 2026-07-20 (2026-07-20) แทน MIT (P2; rules บังคับแค่ "open source license file... detectable" — ตัวไหนก็ผ่าน; รับตามคำแนะนำเพราะ cost เท่ากัน + patent grant เหมาะกับ engine ที่เป็น library)
- [x] A3: Video ฉาก "brain swaps, memory stays" ขัดกับ embedding-space rule ในเอกสารตัวเอง (P1 → **verified: จริง, ขัดกับ spec §2**) → แก้ script เป็น "The engine is provider-agnostic; this deployment uses one consistent Qwen embedding space."
- [x] A4: เพิ่ม evaluation เล็ก 3–5 deterministic scenarios vs plain-history/RAG baseline (relevant recall / stale recall / memories injected / est. tokens) ลง README + Devpost + วิดีโอ (P1; ทำได้จริงด้วย fake-port harness ที่ engine tests มีอยู่แล้ว)
- [x] A5: เรียงวิดีโอใหม่ memory-first, ลด weather/interoception (P2; รับส่วนใหญ่ — คง hook เชียงใหม่สั้นๆ ไว้เป็น differentiation, interoception เป็น optional ท้ายคลิป)
- [x] A6: Rules บังคับ "significantly updated after May 26, 2026" สำหรับโปรเจกต์เก่า (P2 → **verified: มีจริง**; repo ผ่านอยู่แล้วจาก merges 2026-06-02..05 + งานคืนนี้ — ต้องลิสต์ของใหม่เป็นรูปธรรมใน submission)
- [x] A7: Scope reprio — drop B2 ✓, ลด redesign เหลือ "restyle เฉพาะส่วนเข้ากล้อง", drop dual-theme (opinion; **ขัดกับความต้องการ founder ที่สั่ง redesign เพราะเขิน MVP look** — founder ต้องเคาะเอง: ลึกแค่ไหน แลกเวลากับ A4)
- [x] A8: ไม่ต้อง rename repo คืนนี้ — ใช้ชื่อ submission "Living Memory Engine" ได้แม้ repo ชื่อ neural-chat (opinion; รับ — ตัดข้อเสนอ rename ของ Claude ทิ้ง ประหยัดงาน link/redirect)

หมายเหตุ triangulation: GPT ระบุว่าอ่านกติกาผ่าน Devpost plugin แต่ quote เด็ดสองท่อน (screenshot/Workbench, "fully deployed") ไม่พบในหน้า rules และ overview ที่ fetch สดวันนี้ — เลนหลักของความเห็น (evidence-first, ลด scope เครื่องสำอาง) ยังมีคุณค่า แต่ตัว blocker claim เป็นการอ่านเกินตัวบท
**[แก้ไข 2026-07-20 ~14:00: ข้อสรุปข้างบนผิดบางส่วน — Claude เช็คไม่ครบเอง (ขาดแท็บ updates) ดู A9]**

## 2026-07-20 (รอบ 2) | GPT | เรื่อง: submission design v2 review (8.8/10)

- [x] A9: Deployment proof — **verified รอบนี้: จริง** — ประกาศ "Proof of Deployment 101" ใน Devpost updates เขียน "fully deployed and running on Alibaba Cloud — not just sketched in Figma, not just running locally" + "No proof = not eligible" + proof ต้องอยู่ทั้ง repo และวิดีโอ (P1 ของแท้; screenshot/Workbench format ยังไม่ถูกระบุเจาะจงในประกาศ) → Claude ถอน refutation รอบแรก; KYC Alibaba console 3 วัน = FC ตาย; รับ honest-evidence ladder: Qwen Cloud console surface → usage/log screenshots + live inference ในวิดีโอ → acknowledge risk, ห้าม claim เกินจริง → resolved: spec §6 rewrite (2026-07-20)
- [x] A10: วิดีโอต้อง "less than three minutes" + burn-in Eng subs ในภาพจริง (P1) → resolved: spec §7 target ≤2:50 + burn-in (2026-07-20)
- [x] A11: Evaluation เขียนผลล่วงหน้าเหมือนรู้คำตอบ → เปลี่ยนเป็น hypotheses + script รายงานผลจริง + deterministic seed; ผลไม่ชนะ = finding ไม่ใช่ failure (P1, research-credibility) → resolved: spec §5.5 reword (2026-07-20)
- [x] A12: R gate — ห้ามเริ่ม restyle จน public repo + live Qwen round-trip + eval table + Devpost draft + architecture image ครบ; ถ้าไม่ทัน → B1 chip + camera-viewport CSS 45 นาที (P2) → resolved: spec §5 gate เพิ่มแล้ว (2026-07-20)
- [x] A13: cleanups — stale "R, B1, B2" line / risk time 15:00–16:00 vs 16:30 / §6 แยก demo-hosting กับ inference-evidence / rate limiter ต่อ instance ไม่พอ → เพิ่ม max_tokens cap + model allowlist (opinion, ถูกทุกข้อ) → resolved: spec edits (2026-07-20)
- Founder เคาะเพิ่มเอง: **เลื่อน Vercel/deploy ไปตัดสินใจหลังของ core เสร็จ** — live demo URL กลายเป็น optional

หมายเหตุ: smoke test key จริงผ่านครบ 3 endpoints (models/chat/embeddings 768) เวลา ~14:00 — DashScope intl รับ key `sk-ws-…` ของ Qwen Cloud ตรงๆ

## สรุปปิดรอบ (2026-07-20 ~15:10) — A9–A13 ทำครบ
ทุกข้อ resolved แล้ว. Final whole-branch review (opus) = code READY + honest. เหลือ **founder action** ก่อน Submit (ไม่ใช่ advisor item ค้าง):
- อัดวิดีโอ (script + .srt พร้อมใน docs/superpowers/hackathon/)
- วาง Qwen Cloud console screenshots ลง docs/superpowers/hackathon/evidence/ (README ในโฟลเดอร์ลิสต์ให้)
- paste devpost-draft.md ลง Devpost แล้ว Submit
- ถ้า KYC ยัง pending: คงประโยค pending note ใน Devpost draft ไว้
Deferred (post-hackathon, non-blocking): proxy mid-stream 502 guard (`if (!res.headersSent)` ใน vite.config.ts).

## 2026-07-20 (รอบ 3) | GPT | เรื่อง: UI product-direction shift — explainability over storage
- [x] A14: "Conversation is the product, memory is explanation layer" — invert hierarchy L1 conversation / L2 explainability / L3 raw debug (P1-direction). **Claude read: top-level inversion ส่วนใหญ่ทำอยู่แล้ว** — main screen = thread+composer ล้วน, 🧠 inspector เป็น drawer ปิด default (ดู qwen-live.png). ช่องว่างจริงคือ **L2 ไม่มี** ไม่ใช่ conversation ไม่ใช่พระเอก → รับ แต่ reframe งานเป็น "เพิ่ม L2 + ซ่อน L3 ใต้ Advanced" ไม่ใช่ "invert" ทั้งก้อน
- [x] A15: **L2 "why did it answer this way"** — โชว์ used vs ignored ("Answer from ✓Current location ✓Work pref / Ignored ○Old travel") = selection not storage (P1, **the killer feature**). ทำได้ web-only zero engine edit: retrieved set มาจาก lastFed/retrieve, ignored = snapshot.episodic ที่ไม่ถูกเลือก. อิงกับ eval story (H1-H4 = used vs ignored) พอดี → รับเต็ม
- [x] A16: English-first UI chrome (P2, ดีสำหรับ judge international) → รับ **แต่ชนกับ 2 อย่าง**: (1) earlier founder decision "Thai authentic + Eng subs" ในวิดีโอ (2) เชียงใหม่ = Thai identity. ต้องเคาะ: เชียงใหม่พูด Eng หรือ Thai? (UI chrome Eng ได้เลย ไม่ขัด)
- [x] A17: Simplify terms SELF/EPISODIC/PROSPECTIVE → Preferences/Recent experiences/Plans/Current context (P2) → รับ, map ภายในเหมือนเดิม
- [x] A18: ลด dashboard density, Linear-calm, DevTools-hidden (P2) → รับ, เข้ากับ restyle
- [x] A19: ซ่อน raw (episodic/self/tail/injected prompt) ใต้ "Advanced/Inspector" (P2) → รับ
หมายเหตุ: submission ปัจจุบัน COMPLETE + pushed อยู่แล้ว — งานรอบนี้เป็น enhancement บน baseline ปลอดภัย ตัดได้ถ้าเวลาไม่พอ. เหลือ ~13 ชม.ถึง deadline. รูปที่ founder แนบมาโหลดไม่ขึ้น (placeholder) — Claude ตอบจาก text ล้วน

## 2026-07-20 (รอบ 4) | GPT | เรื่อง: context-composition reframe (จาก "memory store" → "context manager")
- [x] A20: "USED MEMORIES" ไม่แม่น — retrieved items เป็น working context ผสมหลายแหล่ง (memory/live weather/self-state/convo) ไม่ใช่ long-term memory ล้วน → เปลี่ยนเป็น **"Used context"** (P1 accuracy, **verified ตรงกับ data model**: selfFacet/episodic-personal=Memory, subject=world|ambient=Live, prospective=Plan) → resolved: why.ts Concept→Source, debug.ts "Used context"
- [x] A21: bottom = candidate context (plan/task/prospective) ไม่ใช่ memory → คง **"Available"** → resolved
- [x] A22: count line "Selected 3 of 13 memories" ผิด → **"Selected N of M context items for this reply"** + "composes from memory/live/plans" → resolved: debug.ts lead
- [x] A23: **source badges** 🟣Memory 🟢Live 🔵Plan (🟡Recent Chat) — โชว์ว่า engine ประกอบ context จากหลายแหล่ง = ก้าวจาก "ระบบเก็บความจำ" → "ระบบจัดการบริบท" (P1, killer framing) → resolved: sourceBadge + muted categorical dots (semantic, ไม่ใช่ decorative). NOTE: Recent Chat (tail) ยังไม่ surface — เพิ่มได้ถ้าต้องการ
- [ ] A24: collapse long raw chunk → summary label + expand ("✓ Current weather" กด expand) กัน panel ยาว (P2 product-polish) → **partial**: ทำ truncate 58 + full text on hover (title). semantic-summary expand ยังไม่ทำ — future polish; hackathon-ok ตาม GPT
หมายเหตุ: GPT บอก "อันนี้ใช้ได้สำหรับ hackathon แล้ว" — รอบนี้เป็น refinement เชิง conceptual ไม่ใช่ blocker. brain ปัจจุบันมี 0 Memory (ยังไม่ seed preference) เลยเห็นแค่ Live/Plan badge — seed coffee pref จะโชว์ 🟣 Memory

## 2026-07-20 (รอบ 5) | GPT + founder | เรื่อง: ship it — deploy to Alibaba Cloud
- [x] A25: copy polish 'before the model generated this reply' (states pre-inference architecture) → resolved: debug.ts why-lead
- [x] A26: DEPLOY to Alibaba Cloud (GPT: Node→reverse-proxy→HTTPS) → resolved: LIVE at https://cm.viibe.to on Alibaba SAS (systemd+nginx+CF TLS). **นี่ปิด A9 deployment-proof แบบสมบูรณ์** — backend รันบน Alibaba Cloud จริง verified external
- [x] A27: no new engine features (decay/graph/confidence = v2) → agreed, ไม่แตะ engine
- GPT identity framing (not an action): Squish + Memory Engine = 'pre-inference engines' (selection before the model thinks) — เก็บไว้ใช้ในเรื่องเล่า/write-up

## 2026-07-20 (รอบ 6) | GPT | เรื่อง: final UI polish — visualize BOUNDED working context (Context Composition Engine)
- [x] A28: Reframe = **Context Composition Engine**; output ที่สำคัญคือ **Working Context** ไม่ใช่ Memory (P1 framing, **verified: ตรงกับ retrieve+tail bounded design**) → รับ: pane header "Why this answer" → **"Working context — what the model receives"**
- [x] A29: **Visualize bounded context** = property ที่ยังมองไม่เห็น: บทสนทนาโต (N tokens) แต่ working context คงที่ (M tokens) → bar เทียบ Conversation vs Working (P1, **the missing aha**). ทำได้ web-only: convo = est(snap.messages), working = est(system+inject+tail). Honest caveat: working = retrieved memories + short tail cap (ไม่ใช่ 0 conversation) — bounded เพราะ top-K + tail cap
- [x] A30: **หลีกเลี่ยง** "run for months on free credits" (pricing-dependent) → พูดเรื่อง engine เอง: "working context stays bounded as conversation grows" / "context growth sub-linear" (P1 honesty) → รับ
- [x] A31: อย่าเรียก debug panel → product feature naming (Working Context / Context Composition / What the model receives) (P2) → รับ
- Demo flow ใหม่: long convo → 1 more Q → inspector โชว์ working context เล็ก → Qwen ตอบถูก → "model ไม่ได้เห็นทั้งบทสนทนา?!" → คือ engine

หมายเหตุ A29: bounded 'aha' จะเห็นชัดเมื่อบทสนทนายาว (working ~bounded, conversation โต). บนแชตสั้น working อาจ ≈/มากกว่า conversation — copy เลยพูดเรื่อง 'bounded/not proportional' ไม่ใช่ 'N of M reduction' (honest ทุกความยาว). ตัว aha ในวิดีโอส่งผ่านฉาก eval (23 vs 428 = bounded example จริง) → resolved: why.ts+debug.ts+video eval beat (commit e672ca5)
