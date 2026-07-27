import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Theme, space, radius, type as t } from '@fuel/tokens';
import {
  StepBar, Segmented, OptionCard, RadioRow, FieldRow, ToggleRow, BrandMark,
  CTAButton, Card, Ring, ScanIcon, FlameIcon, Sheet,
} from '@fuel/ui';
import Svg, { Path } from 'react-native-svg';
import { computeTargets, waterLitersFor, type Profile, type Targets, type Goal, type Sex, type ActivityLevel } from '@fuel/domain';
import { onb } from './onbStrings';

/* ---------- Welcome (design 5a) ---------- */
export function WelcomeScreen({ theme, onApple, onGoogle, onEmail, onRestore }: {
  theme: Theme; onApple: () => void; onGoogle: () => void; onEmail: () => void; onRestore: () => void;
}) {
  const bullet = (icon: React.ReactNode, text: string) => (
    <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
      {icon}
      <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.label }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.card, padding: space.s6, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'center', gap: space.s4, marginTop: space.s12 }}>
        <BrandMark theme={theme} />
        <Text style={{ fontSize: t.largeTitle.size, fontWeight: t.largeTitle.weight, color: theme.label }}>{onb.appName}</Text>
        <Text style={{ fontSize: t.body.size, color: theme.secondaryLabel, textAlign: 'center', maxWidth: 280 }}>{onb.tagline}</Text>
        <View style={{ gap: space.s3, marginTop: space.s4, alignSelf: 'center' }}>
          {bullet(<ScanIcon color={theme.tint} size={18} />, onb.bullet1)}
          {bullet(
            <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M3 16 L9 10 L13 13 L21 5" stroke={theme.success} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>,
            onb.bullet2)}
          {bullet(<FlameIcon color={theme.macroProtein} size={18} />, onb.bullet3)}
        </View>
      </View>
      <View style={{ gap: space.s3 }}>
        <Pressable testID="auth-apple" onPress={onApple} style={{ backgroundColor: theme.label, borderRadius: radius.card, alignItems: 'center', paddingVertical: space.s4 }}>
          <Text style={{ fontSize: t.headline.size, fontWeight: '700', color: theme.bg }}>{onb.apple}</Text>
        </Pressable>
        <Pressable testID="auth-google" onPress={onGoogle} style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.separator, borderRadius: radius.card, alignItems: 'center', paddingVertical: space.s4 }}>
          <Text style={{ fontSize: t.headline.size, fontWeight: '700', color: theme.label }}>{onb.google}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          <Pressable testID="auth-email" onPress={onEmail}>
            <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>
              {onb.useEmail} <Text style={{ color: theme.tint, fontWeight: '600' }}>·</Text>
            </Text>
          </Pressable>
          <Pressable onPress={onRestore}>
            <Text style={{ fontSize: t.subhead.size, fontWeight: '600', color: theme.tint }}>{onb.restore}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ---------- Email auth sheet (the design's "use email instead" path) ---------- */
export function EmailAuthSheet({ theme, busy, error, onSubmit }: {
  theme: Theme; busy: boolean; error?: string; onSubmit: (email: string, password: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const valid = /.+@.+\..+/.test(email) && pw.length >= 8;
  const input = (v: string, set: (x: string) => void, ph: string, secure: boolean, testID: string) => (
    <TextInput
      testID={testID} value={v} onChangeText={set} placeholder={ph}
      placeholderTextColor={theme.secondaryLabel} secureTextEntry={secure}
      autoCapitalize="none" autoCorrect={false}
      style={{ backgroundColor: theme.card, borderRadius: radius.md, padding: space.s4, fontSize: t.body.size, color: theme.label }}
    />
  );
  return (
    <Sheet theme={theme}>
      <View style={{ gap: space.s3 }}>
        <Text style={{ fontSize: t.title2.size, fontWeight: '700', color: theme.label }}>{onb.emailTitle}</Text>
        <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{onb.emailSub}</Text>
        {input(email, setEmail, onb.emailPh, false, 'email-input')}
        {input(pw, setPw, onb.passwordPh, true, 'password-input')}
        {error !== undefined && <Text testID="auth-error" style={{ fontSize: t.subhead.size, color: theme.danger }}>{error}</Text>}
        <View style={{ opacity: valid && !busy ? 1 : 0.4 }}>
          <CTAButton theme={theme} testID="auth-submit" label={busy ? onb.working : onb.continueBtn}
            onPress={() => { if (valid && !busy) onSubmit(email, pw); }} />
        </View>
      </View>
    </Sheet>
  );
}

/* ---------- Goal (design 4g/1g) ---------- */
const GOALS: { id: Goal | 'recomp' | 'habit'; title: string; sub: string }[] = [
  { id: 'lose', title: onb.goalLose, sub: onb.goalLoseSub },
  { id: 'gain', title: onb.goalBuild, sub: onb.goalBuildSub },
  { id: 'recomp', title: onb.goalRecomp, sub: onb.goalRecompSub },
  { id: 'habit', title: onb.goalHabit, sub: onb.goalHabitSub },
];
/** recomp/habit map to maintain for target math (recorded in spec). */
export const goalToDomain = (g: string): Goal => (g === 'lose' ? 'lose' : g === 'gain' ? 'gain' : 'maintain');

export function GoalScreen({ theme, value, onSelect, onContinue }: {
  theme: Theme; value: string | null; onSelect: (id: string) => void; onContinue: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: space.s5, gap: space.s4 }}>
      <StepBar theme={theme} step={2} />
      <Text style={{ fontSize: t.largeTitle.size - 4, fontWeight: '700', color: theme.label }}>{onb.goalTitle}</Text>
      <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{onb.goalSub}</Text>
      <View style={{ gap: space.s3 }}>
        {GOALS.map((g) => (
          <OptionCard key={g.id} theme={theme} title={g.title} subtitle={g.sub}
            selected={value === g.id} onPress={() => onSelect(g.id)} testID={`goal-${g.id}`} />
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ opacity: value ? 1 : 0.4 }}>
        <CTAButton theme={theme} testID="goal-continue" label={onb.continueBtn} onPress={() => { if (value) onContinue(); }} />
      </View>
    </View>
  );
}

/* ---------- About you (design 5b) ---------- */
export interface AboutYou { sex: Sex; age: string; height: string; weight: string; activity: ActivityLevel | null }

const ACTIVITIES: { id: ActivityLevel; title: string; sub: string }[] = [
  { id: 'sedentary', title: onb.actSitting, sub: onb.actSittingSub },
  { id: 'light', title: onb.actLight, sub: onb.actLightSub },
  { id: 'active', title: onb.actVery, sub: onb.actVerySub },
];

export function AboutYouScreen({ theme, value, onChange, onContinue, valid }: {
  theme: Theme; value: AboutYou; onChange: (v: AboutYou) => void; onContinue: () => void; valid: boolean;
}) {
  const sexes: Sex[] = ['female', 'male'];
  const segIndex = value.sex === 'female' ? 0 : 1;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: space.s5, gap: space.s4 }}>
      <StepBar theme={theme} step={1} />
      <Text style={{ fontSize: t.largeTitle.size - 4, fontWeight: '700', color: theme.label }}>{onb.aboutTitle}</Text>
      <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel }}>{onb.aboutSub}</Text>
      <Segmented theme={theme} options={[onb.female, onb.male, onb.other]} value={segIndex}
        onChange={(i) => onChange({ ...value, sex: sexes[Math.min(i, 1)]! })} />
      <View style={{ borderRadius: radius.card, overflow: 'hidden' }}>
        <FieldRow theme={theme} label={onb.age} value={value.age} unit="" testID="age-input"
          onChange={(v) => onChange({ ...value, age: v })} />
        <FieldRow theme={theme} label={onb.height} value={value.height} unit="cm" testID="height-input"
          onChange={(v) => onChange({ ...value, height: v })} />
        <FieldRow theme={theme} label={onb.weight} value={value.weight} unit="kg" testID="weight-input"
          onChange={(v) => onChange({ ...value, weight: v })} divider={false} />
      </View>
      <Text style={{ fontSize: t.footnote.size, fontWeight: '600', letterSpacing: 0.8, color: theme.secondaryLabel }}>{onb.activityCaps}</Text>
      <View style={{ borderRadius: radius.card, overflow: 'hidden' }}>
        {ACTIVITIES.map((a, i) => (
          <RadioRow key={a.id} theme={theme} title={a.title} subtitle={a.sub} testID={`activity-${a.id}`}
            selected={value.activity === a.id} onPress={() => onChange({ ...value, activity: a.id })}
            divider={i < ACTIVITIES.length - 1} />
        ))}
      </View>
      <Text style={{ fontSize: t.footnote.size, color: theme.secondaryLabel }}>{onb.aboutFootnote}</Text>
      <View style={{ opacity: valid ? 1 : 0.4 }}>
        <CTAButton theme={theme} testID="about-continue" label={onb.continueBtn} onPress={() => { if (valid) onContinue(); }} />
      </View>
    </ScrollView>
  );
}

/* ---------- Your plan (design 5c) ---------- */
export function PlanScreen({ theme, profile, reminder, onReminder, onStart }: {
  theme: Theme; profile: Profile; reminder: boolean; onReminder: (v: boolean) => void; onStart: (targets: Targets, waterL: number) => void;
}) {
  const targets = useMemo(() => computeTargets(profile), [profile]);
  const waterL = waterLitersFor(profile.weight_kg);
  const tile = (v: string, label: string, color: string) => (
    <View key={label} style={{ flex: 1, backgroundColor: theme.card, borderRadius: radius.md, alignItems: 'center', paddingVertical: space.s3, gap: 2 }}>
      <Text style={{ fontSize: t.headline.size, fontWeight: '700', color }}>{v}</Text>
      <Text style={{ fontSize: t.caption.size - 1, fontWeight: '600', color: theme.secondaryLabel }}>{label}</Text>
    </View>
  );
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: space.s5, gap: space.s4 }}>
      <StepBar theme={theme} step={4} />
      <Text style={{ fontSize: t.largeTitle.size - 4, fontWeight: '700', color: theme.label, textAlign: 'center' }}>{onb.planTitle}</Text>
      <Text style={{ fontSize: t.subhead.size, color: theme.secondaryLabel, textAlign: 'center' }}>{onb.planSub(profile.goal)}</Text>
      <View style={{ alignItems: 'center' }}>
        <Ring theme={theme} progress={0.72} value={targets.kcal.toLocaleString('en-US')} caption={onb.kcalPerDay} size={190} strokeWidth={16} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.s2 }}>
        {tile(`${Math.round(targets.protein_g)}g`, onb.protein, theme.macroProtein)}
        {tile(`${Math.round(targets.carbs_g)}g`, onb.carbs, theme.macroCarbs)}
        {tile(`${Math.round(targets.fat_g)}g`, onb.fat, theme.macroFat)}
        {tile(`${waterL}L`, onb.water, theme.water)}
      </View>
      {targets.clamped && (
        <Text style={{ fontSize: t.footnote.size, color: theme.danger }}>{onb.clampedNote}</Text>
      )}
      <Card theme={theme}>
        <View style={{ paddingVertical: space.s2 }}>
          <Text style={{ fontSize: t.subhead.size, color: theme.label, lineHeight: 20 }}>{onb.planExplainer}</Text>
        </View>
      </Card>
      <ToggleRow theme={theme} title={onb.reminderTitle} subtitle={onb.reminderSub}
        value={reminder} onChange={onReminder} testID="reminder-toggle" />
      <CTAButton theme={theme} testID="start-day1" label={onb.startDay1} onPress={() => onStart(targets, waterL)} />
    </ScrollView>
  );
}
