import { beforeAll, describe, expect, it } from 'vitest';
import { cleanName, formatHandle, handleKey, hashPin, lockoutMs, newSalt, parseHandle, suggestTag, validateName, validatePin, validateTag, weakPin } from './handle';
import { createLocalProfile, deleteLocalProfile, findLocalProfile, guestHasData, loginLocal, logout, useAccount } from './accounts';
import { useNotes } from '@/store/notes';
import { useProgress } from '@/store/progress';
import { getNamespace, namespaceKeys } from '@/store/persist';
import { PIN_ITERATIONS } from './handle';

describe('handle rules', () => {
  it('accepts names in any language, up to 16 characters', () => {
    expect(validateName('สมชาย')).toBeNull();
    expect(validateName('하늘')).toBeNull();
    expect(validateName('Mint_99')).toBeNull();
    expect(validateName('ณัฐ ภัทร')).toBeNull();
    expect(validateName('あいう')).toBeNull();
    expect(validateName('a'.repeat(16))).toBeNull();
    expect(validateName('a'.repeat(17))).not.toBeNull();
    expect(validateName('')).not.toBeNull();
    expect(validateName('ab#c')).not.toBeNull();
    expect(validateName('🙂')).not.toBeNull();
    expect(validateName(' -x')).not.toBeNull();
  });
  it('accepts tags of 1–10 letters or digits', () => {
    expect(validateTag('1234')).toBeNull();
    expect(validateTag('#ABC')).toBeNull();
    expect(validateTag('한국')).toBeNull();
    expect(validateTag('1234567890')).toBeNull();
    expect(validateTag('12345678901')).not.toBeNull();
    expect(validateTag('a b')).not.toBeNull();
    expect(validateTag('')).not.toBeNull();
  });
  it('accepts PINs of 4–6 digits only', () => {
    expect(validatePin('1234')).toBeNull();
    expect(validatePin('123456')).toBeNull();
    expect(validatePin('123')).not.toBeNull();
    expect(validatePin('1234567')).not.toBeNull();
    expect(validatePin('12a4')).not.toBeNull();
    expect(weakPin('1111')).toBe(true);
    expect(weakPin('123456')).toBe(true);
    expect(weakPin('8264')).toBe(false);
  });
  it('parses and normalizes handles', () => {
    expect(parseHandle(' สมชาย#1234 ')).toEqual({ name: 'สมชาย', tag: '1234' });
    expect(parseHandle('a#b#c')).toEqual({ name: 'a#b', tag: 'c' });
    expect(parseHandle('noTag')).toBeNull();
    expect(parseHandle('#1234')).toBeNull();
    expect(handleKey('Mint', 'ABC')).toBe(handleKey('mint', 'abc'));
    expect(formatHandle('  Mint  ', '#12')).toBe('Mint#12');
    expect(cleanName('a   b')).toBe('a b');
  });
  it('suggests a tag not already taken', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const t = suggestTag('x', (k) => taken.has(k));
      expect(taken.has(handleKey('x', t))).toBe(false);
      expect(validateTag(t)).toBeNull();
      taken.add(handleKey('x', t));
    }
  });
  it('hashes PINs with a salt and locks out after repeated failures', async () => {
    const salt = newSalt();
    expect(await hashPin('1234', salt, 1000)).toBe(await hashPin('1234', salt, 1000));
    expect(await hashPin('1234', salt, 1000)).not.toBe(await hashPin('1235', salt, 1000));
    expect(await hashPin('1234', salt, 1000)).not.toBe(await hashPin('1234', newSalt(), 1000));
    expect(lockoutMs(4)).toBe(0);
    expect(lockoutMs(5)).toBe(30_000);
    expect(lockoutMs(6)).toBe(60_000);
    expect(lockoutMs(50)).toBe(3_600_000);
  });
});

describe('local profiles keep each person’s data separate', () => {
  beforeAll(() => {
    expect(PIN_ITERATIONS).toBeGreaterThan(100_000);
  });

  it('moves guest data into a new profile, isolates profiles, and requires the right PIN', async () => {
    // guest practises first
    useNotes.getState().createNote({ title: 'guest note' });
    expect(guestHasData()).toBe(true);

    const a = await createLocalProfile({ name: 'สมชาย', tag: '1234', pin: '2580', moveGuest: true });
    expect(getNamespace()).toBe(`l_${a.id}`);
    expect(Object.values(useNotes.getState().notes).map((n) => n.title)).toEqual(['guest note']);
    useProgress.getState().logAnswers([{ questionId: 'q1', correct: true, given: 'x', section: 'reading', level: 'A1' }], 'test');

    await logout();
    expect(getNamespace()).toBe('');
    expect(Object.keys(useNotes.getState().notes)).toHaveLength(0);
    expect(useProgress.getState().answers).toHaveLength(0);
    expect(guestHasData()).toBe(false);

    await expect(createLocalProfile({ name: 'สมชาย', tag: '1234', pin: '1111', moveGuest: false })).rejects.toThrow(/มีอยู่แล้ว/);
    const b = await createLocalProfile({ name: 'สมชาย', tag: '9999', pin: '13579', moveGuest: false });
    expect(Object.keys(useNotes.getState().notes)).toHaveLength(0);
    useNotes.getState().createNote({ title: 'b note' });
    await logout();

    await expect(loginLocal(a.id, '0000')).rejects.toThrow(/PIN ไม่ถูกต้อง/);
    expect(useAccount.getState().session).toBeNull();
    expect(useAccount.getState().profiles.find((p) => p.id === a.id)!.failed).toBe(1);

    await loginLocal(a.id, '2580');
    expect(useAccount.getState().session?.name).toBe('สมชาย');
    expect(Object.values(useNotes.getState().notes).map((n) => n.title)).toEqual(['guest note']);
    expect(useProgress.getState().answers).toHaveLength(1);
    expect(useAccount.getState().profiles.find((p) => p.id === a.id)!.failed).toBe(0);
    expect(findLocalProfile('สมชาย', '9999')?.id).toBe(b.id);

    await logout();
    await loginLocal(b.id, '13579');
    expect(Object.values(useNotes.getState().notes).map((n) => n.title)).toEqual(['b note']);

    await expect(deleteLocalProfile(b.id, '0000')).rejects.toThrow();
    await deleteLocalProfile(b.id, '13579');
    expect(useAccount.getState().session).toBeNull();
    expect(namespaceKeys(`l_${b.id}`)).toHaveLength(0);
    expect(useAccount.getState().profiles.map((p) => p.id)).toEqual([a.id]);
  }, 30_000);

  it('locks the profile for a while after five wrong PINs', async () => {
    const p = await createLocalProfile({ name: 'lock', tag: '1', pin: '4826', moveGuest: false });
    await logout();
    for (let i = 0; i < 5; i++) await expect(loginLocal(p.id, '0000')).rejects.toThrow();
    await expect(loginLocal(p.id, '4826')).rejects.toThrow(/ลองใหม่ใน/);
  }, 30_000);
});
