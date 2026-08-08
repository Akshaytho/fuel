# -*- coding: utf-8 -*-
"""Fuel — the complete app handbook. One page-flow, every screen, every feature."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Image, Table, TableStyle, PageBreak, KeepTogether)
from PIL import Image as PILImage
import os

OUT = 'out/Fuel-App-Handbook.pdf'
SHOTS = 'tools/visual-harness/out'
W, H = A4

INK = HexColor('#191D19'); SEC = HexColor('#6B6B6E'); GREEN = HexColor('#34C759')
DEEP = HexColor('#1D7A3D'); BLUE = HexColor('#0970D9'); ORANGE = HexColor('#FF9F0A')
BG = HexColor('#F2F2F7'); SOFT = HexColor('#E9F9EE'); SEP = HexColor('#E5E5EA')

def st(name, **kw):
    base = dict(fontName='Helvetica', fontSize=10, leading=14.5, textColor=INK, alignment=TA_LEFT)
    base.update(kw); return ParagraphStyle(name, **base)

S = {
 'h1': st('h1', fontName='Helvetica-Bold', fontSize=24, leading=28, spaceAfter=6),
 'h2': st('h2', fontName='Helvetica-Bold', fontSize=15, leading=19, spaceBefore=10, spaceAfter=4, textColor=DEEP),
 'shot_title': st('t', fontName='Helvetica-Bold', fontSize=13, leading=16, spaceAfter=3),
 'kicker': st('k', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=BLUE, spaceAfter=2),
 'body': st('b', fontSize=9.6, leading=14),
 'small': st('s', fontSize=8.6, leading=12.4, textColor=SEC),
 'cap': st('c', fontSize=8, leading=10.5, textColor=SEC, alignment=TA_CENTER),
}

def para(txt, style='body'): return Paragraph(txt, S[style])

def img(path, w_in):
    p = os.path.join(SHOTS, path)
    iw, ih = PILImage.open(p).size
    return Image(p, width=w_in*inch, height=w_in*inch*ih/iw)

def framed(im):
    t = Table([[im]], style=TableStyle([
        ('BOX', (0,0), (-1,-1), 1, SEP), ('LEFTPADDING',(0,0),(-1,-1),0),
        ('RIGHTPADDING',(0,0),(-1,-1),0), ('TOPPADDING',(0,0),(-1,-1),0),
        ('BOTTOMPADDING',(0,0),(-1,-1),0)]))
    return t

def screen(kicker, title, shot, body_paras, w_shot=1.78):
    left = framed(img(shot, w_shot))
    right = [para(kicker, 'kicker'), para(title, 'shot_title')] + [para(b) for b in body_paras]
    t = Table([[left, right]], colWidths=[(w_shot+0.06)*inch, None],
              style=TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),
                                ('LEFTPADDING',(1,0),(1,0),12),
                                ('LEFTPADDING',(0,0),(0,0),0),
                                ('BOTTOMPADDING',(0,0),(-1,-1),10)]))
    return KeepTogether(t)

story = []

# ---------------- COVER ----------------
cover_style = TableStyle([('BACKGROUND',(0,0),(-1,-1),INK),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
                          ('LEFTPADDING',(0,0),(-1,-1),34),('RIGHTPADDING',(0,0),(-1,-1),34),
                          ('TOPPADDING',(0,0),(-1,-1),40),('BOTTOMPADDING',(0,0),(-1,-1),40)])
cover_inner = [
    Paragraph('FUEL', st('c1', fontName='Helvetica-Bold', fontSize=52, leading=56, textColor=white)),
    Spacer(1,6),
    Paragraph('The honest way to eat better.', st('c2', fontSize=17, leading=22, textColor=HexColor('#58D97C'))),
    Spacer(1,16),
    Paragraph('The complete app handbook — every screen, its purpose, and every feature, '
              'with real screenshots captured from the working build.',
              st('c3', fontSize=10.5, leading=15.5, textColor=HexColor('#C9C9CF'))),
    Spacer(1,22),
    Paragraph('iOS + Android - React Native + Expo - Supabase backend<br/>'
              '361 automated tests - 13 tap-only simulation harnesses - light and dark, WCAG AA audited',
              st('c4', fontSize=9, leading=14, textColor=HexColor('#9A9AA2'))),
]
story.append(Table([[cover_inner]], colWidths=[W-1.4*inch], rowHeights=[H-1.6*inch], style=cover_style))
story.append(PageBreak())

# ---------------- WHAT THE APP IS ----------------
story.append(para('What Fuel is', 'h1'))
story.append(para(
 'Fuel is a nutrition tracker for iOS and Android that helps a person eat toward a goal — losing, '
 'maintaining, or gaining — by making an honest record of what they eat and turning that record into '
 'targets that adapt to their real body. You tell it who you are once; it computes evidence-based calorie, '
 'protein, carb, fat, fibre and water targets; you log food in seconds; and every week it recalculates '
 'your true energy burn from what you actually ate versus what your weight actually did, then proposes '
 'next week’s targets. Almost no app on the market does that last step; it is normally the entire '
 'selling point of a $72-a-year subscription.'))
story.append(Spacer(1,6))
story.append(para('Five principles run through every screen', 'h2'))
story.append(para(
 '<b>1. Honesty.</b> Fuel never claims to know something it doesn’t. A food with no fibre figure shows '
 '“unknown”, never zero. A half-logged day is shown as half-logged, not as a light day of eating. '
 'A day saved by a rest day says so. Estimates are marked as estimates in the database itself.'))
story.append(para(
 '<b>2. No shame.</b> Calorie trackers can worsen disordered eating, and the published evidence says the harm '
 'comes from ordinary features: red numbers, guilt popups, streaks that punish. So in Fuel nothing turns red '
 'for a rounding error, an over-target day gets perspective instead of applause or scolding, there are no '
 'good/bad food labels, and nothing anxiety-related is ever for sale.'))
story.append(para(
 '<b>3. Evidence over habit.</b> The targets use the Mifflin-St Jeor equation with sex-specific safety floors; '
 'fibre uses the Institute of Medicine’s 14 g per 1,000 kcal; the weekly “3+ days” success level, '
 'the one-tap Easy Day, and the quiet comeback after a long break each come directly from peer-reviewed '
 'adherence research.'))
story.append(para(
 '<b>4. It gets easier the longer you use it.</b> Your own history becomes the interface: go-tos learn what '
 'you eat and when, repeated combinations become one-tap meals, and your whole usual day becomes a single tap.'))
story.append(para(
 '<b>5. Offline-first, yours.</b> Every log lands on the device first and syncs to the cloud with '
 'exactly-once delivery. Airplane mode, dead spots, and server hiccups never lose a meal. Your data is '
 'exportable as CSV and deletable to zero — server included — from inside the app.'))
story.append(Spacer(1,8))
story.append(para('How the app is organised', 'h2'))
story.append(para(
 'Three destinations and one action. <b>Today</b> answers “how am I doing right now” and holds at most '
 'five blocks by rule. <b>Progress</b> answers “how is it going over time” — week, weight, energy, '
 'consistency, and the weekly report in one place. <b>You</b> is the account: your plan, export, sign-out, delete. '
 'The blue <b>+</b> is a floating button that opens the log sheet from anywhere. This structure came from studying '
 'seven leading apps: every one keeps micronutrients off the home screen, and the one that buried its food diary '
 'lost 1.7 stars in a month.'))
story.append(PageBreak())

# ---------------- ONBOARDING ----------------
story.append(para('First run — from download to a plan in under a minute', 'h1'))
story.append(screen('APP OPEN', 'Boot', 'cap-01-boot.png', [
 'The brand moment: the Fuel mark springs in while the app loads your data. It is engineered so that '
 'animation can never hide the app — if the clock jumps or a device has Reduce Motion on, the screen '
 'still appears. A returning user goes straight to Today from here; a new one lands on Welcome.']))
story.append(screen('WELCOME', 'Welcome', 'cap-02-welcome.png', [
 'One promise and three truths: scan/describe/label logging, targets that adapt to your real body, and a '
 'streak that survives busy days. One button. No 78-question quiz, no paywall ambush — the two '
 'onboarding sins the big apps are most criticised for.']))
story.append(screen('SIGN IN', 'Continue with email', 'cap-03-auth.png', [
 'Sign-in and sign-up are the same box — the app works out which you need. A network failure is told '
 'apart from a wrong password, so flaky wifi never reads as “wrong credentials”. Signing in on a new '
 'phone restores your entire history from the server: no fake Day 1.']))
story.append(screen('GOAL', 'What are we working toward?', 'cap-04-goal.png', [
 'Lose, gain, recomposition, or habit-building. This one choice drives the calorie delta (a capped 20% '
 'deficit or 10% surplus), the protein level (1.6–2.0 g per kg of reference weight), and the pace band '
 'the weekly report judges against.']))
story.append(screen('ABOUT YOU', 'Age, height, weight, activity', 'cap-05-about.png', [
 'The four numbers the Mifflin-St Jeor equation needs. Safety is built in here: female targets never go '
 'below 1,200 kcal and male below 1,500 — and when that floor kicks in, the app says so instead of '
 'pretending the number was chosen.']))
story.append(screen('YOUR PLAN', 'The plan, before you commit', 'cap-06-plan.png', [
 'Daily calories, protein, carbs, fat and water — computed, explained, and shown before you start. '
 'The plan is a starting point, not a verdict: from week one, your own logs and weigh-ins retune it.']))
story.append(PageBreak())

# ---------------- TODAY ----------------
story.append(para('Today — how am I doing right now', 'h1'))
story.append(screen('TODAY, EMPTY', 'A fresh day', 'cap-07-today-empty.png', [
 'Before anything is logged: your target in the centre of the rings, and the two fastest ways in. A '
 'returning user sees “Nothing logged yet today” — the app never greets a veteran like a '
 'stranger. By rule, Today holds at most five blocks; a new feature must displace something or live elsewhere.']))
story.append(screen('TODAY, LIVE', 'A logged day', 'cap-11-today-logged.png', [
 'The heart of the app. Triple rings sweep to calories, protein and carbs+fat; the coach line beneath reads '
 'the whole day — it counts protein down on a normal day, gives week-level perspective on a heavy one, '
 'and never congratulates a blowout. Water is one tap (+250 ml, long-press to undo). The streak lives as a '
 'small chip by the title. The meals list sits high on the screen — it is the thing you open the app '
 'to see, and it never moves further away. Long-press any entry to remove it, everywhere, server included.']))
story.append(screen('ONE TAP DEEPER', 'Today in detail', 'cap-12-detail-sheet.png', [
 'Tap the nutrition card and the full breakdown slides up: calories and each macro against target, plus '
 'fibre — with its honesty attached. Fibre says “at least 2.6 g” when one food had no figure, '
 'and “unknown” rather than zero when none did. The target is the IOM’s 14 g per 1,000 kcal, '
 'scaled to your energy — information to notice, never a bar that turns red.']))
story.append(PageBreak())

# ---------------- LOGGING ----------------
story.append(para('Logging — seconds, not minutes', 'h1'))
story.append(screen('THE LOG SHEET', 'Everything one tap from the +', 'cap-08-log-sheet.png', [
 'Search any food, or use the four tiles (scan, describe, label, saved — the camera/AI ones arrive in '
 'Phase 2 and honestly say so). Below: your go-tos for this meal at this hour, and Copy Yesterday. The '
 'sheet is powered by your own history, so it gets faster every week you use it.']))
story.append(screen('SEARCH', 'Ranked by relevance, in the database', 'cap-09-search.png', [
 'Typing “banana” puts “Bananas, raw” first — not “Babyfood, apple-banana '
 'juice”. Ranking runs inside Postgres with trigram indexes against USDA-verified foods, so it stays '
 'instant at hundreds of thousands of rows. Results carry verified per-100 g nutrition including fibre.']))
story.append(screen('PORTION', 'Grams, meal, done', 'cap-10-portion.png', [
 'Portion chips, a gram field, and live macro preview that recalculates as you type. Pick the meal slot '
 '(pre-guessed from the time of day) and log. The entry is stored locally first and synced with an '
 'idempotency key, so even a double-tap on flaky wifi cannot create a duplicate.']))
story.append(screen('SPEC 0016', 'Easy Day — your usual day, one tap', 'ed-01-offer.png', [
 'The feature no competitor ships. A randomised trial found simplified logging nearly doubled adherence '
 '(97% vs 49% of days tracked) with identical weight loss. After three days of a recognisable routine, the '
 'log sheet offers your usual day — real foods, your median portions — and one tap logs all of it. '
 'Entries are marked “easy” in the database, keeping the record honest. If breakfast is already '
 'logged, it offers only “your usual dinner”.']))
story.append(screen('SPEC 0017', 'Hourly go-tos — the app learns your clock', 'ep-01-hourly-gotos.png', [
 'Your 7:30 food leads the list at 7:30 and your 12:30 food at 12:30, even within the same meal slot. Typical '
 'hours are medians (one odd 3 pm breakfast moves nothing), distance is circular (23:30 is “close” to '
 '00:15), and ranking is banded so a twenty-time staple an hour off still beats a one-off logged exactly now.']))
story.append(PageBreak())

# ---------------- PROGRESS ----------------
story.append(para('Progress — how it’s going over time', 'h1'))
story.append(screen('WEEK', 'The week, the streak, the report', 'cap-13-progress-week.png', [
 'Seven dots tell the week’s true story: solid green for an on-target logged day, orange ring for logged, '
 'a dashed ring for a half-logged day (never silently counted), a flame for a day saved by an earned rest '
 'day, hollow for missed — and a dot is never red. Below: the streak in full, a weigh-in shortcut, and '
 'the weekly report. At three or more logged days the green line appears: “3+ days a week is the level '
 'research links to lasting results — you’re there.” Below three, it is simply absent. Never a countdown.']))
story.append(screen('WEIGHT', 'Trend, not noise', 'cap-14-progress-weight.png', [
 'Raw weigh-ins are dots; the line is the smoothed trend that ignores water-weight swings — the number '
 'that stops people panicking over a 2 kg overnight blip. The slope tile shows kg/week and shows an honest '
 'dash, never a fake number, when there isn’t enough data. Logging a new weight retunes targets instantly.']))
story.append(screen('ENERGY', 'Fourteen days of eating', 'cap-15-progress-energy.png', [
 'Each bar is a day’s calories against the target line. Unlogged days are gaps, not zeros — the '
 'chart never pretends you ate nothing on a day you didn’t log.']))
story.append(screen('CONSISTENCY', 'The habit itself', 'cap-16-progress-consistency.png', [
 'Protein-target days per week across eight weeks, plus the share of days logged. This is the chart of the '
 'behaviour that actually predicts results — showing up — rather than any single day’s number.']))
story.append(PageBreak())

story.append(para('The weekly report — the adaptive engine', 'h1'))
story.append(screen('SPEC 0010 + 0012', 'Your burn, recalculated from reality', 'pd-03-report-excluded.png', [
 'Once a week has enough data (4+ logged days, weigh-ins 5+ days apart), Fuel computes your TRUE energy burn '
 'from physics: average intake minus the energy value of your actual weight change. It then proposes next '
 'week’s targets — clamped to ±30% of the formula so one weird week cannot send them somewhere '
 'unsafe. Only MacroFactor ($71.99/yr) does anything comparable.',
 'The honesty layer is visible here: Thursday “looked half-logged”, so it was left out of the maths '
 'and named. Counting a forgotten dinner as a light day would quietly cut your target — measured at up '
 'to 235 kcal/day of silent drift before this was built.']))
story.append(screen('YOUR WORD WINS', 'One tap to overrule the app', 'pd-04-report-after-confirm.png', [
 'Tap “That day is right” and the day is restored to the maths permanently — here the proposed '
 'target moves from 2,005 to 1,834 kcal, because the user vouched that Thursday really was a light day. The '
 'app’s heuristics never outrank the person.']))
story.append(PageBreak())

# ---------------- MOMENTS ----------------
story.append(para('The moments — where the app behaves like a person', 'h1'))
story.append(screen('DESIGN 6A', 'The celebration', '5d-08-d5-celebration.png', [
 'When the day lands — protein hit, calories in the band, evening arrived — one full-screen moment: '
 'the ring completes, confetti in the macro colours, the streak’s next milestone. Once per day, never '
 'longer than three seconds, dismisses itself, and never replays after relaunch. It refuses to fire on an '
 'over-target day and won’t call a half-eaten afternoon “on target” while dinner is still ahead.']))
story.append(screen('SPEC 0013', 'Rest days — a streak that survives being human', 'rd-03-day9-after-logging.png', [
 'Log seven days in a row and you earn a rest day (max two banked). One sick day is covered automatically: '
 'the run holds, and the app says why. The honesty rule is visible in the numbers — “8 days · '
 '1 rest day”, never “9 days”, and the covered Monday is drawn as a flame, not a tick. Rest '
 'days are never for sale; a competitor charges $0.99 to restore a streak, and Fuel never will.']))
story.append(screen('SPEC 0017', 'Quiet re-entry — coming back after a long break', 'ep-03-quiet-reentry.png', [
 'The strongest measured predictor of quitting is not wanting to face the numbers. So after 30+ days away '
 'there is not a single digit on this card — no day count, no old streak, no backlog. “Good to see '
 'you. Nothing to make up for, nothing to backfill.” Short breaks (2–29 days) still get the warm, '
 'specific version with your best run remembered.']))
story.append(screen('SPEC 0017', 'The weekly floor', 'ep-02-weekly-floor.png', [
 'Research validated 3+ logged days a week as a genuine success level for long-term results — while '
 'every competitor’s streak quietly demands 7/7. Fuel celebrates the floor when you reach it and says '
 'nothing at all below it.']))
story.append(PageBreak())

# ---------------- YOU + DARK ----------------
story.append(para('You — the account, and your way out', 'h1'))
story.append(screen('PROFILE', 'Your plan and your data', 'cap-17-profile.png', [
 'Current goal and targets, days logged, change-goal and weight entry, and the two controls every honest '
 'app owes its users: export everything as CSV, and delete the account — which erases the server first '
 'and only then the device, verified down to zero rows in the database. Coming-soon items are labelled '
 'honestly instead of pretending to work.']))
story.append(para('Dark mode — not an afterthought', 'h2'))
story.append(para(
 'Fuel follows the system theme, so dark mode reaches users automatically on day one. Every screen is '
 'rendered and contrast-audited in both themes on every test run — 16 screens, every visible text node '
 'checked against WCAG AA (4.5:1). Five colours that Apple itself ships were replaced because they fail '
 'that bar.', 'body'))
dark_row = Table([[framed(img(p, 1.22)) for p in
                   ['dk-2-welcome.png','dk-10-today-with-data.png','dk-11-detail-sheet.png','dk-12-progress-week.png']]],
                 colWidths=[1.32*inch]*4,
                 style=TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),3),
                                   ('RIGHTPADDING',(0,0),(-1,-1),3),('TOPPADDING',(0,0),(-1,-1),6)]))
story.append(dark_row)
story.append(Paragraph('Welcome · Today · Detail sheet · Progress — the same screens, audited dark.', S['cap']))
story.append(PageBreak())

# ---------------- FEATURE CATALOG ----------------
story.append(para('The complete feature catalog', 'h1'))
rows = [['Feature','What it does']]
feats = [
 ('Evidence-based targets','Mifflin-St Jeor BMR, capped deficit/surplus, protein by goal, 30% fat, water by weight; sex-specific calorie floors that are named when they engage.'),
 ('Adaptive weekly targets','Measured TDEE from your logs + weigh-ins via energy balance; proposals clamped to ±30% of formula; accept or adjust, never imposed.'),
 ('Partial-day protection','A half-logged day is excluded from the maths, shown dashed, named in the report, and restorable with one tap. Your word beats the heuristic.'),
 ('Food search','USDA-verified foods, relevance-ranked in Postgres with trigram indexes; fibre included; zero food data hardcoded in the app.'),
 ('Go-tos (hourly)','Your staples per meal slot, ranked by how often, how recently, and WHEN you eat them; one tap re-logs your usual portion.'),
 ('Meals you repeat','2+ foods eaten together on 3+ days become a one-tap combination at your median portions. Derived, never maintained.'),
 ('Easy Day','One tap logs your whole usual day; honest remainder when part is logged; entries marked as estimates in the database.'),
 ('Copy yesterday','The whole of yesterday, one tap, when days repeat.'),
 ('Water','One-tap +250 ml on Today, long-press undo, synced.'),
 ('Weigh-ins & trend weight','Upserted per day, smoothed trend line, honest slope; retunes targets on save.'),
 ('Streak + rest days','Real streak from real days; 7 days earns a rest day (max 2); one miss is covered and disclosed; two misses break it honestly.'),
 ('Celebration','Once-a-day, 3-second target-hit moment that refuses to fire on over-target or unfinished days.'),
 ('Coach line','One line under the rings that reads the whole day and the week behind it; perspective on heavy days, never applause for them.'),
 ('Comeback & quiet re-entry','Short gaps: greeted with your best run. 30+ days: a card with zero numbers on it.'),
 ('Weekly floor','“3+ days a week” celebrated at 3+, invisible below.'),
 ('Fibre with honesty','IOM 14 g/1,000 kcal target; unknown is never shown as zero; coverage of the number always stated.'),
 ('Offline-first sync','Device-first writes, exactly-once server delivery, per-entry retry, distinct offline/pending/failed states, restore on new device.'),
 ('Dark mode','Automatic with the system; every screen contrast-audited WCAG AA in both themes.'),
 ('Motion with a safety net','Rings sweep, screens fade, the brand animates — and a failsafe guarantees no animation can ever leave a screen blank; Reduce Motion honoured.'),
 ('Export & delete','Full CSV export; account deletion wipes server first, then device, verified to zero.'),
]
for a,b in feats: rows.append([Paragraph('<b>'+a+'</b>', S['small']), Paragraph(b, S['small'])])
ft = Table(rows, colWidths=[1.55*inch, None], repeatRows=1, style=TableStyle([
    ('BACKGROUND',(0,0),(-1,0),INK),('TEXTCOLOR',(0,0),(-1,0),white),
    ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,0),9),
    ('VALIGN',(0,0),(-1,-1),'TOP'),
    ('ROWBACKGROUNDS',(0,1),(-1,-1),[white,BG]),
    ('LINEBELOW',(0,0),(-1,-1),0.4,SEP),
    ('TOPPADDING',(0,0),(-1,-1),4.5),('BOTTOMPADDING',(0,0),(-1,-1),4.5),
    ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7)]))
story.append(ft)
story.append(PageBreak())

# ---------------- UNDER THE HOOD ----------------
story.append(para('Under the hood — why you can trust the numbers', 'h1'))
story.append(para('How it is built', 'h2'))
story.append(para(
 'React Native + Expo on the front; a strict-TypeScript monorepo where every piece of nutrition maths lives '
 'in a pure, dependency-free package with its own test suite. Supabase (Postgres) on the back, with '
 'row-level security set to default-deny — a user can only ever touch their own rows. Food data lives '
 'only in the database, never in the code, fed by a pipeline from USDA FoodData Central.'))
story.append(para('How it is tested', 'h2'))
story.append(para(
 '361 unit tests cover the maths, including a standing “two-year life” review: DST in both '
 'directions, leap days, year rollovers, midnight logs, two-year absences, 150 kg bodies, and two years of '
 'daily data with performance budgets. On top of that, 13 Playwright harnesses use the app exactly as a '
 'person does — tapping visible controls, typing into fields, never injecting state — living '
 'multi-day lives with a moving clock: five personas across five days, a 12-day rest-day arc, a 45-day '
 'absence, a full day cross-checked row-by-row against the live database after every action.'))
story.append(para('What the research changed', 'h2'))
story.append(para(
 'Three published findings shaped the roadmap more than any competitor did. Simplified logging nearly '
 'doubled adherence with identical outcomes — so Easy Day exists. The median quitter leaves around '
 'week 10 and the strongest predictor is not wanting to see the numbers — so the comeback is quiet and '
 'the report never demands a backfill. And 3 logged days a week predicts long-term success — so that is '
 'the line Fuel celebrates, not a 7/7 chain.'))
story.append(para('What is coming', 'h2'))
story.append(para(
 'Phase 2 adds the camera: barcode scan, photo and label reading, and describe-in-words logging — with '
 'AI parsing structure only while nutrition numbers always come from the verified database, and estimates '
 'shown as ranges, never fake-precise numbers. Also queued: Apple Health / Health Connect sync, home-screen '
 'widgets, reminders with real quiet hours, and the full ~8,000-food seed.'))
story.append(Spacer(1, 14))
story.append(Table([[Paragraph('Fuel — built by Harish, engineered with Claude. '
 'Every screenshot in this document is a real capture from the working build, taken by an automated test '
 'that navigated the app by taps alone.', st('foot', fontSize=8.5, leading=12, textColor=SEC))]],
 colWidths=[None], style=TableStyle([('BACKGROUND',(0,0),(-1,-1),BG),
 ('TOPPADDING',(0,0),(-1,-1),10),('BOTTOMPADDING',(0,0),(-1,-1),10),
 ('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12)])))

def deco(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(GREEN); canvas.rect(0, H-0.18*inch, W, 0.18*inch, stroke=0, fill=1)
    canvas.setFillColor(SEC); canvas.setFont('Helvetica', 7.5)
    canvas.drawRightString(W-0.55*inch, 0.42*inch, f'Fuel — app handbook · page {doc.page}')
    canvas.restoreState()

doc = BaseDocTemplate(OUT, pagesize=A4,
    leftMargin=0.7*inch, rightMargin=0.7*inch, topMargin=0.62*inch, bottomMargin=0.62*inch,
    title='Fuel — The Complete App Handbook', author='Harish + Claude')
frame = Frame(doc.leftMargin, doc.bottomMargin, W-1.4*inch, H-1.24*inch, id='f')
doc.addPageTemplates([PageTemplate(id='main', frames=[frame], onPage=deco)])
doc.build(story)
print('PDF built:', OUT, os.path.getsize(OUT), 'bytes')
