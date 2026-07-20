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
